/**
 * Programmatic installer for GTFS procedures.
 *
 * Primary API (matches DuckDB INSTALL/LOAD pattern):
 *   getInstallSql()         — returns the full gtfs.sql content from the bundle
 *   installExtension(exec)  — executes gtfs.sql statement by statement
 *
 * Individual loaders are kept for incremental updates (recreateStopsView, etc.)
 */

import type { ProcedureLoader } from "./types.js";
import { PROCEDURE_PATHS, PATHWAY_QUERY_PROCEDURE_PATHS } from "./catalog.js";
import { SQL_BUNDLE } from "./sql-bundle.js";

export type SqlExecutor = (sql: string) => Promise<void>;

async function loadAndExecute(
  loader: ProcedureLoader,
  executor: SqlExecutor,
  procedurePath: string
): Promise<void> {
  const sql = await loader.loadSql(procedurePath);
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
    await executor(stmt);
  }
}

async function loadAndExecuteMultiple(
  loader: ProcedureLoader,
  executor: SqlExecutor,
  paths: string[]
): Promise<void> {
  for (const p of paths) {
    await loadAndExecute(loader, executor, p);
  }
}

// ── Extension repository ─────────────────────────────────────────────────────

/**
 * Public URL for the GTFS extension repository.
 * Points to the raw gtfs.sql on GitHub main branch.
 *
 * DuckDB CLI usage:
 *   INSTALL httpfs; LOAD httpfs;
 *   .read 'https://raw.githubusercontent.com/gabrielAHN/gtfs-viz/main/packages/procedures/gtfs/gtfs.sql'
 */
export const EXTENSION_REPO_URL =
  "https://raw.githubusercontent.com/gabrielAHN/gtfs-viz/main/packages/procedures/gtfs/gtfs.sql";

// ── Primary install API (DuckDB INSTALL/LOAD pattern) ────────────────────────

function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || s.length === 0) return false;
      const lines = s.split("\n").filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith("--") && !t.startsWith(".read");
      });
      return lines.length > 0;
    });
}

/**
 * Returns the full gtfs.sql content from the build bundle.
 * Used as a local fallback when the URL is not reachable.
 */
export function getInstallSql(): string {
  const sql = SQL_BUNDLE.get("__install__");
  if (!sql) {
    throw new Error(
      "Install SQL not found in bundle. Run 'npm run build' to generate it."
    );
  }
  return sql;
}

/**
 * Fetch the extension SQL from a URL.
 * Defaults to the public repo URL; pass a custom URL for self-hosted repos.
 */
