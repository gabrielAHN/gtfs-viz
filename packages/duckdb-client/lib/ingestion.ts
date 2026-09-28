import { createExtensionClient } from "./client.js";
export type SqlExecutor = (sql: string) => Promise<unknown>;
export type ImportOptions = {
  stopsPath: string;
  pathwaysPath?: string;
  routesPath?: string;
  tripsPath?: string;
  stopTimesPath?: string;
  shapesPath?: string;
  calendarPath?: string;
  calendarDatesPath?: string;
};

const tables = [
  ["stops", "stopsPath"], ["pathways", "pathwaysPath"],
  ["routes", "routesPath"], ["trips", "tripsPath"],
  ["stop_times", "stopTimesPath"], ["shapes", "shapesPath"],
  ["calendar", "calendarPath"], ["calendar_dates", "calendarDatesPath"],
] as const;

export function buildImportStatements(opts: ImportOptions): string[] {
  return tables.flatMap(([table, key]) => {
    const path = opts[key];
    return path ? [
      `CREATE OR REPLACE TEMP TABLE ${table}_raw AS SELECT * FROM read_csv_auto('${path.replaceAll("'", "''")}', all_varchar=true, null_padding=true, quote='"', ignore_errors=true)`,
      `PRAGMA gtfs_normalize_${table}`,
    ] : [`PRAGMA gtfs_empty_${table}`];
  });
}
export const buildImportSql = (opts: ImportOptions): string => buildImportStatements(opts).map(sql => sql + ";").join("\n");
export const dropExistingSql = (): string => "PRAGMA gtfs_drop;";
export const addGeomColumnsSql = (): string => "PRAGMA gtfs_add_geometry;";
export type ImportProgress = {
  phase: "macros" | "drop" | "import" | "init";
  done: number;
  total: number;
  detail?: string;
};
export async function importGtfs(executor: SqlExecutor, opts: ImportOptions & {
  skipDrop?: boolean;
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
  await client.prepare();
  report("macros", 1, 1);
  if (!opts.skipDrop) {
    await executor(dropExistingSql());
    report("drop", 1, 1);
  }
  const statements = buildImportStatements(opts);
  for (let i = 0; i < statements.length; i++) {
    await executor(statements[i]);
    report("import", i + 1, statements.length);
  }
  await opts.onCsvImported?.();
  report("init", 0, 1);
  await client.init();
  report("init", 1, 1);
}
