/**
 * GTFS DuckDB extension installer.
 * Executes embedded SQL for macros, views, tables, and indexes.
 */

import { GTFS_LOAD_SQL, GTFS_INIT_SQL, GTFS_REROUTE_SQL } from "../dist/sql.js";

export type SqlExecutor = (sql: string) => Promise<void>;

export type InstallInitOptions = {
  skipIndexes?: string[];
};

function splitStatements(sql: string): string[] {
  return sql
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
}

async function executeStatements(
  executor: SqlExecutor,
  sql: string,
  options: InstallInitOptions = {},
): Promise<void> {
  for (const stmt of splitStatements(sql)) {
    if (
      options.skipIndexes?.some((indexName) =>
        stmt.toLowerCase().includes(`index if not exists ${indexName.toLowerCase()}`),
      )
    ) {
      continue;
    }
    await executor(stmt);
  }
}

/** Returns the full install SQL (macros + init + reroute helpers combined). */
export function getInstallSql(): string {
  return GTFS_LOAD_SQL + "\n" + GTFS_INIT_SQL + "\n" + GTFS_REROUTE_SQL;
}

/** Install enum macros and edit tables. */
export async function installMacros(executor: SqlExecutor): Promise<void> {
  await executeStatements(executor, GTFS_LOAD_SQL);
}

/** Create views, TABLE macros, materialized tables, and indexes. */
export async function installInit(
  executor: SqlExecutor,
  options: InstallInitOptions = {},
): Promise<void> {
  await executeStatements(executor, GTFS_INIT_SQL, options);
  await executeStatements(executor, GTFS_REROUTE_SQL, options);
}

/** Full install: macros + views + tables + indexes. */
export async function installExtension(executor: SqlExecutor): Promise<void> {
  await installMacros(executor);
  await installInit(executor);
}

/** Recreate StopsView after stop edits. */
export async function recreateStopsView(executor: SqlExecutor): Promise<void> {
  await executor("ALTER TABLE stops ADD COLUMN IF NOT EXISTS level_id VARCHAR");
  await executor("DROP VIEW IF EXISTS pathway_network");
  await executor("DROP VIEW IF EXISTS StopsView");
  await installInit(executor);
}

/** Recreate PathwaysView + pathway_network after pathway edits. */
export async function recreatePathwaysView(
  executor: SqlExecutor,
): Promise<void> {
  await executor("DROP VIEW IF EXISTS pathway_network");
  await executor("DROP VIEW IF EXISTS PathwaysView");
  await installInit(executor);
}

export { GTFS_LOAD_SQL, GTFS_INIT_SQL, GTFS_REROUTE_SQL };