export async function fetchExtensionSql(
  url: string = EXTENSION_REPO_URL
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch GTFS extension from ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * Install the GTFS extension by fetching from a URL and executing it.
 * Falls back to the bundled SQL if the fetch fails.
 */
export async function installExtension(
  executor: SqlExecutor,
  url?: string
): Promise<void> {
  let sql: string;
  if (url) {
    sql = await fetchExtensionSql(url);
  } else {
    try {
      sql = getInstallSql();
    } catch {
      sql = await fetchExtensionSql();
    }
  }

  for (const stmt of splitStatements(sql)) {
    await executor(stmt);
  }
}

// ── Individual loaders (for incremental updates) ─────────────────────────────

/**
 * Install enum macros (location_type_to_name, wheelchair_to_emoji, etc.)
 */
export async function installEnums(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecuteMultiple(loader, executor, PROCEDURE_PATHS.utils);
}

/**
 * Install edit tables (EditStopTable, EditPathwayTable)
 */
export async function installEditTables(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecute(loader, executor, "tables/create_edit_stop_table");
  await loadAndExecute(loader, executor, "tables/create_edit_pathway_table");
}

/**
 * Install views (StopsView, PathwaysView, StationViews)
 */
export async function installViews(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecute(loader, executor, "tables/create_stops_view");
  await loadAndExecute(loader, executor, "tables/create_pathways_view");
  await loadAndExecute(loader, executor, "tables/create_station_views");
}

/**
 * Install materialized tables (StopsTable, StationsTable)
 */
export async function installTables(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecute(loader, executor, "tables/create_stops_table");
  await loadAndExecute(loader, executor, "tables/create_stations_table");
}

/**
 * Install pathway network view
 */
export async function installPathwayNetwork(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecute(loader, executor, "tables/initialize_pathway_network");
}

/**
 * Install query macros (get_station_info, get_station_stops, etc.)
 */
export async function installQueryMacros(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecuteMultiple(loader, executor, PROCEDURE_PATHS.queries);
}

/**
 * Install pathway-specific query procedures
 */
export async function installPathwayQueryProcedures(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecuteMultiple(loader, executor, PATHWAY_QUERY_PROCEDURE_PATHS);
}

/**
 * Install pathfinding procedures
 */
export async function installPathfinding(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecuteMultiple(loader, executor, PROCEDURE_PATHS.pathfinding);
}

/**
 * Install onager (direct) procedures
 */
export async function installOnager(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecuteMultiple(loader, executor, PROCEDURE_PATHS.onager);
}

/**
 * Install basic procedures (enums + edit tables + views + tables + basic queries).
 * Equivalent to what the web app needs after GTFS import.
 */
export async function installBasicProcedures(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await installEnums(loader, executor);
  await loadAndExecute(loader, executor, "tables/create_edit_stop_table");
  await loadAndExecute(loader, executor, "tables/create_stops_view");
  await loadAndExecute(loader, executor, "tables/create_station_views");
  await loadAndExecute(loader, executor, "tables/create_stops_table");
  await loadAndExecute(loader, executor, "tables/create_stations_table");
  await loadAndExecute(loader, executor, "queries/get_station_info");
  await loadAndExecute(loader, executor, "queries/get_station_stops");
}

/**
 * Install pathway procedures (edit pathway table + views + network + queries + indexes).
 * Call after installBasicProcedures when pathways data exists.
 */
export async function installPathwayProcedures(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecute(loader, executor, "tables/create_edit_pathway_table");
  await loadAndExecute(loader, executor, "tables/create_pathways_view");
  await installPathwayNetwork(loader, executor);
  await installPathwayQueryProcedures(loader, executor);
}

/**
 * Install ALL procedures (basic + pathway + pathfinding).
 * Full installation equivalent to install_all.sql.
 */
export async function installAllProcedures(
  loader: ProcedureLoader,
  executor: SqlExecutor,
  options?: { hasPathways?: boolean }
): Promise<void> {
  await installBasicProcedures(loader, executor);

  if (options?.hasPathways !== false) {
    await installPathwayProcedures(loader, executor);
    await installPathfinding(loader, executor);
  }
}

/**
 * Recreate StopsView (drop + create).
 * Useful after editing stops data.
 */
export async function recreateStopsView(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await executor("ALTER TABLE stops ADD COLUMN IF NOT EXISTS level_id VARCHAR");
  await executor("DROP VIEW IF EXISTS pathway_network");
  await executor("DROP VIEW IF EXISTS StopsView");
  await loadAndExecute(loader, executor, "tables/create_stops_view");
  try {
    await loadAndExecute(loader, executor, "tables/initialize_pathway_network");
    await installPathwayQueryProcedures(loader, executor);
  } catch {}
}

/**
 * Recreate PathwaysView + pathway_network (drop + create).
 * Useful after editing pathways data.
 */
export async function recreatePathwaysView(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await executor("DROP VIEW IF EXISTS pathway_network");
  await executor("DROP VIEW IF EXISTS PathwaysView");
  await loadAndExecute(loader, executor, "tables/create_pathways_view");
  await loadAndExecute(loader, executor, "tables/initialize_pathway_network");
  try {
    await installPathwayQueryProcedures(loader, executor);
  } catch {
    // Pathway query procedures may fail if tables don't exist yet
  }
}

/**
 * Reload query macros (for when views have been recreated).
 */
export async function reloadQueryMacros(
  loader: ProcedureLoader,
  executor: SqlExecutor
): Promise<void> {
  await loadAndExecute(loader, executor, "queries/get_station_info");
  await loadAndExecute(loader, executor, "queries/get_station_stops");
}
