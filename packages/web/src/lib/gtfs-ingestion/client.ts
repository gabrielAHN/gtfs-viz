

import JSZip from 'jszip';
import { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';
import { logger } from '@/lib/logger';
import { GTFS_ENUM_MACROS } from './macros';

export interface GTFSFile {
  name: string;
  content: string;
  required: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  files: GTFSFile[];
  zip?: JSZip;
}

export interface IngestionProgress {
  percent: number;
  message: string;
  step: 'download' | 'extract' | 'validate' | 'register' | 'import' | 'reformat' | 'complete';
}

export type ProgressCallback = (progress: IngestionProgress) => void;

const REQUIRED_FILES = [
  'stops.txt',
] as const;

const USED_FILES = [
  'stops.txt',
  'pathways.txt',
] as const;

const OPTIONAL_FILES = [
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'agency.txt',
  'calendar.txt',
  'calendar_dates.txt',
  'shapes.txt',
  'frequencies.txt',
  'transfers.txt',
  'feed_info.txt',
] as const;

const ALL_GTFS_FILES = [...REQUIRED_FILES, ...OPTIONAL_FILES, 'pathways.txt'];

export async function validateGTFSZip(
  file: File,
  onProgress?: ProgressCallback
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const files: GTFSFile[] = [];

  try {
    onProgress?.({ percent: 0, message: 'Loading ZIP file...', step: 'validate' });

    const zip = await JSZip.loadAsync(file);
    const zipFiles = Object.keys(zip.files);

    onProgress?.({ percent: 30, message: 'Checking required files...', step: 'validate' });

    for (const requiredFile of REQUIRED_FILES) {
      const found = zipFiles.some(f => f.endsWith(requiredFile));
      if (!found) {
        errors.push(`Missing required file: ${requiredFile}`);
      }
    }

    onProgress?.({ percent: 60, message: 'Validating file structure...', step: 'validate' });

    for (const fileName of ALL_GTFS_FILES) {
      const zipEntry = Object.values(zip.files).find(f => f.name.endsWith(fileName));

      if (zipEntry && !zipEntry.dir) {
        
        files.push({
          name: fileName,
          content: '', 
          required: REQUIRED_FILES.includes(fileName as any),
        });

        logger.log(`  ✓ Found ${fileName}`);
      }
    }

    onProgress?.({ percent: 100, message: 'Validation complete', step: 'validate' });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      files,
      zip,
    };

  } catch (error) {
    errors.push(`Failed to read ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      valid: false,
      errors,
      warnings,
      files,
    };
  }
}

export async function validateGTFSUrl(
  url: string,
  onProgress?: ProgressCallback
): Promise<ValidationResult> {
  try {
    onProgress?.({ percent: 0, message: 'Downloading GTFS feed...', step: 'download' });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    onProgress?.({ percent: 50, message: 'Download complete, validating...', step: 'extract' });

    const blob = await response.blob();
    const file = new File([blob], 'gtfs.zip', { type: 'application/zip' });

    return validateGTFSZip(file, onProgress);

  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to download URL: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: [],
      files: [],
    };
  }
}

export async function loadIngestionProcedures(
  conn: AsyncDuckDBConnection
): Promise<void> {
  try {
    logger.log('Loading GTFS enum macros...');

    await conn.query(GTFS_ENUM_MACROS);
    logger.log('✅ GTFS enum macros loaded');
  } catch (error) {
    logger.error('Failed to load GTFS macros:', error);
    throw error;
  }
}

export async function registerGTFSFiles(
  db: AsyncDuckDB,
  zip: JSZip,
  fileNames: string[],
  onProgress?: ProgressCallback
): Promise<void> {
  try {
    onProgress?.({ percent: 0, message: 'Registering files with DuckDB...', step: 'register' });

    const filesToRegister = fileNames.filter(name => USED_FILES.includes(name as any));

    logger.log(`📁 Registering ${filesToRegister.length} files (skipping ${fileNames.length - filesToRegister.length} unused files to save memory)`);

    for (let i = 0; i < filesToRegister.length; i++) {
      const fileName = filesToRegister[i];
      const percent = ((i + 1) / filesToRegister.length) * 100;

      onProgress?.({
        percent,
        message: `Registering ${fileName}...`,
        step: 'register',
      });

      const zipEntry = Object.values(zip.files).find(f => f.name.endsWith(fileName));
      if (zipEntry && !zipEntry.dir) {
        const arrayBuffer = await zipEntry.async('arraybuffer');
        const uint8Array = new Uint8Array(arrayBuffer);

        await db.registerFileBuffer(fileName, uint8Array);

        const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
        logger.log(`  ✅ Registered ${fileName} (${sizeMB} MB)`);
      }
    }

    onProgress?.({ percent: 100, message: 'All files registered', step: 'register' });
  } catch (error) {
    logger.error('Failed to register files:', error);
    throw error;
  }
}

export async function runIngestion(
  conn: AsyncDuckDBConnection,
  skipReformat: boolean = false,
  onProgress?: ProgressCallback,
  hasPathwaysFile: boolean = false
): Promise<{ hasStations: boolean; hasStops: boolean }> {
  try {

    onProgress?.({ percent: 20, message: 'Importing CSV files...', step: 'import' });

    await conn.query(`
      CREATE TABLE IF NOT EXISTS stops AS
      SELECT * FROM read_csv_auto('stops.txt', null_padding=true, quote='"', ignore_errors=true)
    `);

    let hasPathwaysData = false;
    if (hasPathwaysFile) {
      try {
        await conn.query(`
          CREATE TABLE IF NOT EXISTS pathways AS
          SELECT * FROM read_csv_auto('pathways.txt', null_padding=true, quote='"', ignore_errors=true)
        `);
        hasPathwaysData = true;
        logger.log('✅ Pathways table created from pathways.txt');
      } catch (error) {
        logger.warn('⚠️ Failed to import pathways.txt:', error);
        hasPathwaysData = false;
      }
    }

    if (!hasPathwaysData) {
      logger.log('ℹ️  Creating empty pathways table for compatibility');
      await conn.query(`
        CREATE TABLE IF NOT EXISTS pathways (
          row_id INTEGER,
          pathway_id VARCHAR,
          from_stop_id VARCHAR,
          to_stop_id VARCHAR,
          pathway_mode INTEGER,
          is_bidirectional INTEGER,
          length DOUBLE,
          traversal_time INTEGER,
          stair_count INTEGER,
          max_slope DOUBLE,
          min_width DOUBLE,
          signposted_as VARCHAR,
          reversed_signposted_as VARCHAR,
          pathway_mode_name VARCHAR,
          direction_type VARCHAR
        )
      `);
    }

    if (!skipReformat) {
      onProgress?.({ percent: 50, message: 'Reformatting stops table...', step: 'reformat' });

      await conn.query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS parent_station VARCHAR`);
      await conn.query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS level_id VARCHAR`);
      await conn.query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS location_type INTEGER DEFAULT 0`);
      await conn.query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS wheelchair_boarding INTEGER DEFAULT 0`);
      await conn.query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS row_id INTEGER`);
      await conn.query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS location_type_name VARCHAR`);
      await conn.query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS wheelchair_status VARCHAR`);

      try {
        await conn.query(`CREATE TEMP TABLE stops_temp AS SELECT * FROM stops`);
        await conn.query(`DROP TABLE stops`);

        await conn.query(`
          CREATE TABLE stops AS
          WITH stops_with_casts AS (
            SELECT
              *,
              TRY_CAST(stop_id AS VARCHAR) AS stop_id_casted,
              TRY_CAST(parent_station AS VARCHAR) AS parent_station_casted,
              COALESCE(TRY_CAST(location_type AS INTEGER), 0) AS location_type_coalesced,
              COALESCE(TRY_CAST(wheelchair_boarding AS INTEGER), 0) AS wheelchair_boarding_coalesced
            FROM stops_temp
          )
          SELECT
            CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
            COALESCE(stop_id_casted, CAST(stop_id AS VARCHAR)) AS stop_id,
            stop_name,
            stop_lat,
            stop_lon,
            COALESCE(parent_station_casted, TRY_CAST(parent_station AS VARCHAR)) AS parent_station,
            location_type_coalesced AS location_type,
            wheelchair_boarding_coalesced AS wheelchair_boarding,
            * EXCLUDE (
              row_id,
              stop_id,
              stop_name,
              stop_lat,
              stop_lon,
              parent_station,
              location_type,
              wheelchair_boarding,
              location_type_name,
              wheelchair_status,
              stop_id_casted,
              parent_station_casted,
              location_type_coalesced,
              wheelchair_boarding_coalesced
            ),
            location_type_to_name(location_type_coalesced, COALESCE(parent_station_casted, TRY_CAST(parent_station AS VARCHAR))) AS location_type_name,
            wheelchair_to_emoji(wheelchair_boarding_coalesced) AS wheelchair_status
          FROM stops_with_casts
        `);
      } finally {
        try {
          await conn.query(`DROP TABLE IF EXISTS stops_temp`);
        } catch (cleanupError) {
          logger.log('⚠️ Failed to drop stops_temp:', cleanupError);
        }
      }

      if (hasPathwaysData) {
        try {
          onProgress?.({ percent: 60, message: 'Reformatting pathways table...', step: 'reformat' });

          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS pathway_mode INTEGER DEFAULT 1`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS is_bidirectional INTEGER DEFAULT 1`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS length DOUBLE`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS traversal_time INTEGER`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS stair_count INTEGER`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS max_slope DOUBLE`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS min_width DOUBLE`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS signposted_as VARCHAR`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS reversed_signposted_as VARCHAR`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS row_id INTEGER`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS pathway_mode_name VARCHAR`);
          await conn.query(`ALTER TABLE pathways ADD COLUMN IF NOT EXISTS direction_type VARCHAR`);

          try {
            await conn.query(`CREATE TEMP TABLE pathways_temp AS SELECT * FROM pathways`);
            await conn.query(`DROP TABLE pathways`);

            await conn.query(`
              CREATE TABLE pathways AS
              WITH pathways_with_casts AS (
                SELECT
                  *,
                  TRY_CAST(pathway_id AS VARCHAR) AS pathway_id_casted,
                  TRY_CAST(from_stop_id AS VARCHAR) AS from_stop_id_casted,
                  TRY_CAST(to_stop_id AS VARCHAR) AS to_stop_id_casted,
                  COALESCE(TRY_CAST(pathway_mode AS INTEGER), 1) AS pathway_mode_coalesced,
                  COALESCE(TRY_CAST(is_bidirectional AS INTEGER), 1) AS is_bidirectional_coalesced
                FROM pathways_temp
              )
              SELECT
                CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
                COALESCE(pathway_id_casted, CAST(pathway_id AS VARCHAR)) AS pathway_id,
                COALESCE(from_stop_id_casted, CAST(from_stop_id AS VARCHAR)) AS from_stop_id,
                COALESCE(to_stop_id_casted, CAST(to_stop_id AS VARCHAR)) AS to_stop_id,
                pathway_mode_coalesced AS pathway_mode,
                is_bidirectional_coalesced AS is_bidirectional,
                * EXCLUDE (
                  row_id,
                  pathway_id,
                  from_stop_id,
                  to_stop_id,
                  pathway_mode,
                  is_bidirectional,
                  pathway_mode_name,
                  direction_type,
                  pathway_id_casted,
                  from_stop_id_casted,
                  to_stop_id_casted,
                  pathway_mode_coalesced,
                  is_bidirectional_coalesced
                ),
                pathway_mode_to_name(pathway_mode_coalesced) AS pathway_mode_name,
                bidirectional_to_direction(is_bidirectional_coalesced) AS direction_type
              FROM pathways_with_casts
            `);
          } catch (reformatError) {
            logger.error('Pathways reformatting failed, restoring original table:', reformatError);

            try {
              const tables = await conn.query(`
                SELECT table_name FROM information_schema.tables
                WHERE table_name IN ('pathways', 'pathways_temp')
              `);
              const tableNames = tables.toArray().map(t => t.table_name);

              if (tableNames.includes('pathways_temp') && !tableNames.includes('pathways')) {
                await conn.query(`CREATE TABLE pathways AS SELECT * FROM pathways_temp`);
                logger.log('  ✅ Restored pathways table from temp');
              }
            } catch (restoreError) {
              logger.error('Error restoring pathways table:', restoreError);
            }

            throw reformatError;
          } finally {
            try {
              await conn.query(`DROP TABLE IF EXISTS pathways_temp`);
            } catch (cleanupError) {
              logger.log('⚠️ Failed to drop pathways_temp:', cleanupError);
            }
          }
        } catch (error) {
          const errorMsg = error?.message || String(error);
          logger.log('⚠️ Pathways reformatting failed:', errorMsg);

          try {
            await conn.query(`DROP TABLE IF EXISTS pathways_temp`);
          } catch (cleanupError) {
            logger.log('⚠️ Final cleanup of pathways_temp failed:', cleanupError);
          }
        }
      } else {
        logger.log('⚠️ No pathways table found - skipping pathways reformatting');
      }
    }

    onProgress?.({ percent: 90, message: 'Validating data...', step: 'complete' });

    const stopsResult = await conn.query(`SELECT COUNT(*) as count FROM stops WHERE location_type = 1`);
    const hasStations = stopsResult.toArray()[0]?.count > 0;

    const allStopsResult = await conn.query(`SELECT COUNT(*) as count FROM stops`);
    const hasStops = allStopsResult.toArray()[0]?.count > 0;

    logger.log(`Data imported: ${allStopsResult.toArray()[0]?.count} stops, ${hasStations ? 'includes stations' : 'no stations'}`);

    onProgress?.({ percent: 100, message: 'Ingestion complete!', step: 'complete' });

    return { hasStations, hasStops };

  } catch (error) {
    logger.error('Ingestion failed:', error);
    throw error;
  }
}

export async function ingestGTFS(
  db: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  source: File | string,
  options: {
    skipReformat?: boolean;
    onProgress?: ProgressCallback;
  } = {}
): Promise<{ hasStations: boolean; hasStops: boolean }> {
  const { skipReformat = false, onProgress } = options;

  try {

    onProgress?.({ percent: 0, message: 'Starting validation...', step: 'validate' });

    let validation: ValidationResult;
    if (typeof source === 'string') {
      validation = await validateGTFSUrl(source, onProgress);
    } else {
      validation = await validateGTFSZip(source, onProgress);
    }

    if (!validation.valid) {
      throw new Error(`Validation failed:\n${validation.errors.join('\n')}`);
    }

    if (validation.warnings.length > 0) {
      logger.log('⚠️ Validation warnings:', validation.warnings);
    }

    if (!validation.zip) {
      throw new Error('ZIP file not available from validation');
    }

    onProgress?.({ percent: 10, message: 'Loading ingestion procedures...', step: 'register' });
    await loadIngestionProcedures(conn);

    const fileNames = validation.files.map(f => f.name);
    await registerGTFSFiles(db, validation.zip, fileNames, onProgress);

    const hasPathwaysFile = validation.files.some(f => f.name === 'pathways.txt');

    const result = await runIngestion(conn, skipReformat, onProgress, hasPathwaysFile);

    return result;

  } catch (error) {
    logger.error('GTFS ingestion failed:', error);
    throw error;
  }
}
