import { importSql, addGeomColumnsSql } from "@gtfs-viz/duckdb-client";
export type ImportOptions = { databasePath: string; directory: string };
export async function buildImportSteps(opts: ImportOptions): Promise<string[]> {
  return [
    "INSTALL spatial; LOAD spatial;",
    importSql(opts.directory),
    "LOAD spatial;\n" + addGeomColumnsSql(),
  ];
}
export async function buildImportSql(opts: ImportOptions): Promise<string> {
  return (await buildImportSteps(opts)).join("\n");
}
