import type { ProcedureLoader, ProcedurePath } from "./types.js";

export function createBrowserLoader(
  baseUrl = "/extensions/gtfs"
): ProcedureLoader {
  return {
    async loadSql(path: ProcedurePath): Promise<string> {
      const response = await fetch(`${baseUrl}/${path}.sql`);
      if (!response.ok) {
        throw new Error(
          `Failed to load procedure: ${path} - HTTP ${response.status}`
        );
      }
      return response.text();
    },

    async loadMultiple(paths: ProcedurePath[]): Promise<string[]> {
      return Promise.all(
        paths.map(async (p) => {
          const response = await fetch(`${baseUrl}/${p}.sql`);
          if (!response.ok) {
            throw new Error(
              `Failed to load procedure: ${p} - HTTP ${response.status}`
            );
          }
          return response.text();
        })
      );
    },
  };
}
