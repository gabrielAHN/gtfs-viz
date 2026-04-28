import type { ProcedureCategory, ProcedurePath } from "./types.js";

export const PROCEDURE_PATHS: Record<ProcedureCategory, ProcedurePath[]> = {
  utils: ["utils/gtfs_enums"],

  tables: [
    "tables/create_edit_stop_table",
    "tables/create_edit_pathway_table",
    "tables/create_stops_view",
    "tables/create_pathways_view",
    "tables/create_station_views",
    "tables/create_stops_table",
    "tables/create_stations_table",
    "tables/initialize_pathway_network",
    "tables/reformat_stops",
    "tables/reformat_pathways",
  ],

  queries: [
    "queries/get_station_info",
    "queries/get_station_stops",
    "queries/get_station_pathways",
    "queries/get_pathway_aggregates",
    "queries/get_pathways_filtered",
    "queries/get_time_interval_ranges",
    "queries/get_station_routes",
  ],

  pathfinding: [
    "pathfinding/find_shortest_path",
    "pathfinding/find_reachable_stops",
    "pathfinding/find_all_paths",
    "pathfinding/get_direct_pathways",
    "pathfinding/get_station_routes",
  ],

  onager: [
    "onager/find_reachable_stops_direct",
    "onager/find_shortest_path_direct",
    "onager/find_station_hubs_direct",
    "onager/get_pathway_network_info",
    "onager/get_station_network_stats",
    "onager/get_station_routes_direct",
  ],

  ingestion: [
    "ingestion/import_gtfs_tables",
    "ingestion/reformat_after_import",
  ],
};

export const INGESTION_PATHS = PROCEDURE_PATHS.ingestion;

export const TABLE_PATHS = PROCEDURE_PATHS.tables;

export const QUERY_PATHS = PROCEDURE_PATHS.queries;

export const PATHFINDING_PATHS = PROCEDURE_PATHS.pathfinding;

export const ONAGER_PATHS = PROCEDURE_PATHS.onager;

export const PATHWAY_QUERY_PROCEDURE_PATHS: ProcedurePath[] = [
  "queries/get_station_stops",
  "queries/get_station_pathways",
  "queries/get_pathway_aggregates",
  "queries/get_pathways_filtered",
  "queries/get_time_interval_ranges",
];

export const ALL_PROCEDURE_PATHS: ProcedurePath[] = Object.values(
  PROCEDURE_PATHS
).flat();
