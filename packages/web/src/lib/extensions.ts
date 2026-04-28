/**
 * GTFS extension loading for the web app.
 *
 * Production: fetches gtfs.sql from /extensions/gtfs.sql (served from public dir)
 * Dev: same URL (Vite serves public dir locally)
 * Fallback: bundled SQL from the procedures package build
 *
 * Individual procedures are kept for incremental updates after edits.
 */

import {
  installExtension,
  getInstallSql,
  createBundledLoader,
  recreateStopsView as _recreateStopsView,
  recreatePathwaysView as _recreatePathwaysView,
  reloadQueryMacros as _reloadQueryMacros,
  installEnums as _installEnums,
  installPathwayNetwork as _installPathwayNetwork,
  installPathwayQueryProcedures as _installPathwayQueryProcedures,
} from "@gtfs-viz/procedures";
import type { ProcedureLoader, SqlExecutor } from "@gtfs-viz/procedures";

/** URL where the deployed web app serves the extension SQL */
const EXTENSION_PATH = "/extensions/gtfs.sql";

// Singleton bundled loader for individual procedure loading
let _loader: ProcedureLoader | null = null;

function getLoader(): ProcedureLoader {
  if (!_loader) {
    _loader = createBundledLoader();
  }
  return _loader;
}

function createExecutor(conn: any): SqlExecutor {
  return async (sql: string) => {
    await conn.query(sql);
  };
}

// ── Primary install (fetches from URL, falls back to bundle) ─────────────────

/**
 * Install the full GTFS extension into a DuckDB-WASM connection.
 * Fetches gtfs.sql from the web app's public URL. Falls back to the
 * bundled SQL if the fetch fails (e.g. offline or CLI-backed session).
 */
export const installGtfsExtension = async (conn: any): Promise<void> => {
  const executor = createExecutor(conn);
  try {
    await installExtension(executor, EXTENSION_PATH);
  } catch {
    // Fallback: use bundled SQL (works offline / in CLI-backed sessions)
    await installExtension(executor);
  }
};

// ── Individual procedures (for incremental updates after edits) ──────────────

export const loadProcedure = async (conn: any, path: string): Promise<void> => {
  const loader = getLoader();
  const sql = await loader.loadSql(path);
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || s.length === 0) return false;
      const lines = s.split("\n").filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith("--");
      });
      return lines.length > 0;
    });
  for (const stmt of statements) {
    await conn.query(stmt);
  }
};

export const createStationsTable = async (conn: any): Promise<void> => {
  await loadProcedure(conn, "tables/create_stations_table");
};

export const createStopsTable = async (conn: any): Promise<void> => {
  await loadProcedure(conn, "tables/create_stops_table");
};

export const createEditStopTable = async (conn: any): Promise<void> => {
  await loadProcedure(conn, "tables/create_edit_stop_table");
};

export const createEditPathwayTable = async (conn: any): Promise<void> => {
  await _installEnums(getLoader(), createExecutor(conn)).catch(() => {});
  await loadProcedure(conn, "tables/create_edit_pathway_table");
};

export const createStopsView = async (conn: any): Promise<void> => {
  await conn.query("ALTER TABLE stops ADD COLUMN IF NOT EXISTS level_id VARCHAR");
  await loadProcedure(conn, "tables/create_stops_view");
  await loadProcedure(conn, "queries/get_station_info");
  await loadProcedure(conn, "queries/get_station_stops");
};

export const createPathwaysView = async (conn: any): Promise<void> => {
  await loadProcedure(conn, "tables/create_pathways_view");
};

export const loadPathwayQueryProcedures = async (conn: any): Promise<void> => {
  await _installPathwayQueryProcedures(getLoader(), createExecutor(conn));
};

export const recreatePathwayNetwork = async (conn: any): Promise<void> => {
  await conn.query("DROP VIEW IF EXISTS pathway_network");
  await _installPathwayNetwork(getLoader(), createExecutor(conn));
};

export const reloadQueryMacros = async (conn: any): Promise<void> => {
  await _reloadQueryMacros(getLoader(), createExecutor(conn));

  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'pathway_network'
    `);
    const count = result.toArray()[0]?.count || 0;
    if (Number(count) > 0) {
      await loadPathwayQueryProcedures(conn);
    }
  } catch (error) {
    console.warn("Could not check for pathway_network view:", error);
  }
};

export const recreateStopsView = async (conn: any): Promise<void> => {
  await _recreateStopsView(getLoader(), createExecutor(conn));
  await loadProcedure(conn, "queries/get_station_info");
  await loadProcedure(conn, "queries/get_station_stops");
};

export const recreatePathwaysView = async (conn: any): Promise<void> => {
  await conn.query("DROP VIEW IF EXISTS PathwaysView");
  await createPathwaysView(conn);
  await recreatePathwayNetwork(conn);

  try {
    await loadPathwayQueryProcedures(conn);
  } catch (error) {
    console.warn("Could not load pathway query procedures:", error);
  }
};
