export type {
  ProcedureLoader,
  ProcedurePath,
  ProcedureCategory,
} from "./types.js";

export {
  sqlForNamedQuery,
  isNamedQuery,
  dashboardViewForNamedQuery,
  type NamedQueryName,
} from "./named-queries.js";

export {
  PROCEDURE_PATHS,
  INGESTION_PATHS,
  TABLE_PATHS,
  QUERY_PATHS,
  PATHFINDING_PATHS,
  ONAGER_PATHS,
  PATHWAY_QUERY_PROCEDURE_PATHS,
  ALL_PROCEDURE_PATHS,
} from "./catalog.js";

export { createBundledLoader, SQL_BUNDLE } from "./loader-bundled.js";

// Node-specific exports available via "@gtfs-viz/procedures/node":
//   createNodeLoader, getSqlDir

export type { SqlExecutor } from "./installer.js";
export {
  EXTENSION_REPO_URL,
  getInstallSql,
  fetchExtensionSql,
  installExtension,
  installEnums,
  installEditTables,
  installViews,
  installTables,
  installPathwayNetwork,
  installQueryMacros,
  installPathwayQueryProcedures,
  installPathfinding,
  installOnager,
  installBasicProcedures,
  installPathwayProcedures,
  installAllProcedures,
  recreateStopsView,
  recreatePathwaysView,
  reloadQueryMacros,
} from "./installer.js";
