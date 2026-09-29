import { createExtensionClient } from "./client.js";
export type SqlExecutor = (sql: string) => Promise<unknown>;
export type ImportOptions = {
  directory?: string;
  stopsPath?: string;
  pathwaysPath?: string;
  routesPath?: string;
  tripsPath?: string;
  stopTimesPath?: string;
  shapesPath?: string;
  calendarPath?: string;
  calendarDatesPath?: string;
};

export const importSql = (directory = ""): string => `PRAGMA gtfs_import('${directory.replaceAll("'", "''")}');`;
export const addGeomColumnsSql = (): string => "PRAGMA gtfs_add_geometry;";
export type ImportProgress = {
  phase: "macros" | "import";
  done: number;
  total: number;
  detail?: string;
};
export async function importGtfs(executor: SqlExecutor, opts: ImportOptions & {
  extensionRepository?: string;
  onCsvImported?: () => Promise<void>;
  onProgress?: (progress: ImportProgress) => void;
}): Promise<void> {
  if (!opts.routesPath || !opts.tripsPath || !opts.stopTimesPath || !opts.shapesPath || (!opts.calendarPath && !opts.calendarDatesPath)) {
    throw new Error("Downloaded extension does not support skipping indexes. Import all related files; no fallback was attempted.");
  }
  const client = createExtensionClient({ query: executor }, { repository: opts.extensionRepository });
  const report = (phase: ImportProgress["phase"], done: number, total: number) => opts.onProgress?.({ phase, done, total });
  report("macros", 0, 1);
  if (opts.extensionRepository !== undefined) await client.install();
  await client.load();
  report("macros", 1, 1);
  report("import", 0, 1);
  await client.importDirectory(opts.directory ?? "");
  report("import", 1, 1);
  await opts.onCsvImported?.();
}
