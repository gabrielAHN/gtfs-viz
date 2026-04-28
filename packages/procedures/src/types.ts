export type ProcedureCategory =
  | "utils"
  | "tables"
  | "queries"
  | "pathfinding"
  | "onager"
  | "ingestion";

export type ProcedurePath = string;

export interface ProcedureLoader {
  loadSql(path: ProcedurePath): Promise<string>;
  loadMultiple(paths: ProcedurePath[]): Promise<string[]>;
}
