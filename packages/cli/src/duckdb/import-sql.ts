import { dropExistingSql, buildImportSql as buildIngestionSql, addGeomColumnsSql } from "@gtfs-viz/duckdb-client";
import type { ImportOptions as TransportOptions } from "@gtfs-viz/duckdb-client";
export type ImportOptions = TransportOptions & { databasePath: string };
export async function buildImportSteps(opts: ImportOptions): Promise<string[]> {
  return [
    "INSTALL spatial; LOAD spatial;",
    "PRAGMA gtfs_prepare;",
    dropExistingSql() + "\n" + buildIngestionSql(opts),
    "PRAGMA gtfs_init;",
    "LOAD spatial;\n" + addGeomColumnsSql(),
  ];
}
export async function buildImportSql(opts: ImportOptions): Promise<string> {
  return (await buildImportSteps(opts)).join("\n");
}
