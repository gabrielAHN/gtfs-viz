import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProcedureLoader, ProcedurePath } from "./types.js";

const defaultSqlDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "gtfs"
);

export function createNodeLoader(sqlDir = defaultSqlDir): ProcedureLoader {
  return {
    async loadSql(procedurePath: ProcedurePath): Promise<string> {
      const filePath = path.join(sqlDir, `${procedurePath}.sql`);
      return readFile(filePath, "utf8");
    },

    async loadMultiple(paths: ProcedurePath[]): Promise<string[]> {
      return Promise.all(
        paths.map((p) => {
          const filePath = path.join(sqlDir, `${p}.sql`);
          return readFile(filePath, "utf8");
        })
      );
    },
  };
}

export function getSqlDir(): string {
  return defaultSqlDir;
}

/**
 * Returns the absolute path to the built gtfs.sql file.
 * Use with DuckDB CLI: .read <path>
 */
export function getInstallSqlPath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "gtfs.sql"
  );
}
