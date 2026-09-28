/**
 * Builds the import SQL using the GTFS extension's embedded SQL.
 *
 * Flow: enum macros → drop → CSV import/reformat → init (views/tables/indexes)
 */

import {
  GTFS_LOAD_SQL,
  GTFS_INIT_SQL,
  GTFS_REROUTE_SQL,
  dropExistingSql,
  buildImportSql as buildIngestionSql,
  addGeomColumnsSql,
} from "@gtfs-viz/duckdb-extension";
import { buildDuckDbSessionSql } from "./config.js";
import { getNativeExtensionRepository } from "./runner.js";
import { createExtensionClient } from "@gtfs-viz/duckdb-extension/client";

export type ImportOptions = {
  databasePath: string;
  stopsPath: string;
  pathwaysPath?: string;
  routesPath?: string;
  tripsPath?: string;
  stopTimesPath?: string;
  shapesPath?: string;
  calendarPath?: string;
  calendarDatesPath?: string;
};

export async function buildImportSteps(opts: ImportOptions): Promise<string[]> {
  const repository = await getNativeExtensionRepository(opts.databasePath);
  if (repository === undefined) return [await buildImportSql(opts)];
  const steps = ["INSTALL spatial; LOAD spatial;"];
  const client = createExtensionClient({ query: async sql => { steps.push(sql + ";"); } }, { repository });
  await client.prepare();
  steps.push(dropExistingSql() + "\n" + buildIngestionSql(opts));
  await client.init();
  steps.push("LOAD spatial;\n" + addGeomColumnsSql());
  return steps;
}

export async function buildImportSql(opts: ImportOptions): Promise<string> {
  const spatial = "INSTALL spatial; LOAD spatial;\n";
  if (await getNativeExtensionRepository(opts.databasePath) !== undefined) {
    return (await buildImportSteps(opts)).join("\n");
  }
  return [
    buildDuckDbSessionSql(opts.databasePath),
    spatial,
    GTFS_LOAD_SQL,
    dropExistingSql(),
    buildIngestionSql(opts),
    GTFS_INIT_SQL,
    GTFS_REROUTE_SQL,
    addGeomColumnsSql(),
  ].join("\n");
}
