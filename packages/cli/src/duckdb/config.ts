import os from "node:os";

const memoryLimitPattern = /^\d+(?:\.\d+)?\s*(?:B|KB|KIB|MB|MIB|GB|GIB|TB|TIB)$/i;
const cpuCount = Math.max(1, os.cpus().length);
const configuredThreads = Number.parseInt(process.env.GTFS_VIZ_DUCKDB_THREADS || "", 10);
const defaultThreads = Math.max(1, Math.min(2, cpuCount - 1));
const totalMemoryMb = Math.floor(os.totalmem() / (1024 * 1024));
const boundedMemoryMb = Math.min(4096, Math.max(512, Math.floor(totalMemoryMb * 0.5)));
const defaultMemoryMb = Math.max(512, Math.floor(boundedMemoryMb / 128) * 128);
const configuredMemoryLimit = process.env.GTFS_VIZ_DUCKDB_MEMORY_LIMIT?.trim();

export const duckDbThreads =
  Number.isFinite(configuredThreads) && configuredThreads > 0
    ? Math.min(configuredThreads, cpuCount)
    : defaultThreads;

export const duckDbMemoryLimit =
  configuredMemoryLimit && memoryLimitPattern.test(configuredMemoryLimit)
    ? configuredMemoryLimit
    : `${defaultMemoryMb}MB`;

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

export const buildDuckDbSessionSql = (dbPath?: string) => {
  const configuredTempDirectory = process.env.GTFS_VIZ_DUCKDB_TEMP_DIRECTORY?.trim();
  const tempDirectory = configuredTempDirectory || (dbPath ? `${dbPath}.tmp` : undefined);
  return (
    [
      `SET threads = ${duckDbThreads}`,
      `SET memory_limit = ${sqlString(duckDbMemoryLimit)}`,
      "SET preserve_insertion_order = false",
      ...(tempDirectory ? [`SET temp_directory = ${sqlString(tempDirectory)}`] : []),
    ].join(";\n") + ";"
  );
};
