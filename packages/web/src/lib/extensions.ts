/**
 * GTFS extension for the web app.
 *
 * installGtfsExtension() runs the full extension: macros, views, tables, indexes.
 * Incremental functions re-run installInit() after edits.
 */

import {
  installExtension,
  installMacros,
  installInit,
  recreateStopsView as _recreateStopsView,
  recreatePathwaysView as _recreatePathwaysView,
} from "@gtfs-viz/duckdb-extension";
import type { SqlExecutor } from "@gtfs-viz/duckdb-extension";
import { logger } from "@/lib/logger";

function createExecutor(conn: any): SqlExecutor {
  return async (sql: string) => {
    await conn.query(sql);
  };
}

/**
 * Install the full GTFS extension: macros, views, tables, indexes.
 * Call after GTFS data (stops/pathways) has been loaded.
 */
export const installGtfsExtension = async (conn: any): Promise<void> => {
  await installExtension(createExecutor(conn));
};

/**
 * Install only enum macros + edit tables (before CSV import).
 */
export const installEnumsAndEditTables = async (conn: any): Promise<void> => {
  await installMacros(createExecutor(conn));
};

export const createStationsTable = async (conn: any): Promise<void> => {
  await conn.query(
    "CREATE OR REPLACE TABLE StationsTable AS SELECT * FROM get_stations_table_data()",
  );
};

export const createStopsTable = async (conn: any): Promise<void> => {
  await conn.query("CREATE OR REPLACE TABLE StopsTable AS SELECT * FROM get_stops_table_data()");
};

export const createEditStopTable = async (conn: any): Promise<void> => {
  await installMacros(createExecutor(conn));
};

export const createEditPathwayTable = async (conn: any): Promise<void> => {
  await installMacros(createExecutor(conn));
};

export const createEditRouteTable = async (conn: any): Promise<void> => {
  await installMacros(createExecutor(conn));
};

export const createStopsView = async (conn: any): Promise<void> => {
  await conn.query("ALTER TABLE stops ADD COLUMN IF NOT EXISTS level_id VARCHAR");
  await installInit(createExecutor(conn));
};

export const createPathwaysView = async (conn: any): Promise<void> => {
  await installInit(createExecutor(conn));
};

export const loadPathwayQueryProcedures = async (_conn: any): Promise<void> => {
  // All macros are registered by installInit — no-op
};

export const recreatePathwayNetwork = async (conn: any): Promise<void> => {
  await conn.query("DROP VIEW IF EXISTS pathway_network");
  await installInit(createExecutor(conn));
};

export const reloadQueryMacros = async (conn: any): Promise<void> => {
  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'pathway_network'
    `);
    const count = result.toArray()[0]?.count || 0;
    if (Number(count) > 0) {
      await installInit(createExecutor(conn));
    }
  } catch (error) {
    logger.warn("Could not check for pathway_network view:", error);
  }
};

export const recreateStopsView = async (conn: any): Promise<void> => {
  await _recreateStopsView(createExecutor(conn));
};

export const recreatePathwaysView = async (conn: any): Promise<void> => {
  await _recreatePathwaysView(createExecutor(conn));
};

export const refreshRoutesTables = async (conn: any): Promise<void> => {
  await installInit(createExecutor(conn));
};

// Re-export for backward compat
export const installEnums = installEnumsAndEditTables;
