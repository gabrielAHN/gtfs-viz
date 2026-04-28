/**
 * Bundled loader — SQL is embedded at build time.
 * No fetch(), no fs, works in any environment.
 * Requires running `node scripts/bundle-sql.mjs` as part of the build.
 */

import type { ProcedureLoader, ProcedurePath } from "./types.js";
import { SQL_BUNDLE } from "./sql-bundle.js";

export function createBundledLoader(): ProcedureLoader {
  return {
    async loadSql(path: ProcedurePath): Promise<string> {
      const sql = SQL_BUNDLE.get(path);
      if (sql === undefined) {
        throw new Error(
          `Procedure not found in bundle: ${path}. Available: ${[...SQL_BUNDLE.keys()].join(", ")}`
        );
      }
      return sql;
    },

    async loadMultiple(paths: ProcedurePath[]): Promise<string[]> {
      return paths.map((p) => {
        const sql = SQL_BUNDLE.get(p);
        if (sql === undefined) {
          throw new Error(`Procedure not found in bundle: ${p}`);
        }
        return sql;
      });
    },
  };
}

export { SQL_BUNDLE };
