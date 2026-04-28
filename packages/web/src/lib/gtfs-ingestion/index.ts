import { logger } from "@/lib/logger";
import {
  installGtfsExtension,
  recreatePathwaysView,
  loadPathwayQueryProcedures,
} from "@/lib/extensions";
import { InitializeHybridPathfinding } from "@/lib/duckdb/DataFetching/pathways";
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

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
} from "./client";

import { validateZipContents, readZipFiles } from "./validation";
import {
  requiredFiles,
  keepColumnsFromCSV,
  mapArrowTypeToSQL,
  generateCreateTableQuery,
} from "./schema";

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
): Promise<{
  hasStations: boolean;
  hasStops: boolean;
  skipReformat?: boolean;
}> {
  return await ingestGTFS(db, conn, file, { skipReformat: false });
}

export async function importGTFSFromURL(
  conn: AsyncDuckDBConnection,
  url: string,
  db: AsyncDuckDB
): Promise<{
  hasStations: boolean;
  hasStops: boolean;
  skipReformat?: boolean;
}> {
  return await ingestGTFS(db, conn, url, { skipReformat: false });
}

async function checkTablesExist(
  conn: any,
  tableNames: string[]
): Promise<boolean> {
  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name IN (${tableNames.map((t) => `'${t}'`).join(",")})
    `);
    const count = result.toArray()[0]?.count || 0;
    return Number(count) === tableNames.length;
  } catch (error) {
    logger.error(`Error checking tables: ${tableNames.join(", ")}`, error);
    return false;
  }
}

async function verifyGTFSData(conn: any): Promise<void> {
  logger.log("Verifying GTFS data formatting...");

  const columnsCheck = await conn.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'stops'
    ORDER BY ordinal_position
  `);
  const columns = columnsCheck.toArray().map((c: any) => c.column_name);

  if (
    !columns.includes("row_id") ||
    !columns.includes("location_type_name") ||
    !columns.includes("wheelchair_status")
  ) {
    throw new Error(
      "Stops table not properly formatted. Expected columns: row_id, location_type_name, wheelchair_status"
    );
  }

  logger.log("  Stops table formatted correctly");

  const hasPathways = await checkTablesExist(conn, ["pathways"]);
  if (hasPathways) {
    logger.log("  Pathways table detected");
  }
}

/**
 * Install the GTFS extension and set up pathway-specific features.
 * Uses installGtfsExtension() — equivalent to .read gtfs.sql
 */
async function loadAppProcedures(conn: any): Promise<void> {
  logger.log("Installing GTFS extension...");
  await installGtfsExtension(conn);
  logger.log("  GTFS extension installed");

  // Check if pathways data exists for pathway-specific setup
  const hasPathwaysAndStops = await checkTablesExist(conn, [
    "pathways",
    "stops",
  ]);

  let hasPathwaysData = false;
  if (hasPathwaysAndStops) {
    const pathwaysDataCheck = await conn.query(
      "SELECT COUNT(*) as count FROM pathways"
    );
    hasPathwaysData = pathwaysDataCheck.toArray()[0]?.count > 0;
  }

  if (hasPathwaysData) {
    logger.log("Creating pathway indexes...");
    await conn.query(
      "CREATE INDEX IF NOT EXISTS idx_pathways_from_stop ON pathways(from_stop_id)"
    );
    await conn.query(
      "CREATE INDEX IF NOT EXISTS idx_pathways_to_stop ON pathways(to_stop_id)"
    );
    await conn.query(
      "CREATE INDEX IF NOT EXISTS idx_pathways_bidirectional ON pathways(is_bidirectional)"
    );
    await conn.query(
      "CREATE INDEX IF NOT EXISTS idx_stops_parent_station ON stops(parent_station)"
    );
    await conn.query(
      "CREATE INDEX IF NOT EXISTS idx_stops_location_type ON stops(location_type)"
    );
    logger.log("  Pathway indexes created");

    logger.log("Initializing pathfinding procedures...");
    const pathfindingResult = await InitializeHybridPathfinding(conn);
    if (pathfindingResult.success) {
      logger.log(
        `  Pathfinding initialized (${pathfindingResult.method})`
      );
    } else {
      logger.warn(
        `  Pathfinding initialization had issues: ${pathfindingResult.description}`
      );
    }
  } else {
    logger.log(
      "  No pathways data found - skipping pathway indexes and pathfinding"
    );
  }
}

export default async function setupGTFSData(conn: any): Promise<string> {
  try {
    await verifyGTFSData(conn);
    await loadAppProcedures(conn);
    logger.log("GTFS setup complete");
    return "Success";
  } catch (error: any) {
    logger.error("GTFS setup failed:", error);
    logger.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}
