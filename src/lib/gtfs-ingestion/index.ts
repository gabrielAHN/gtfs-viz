

import { logger } from "@/lib/logger";
import { loadProcedure } from "@/lib/extensions";
import { InitializeHybridPathfinding } from "@/lib/duckdb/DataFetching/pathways";
import {
  CREATE_EDIT_STOP_TABLE,
  CREATE_STOPS_VIEW,
  CREATE_STATION_VIEW_MACROS,
  CREATE_STOPS_TABLE,
  CREATE_STATIONS_TABLE,
  INITIALIZE_PATHWAY_NETWORK,
  CREATE_PATHWAY_INDEXES,
} from './procedures';
import { BASIC_QUERY_MACROS, PATHWAY_QUERY_MACROS } from './queries';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

import {
  ingestGTFS,
  validateGTFSZip,
  validateGTFSUrl,
  loadIngestionProcedures,
  registerGTFSFiles,
  runIngestion,
  type GTFSFile,
  type ValidationResult,
  type IngestionProgress,
  type ProgressCallback,
} from './client';

import { validateZipContents, readZipFiles } from './validation';
import { requiredFiles, keepColumnsFromCSV, mapArrowTypeToSQL, generateCreateTableQuery } from './schema';

export {
  ingestGTFS,
  validateGTFSZip,
  validateGTFSUrl,
  loadIngestionProcedures,
  registerGTFSFiles,
  runIngestion,
  type GTFSFile,
  type ValidationResult,
  type IngestionProgress,
  type ProgressCallback,
};

export {
  validateZipContents,
  readZipFiles,
  requiredFiles,
  keepColumnsFromCSV,
  mapArrowTypeToSQL,
  generateCreateTableQuery,
};

export async function importGTFSFromZip(
  conn: AsyncDuckDBConnection,
  file: File,
  db: AsyncDuckDB
): Promise<{ hasStations: boolean; hasStops: boolean; skipReformat?: boolean }> {
  return await ingestGTFS(db, conn, file, { skipReformat: false });
}

export async function importGTFSFromURL(
  conn: AsyncDuckDBConnection,
  url: string,
  db: AsyncDuckDB
): Promise<{ hasStations: boolean; hasStops: boolean; skipReformat?: boolean }> {
  return await ingestGTFS(db, conn, url, { skipReformat: false });
}

async function checkTablesExist(conn: any, tableNames: string[]): Promise<boolean> {
  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name IN (${tableNames.map(t => `'${t}'`).join(',')})
    `);
    const count = result.toArray()[0]?.count || 0;
    return Number(count) === tableNames.length;
  } catch (error) {
    logger.error(`Error checking tables: ${tableNames.join(', ')}`, error);
    return false;
  }
}

async function verifyGTFSData(conn: any): Promise<void> {
  logger.log("✅ Verifying GTFS data formatting...");

  const columnsCheck = await conn.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'stops'
    ORDER BY ordinal_position
  `);
  const columns = columnsCheck.toArray().map(c => c.column_name);

  if (!columns.includes('row_id') || !columns.includes('location_type_name') || !columns.includes('wheelchair_status')) {
    throw new Error(`Stops table not properly formatted. Expected columns: row_id, location_type_name, wheelchair_status`);
  }

  logger.log("  ✅ Stops table formatted correctly");

  const hasPathways = await checkTablesExist(conn, ['pathways']);
  if (hasPathways) {
    logger.log("  ✅ Pathways table detected");
  }
}

async function loadAppProcedures(conn: any): Promise<void> {
  
  logger.log("📝 Creating EditStopTable...");
  await conn.query(CREATE_EDIT_STOP_TABLE);
  logger.log("  ✅ EditStopTable created");

  logger.log("📝 Creating StopsView...");
  await conn.query(CREATE_STOPS_VIEW);
  logger.log("  ✅ StopsView created");

  logger.log("📦 Loading station view macros...");
  await conn.query(CREATE_STATION_VIEW_MACROS);
  logger.log("  ✅ Station view macros loaded");

  logger.log("📝 Creating StopsTable...");
  await conn.query(CREATE_STOPS_TABLE);
  logger.log("  ✅ StopsTable created");

  logger.log("📝 Creating StationsTable...");
  await conn.query(CREATE_STATIONS_TABLE);
  logger.log("  ✅ StationsTable created");

  logger.log("📦 Loading basic query macros...");
  await conn.query(BASIC_QUERY_MACROS);
  logger.log("  ✅ Basic query macros loaded");

  const hasPathwaysAndStops = await checkTablesExist(conn, ['pathways', 'stops']);

  let hasPathwaysData = false;
  if (hasPathwaysAndStops) {
    const pathwaysDataCheck = await conn.query(`SELECT COUNT(*) as count FROM pathways`);
    hasPathwaysData = pathwaysDataCheck.toArray()[0]?.count > 0;
  }

  if (hasPathwaysData) {
    logger.log("🌐 Initializing pathway network...");
    await conn.query(INITIALIZE_PATHWAY_NETWORK);
    logger.log("  ✅ Pathway network view created");

    logger.log("📑 Creating pathway indexes...");
    await conn.query(CREATE_PATHWAY_INDEXES);
    logger.log("  ✅ Pathway indexes created");

    logger.log("📦 Loading pathway query macros...");
    await conn.query(PATHWAY_QUERY_MACROS);
    logger.log("  ✅ Pathway query macros loaded");

    logger.log("🚀 Initializing pathfinding procedures...");
    const pathfindingResult = await InitializeHybridPathfinding(conn);
    if (pathfindingResult.success) {
      logger.log(`  ✅ Pathfinding initialized (${pathfindingResult.method})`);
    } else {
      logger.warn(`  ⚠️ Pathfinding initialization had issues: ${pathfindingResult.description}`);
    }
  } else {
    logger.log("  ℹ️  No pathways data found - skipping pathway network, pathway query macros, and pathfinding");
  }
}

export default async function setupGTFSData(conn: any): Promise<string> {
  try {
    
    await verifyGTFSData(conn);

    await loadAppProcedures(conn);

    logger.log("✅ GTFS setup complete");
    return "Success";
  } catch (error) {
    logger.error("❌ GTFS setup failed:", error);
    logger.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}
