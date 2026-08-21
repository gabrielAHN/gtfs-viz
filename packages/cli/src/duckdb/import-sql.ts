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

export async function buildImportSql(opts: {
  stopsPath: string;
  pathwaysPath?: string;
  routesPath?: string;
  tripsPath?: string;
  stopTimesPath?: string;
  shapesPath?: string;
  calendarPath?: string;
  calendarDatesPath?: string;
}): Promise<string> {
  const spatial = "INSTALL spatial; LOAD spatial;\n";
  return [spatial, GTFS_LOAD_SQL, dropExistingSql(), buildIngestionSql(opts), GTFS_INIT_SQL, GTFS_REROUTE_SQL, addGeomColumnsSql()].join("\n");
}
