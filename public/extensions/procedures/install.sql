CREATE OR REPLACE MACRO install_procedure(procedure_path VARCHAR) AS (
  SELECT 'Procedure ' || procedure_path || ' would be loaded from: /extensions/procedures/' || procedure_path || '.sql'
);

CREATE OR REPLACE MACRO list_procedures() AS TABLE (
  SELECT * FROM (VALUES
    ('pathfinding', 'find_shortest_path', 'Find shortest path between two stops using Dijkstra'),
    ('pathfinding', 'find_reachable_stops', 'Find all stops reachable from a starting point'),
    ('pathfinding', 'find_all_paths', 'Find all possible paths between two stops'),
    ('pathfinding', 'get_direct_pathways', 'Get direct pathways for visualization'),
    ('pathfinding', 'get_station_routes', 'Get all shortest routes in a station'),
    ('onager', 'find_shortest_path_direct', 'Onager-based shortest path (faster)'),
    ('onager', 'find_reachable_stops_direct', 'Onager-based reachability analysis'),
    ('onager', 'get_pathway_network_info', 'Get pathway network with importance scores'),
    ('onager', 'get_station_network_stats', 'Get network statistics using PageRank'),
    ('onager', 'find_station_hubs_direct', 'Find hub stops using PageRank'),
    ('onager', 'get_station_routes_direct', 'Onager all-pairs shortest paths'),
    ('ingestion', 'import_gtfs', 'Import GTFS data from zip file'),
    ('ingestion', 'reformat_tables', 'Reformat stops and pathways tables in-place'),
    ('tables', 'pathway_network_view', 'Pathway network view with computed angles'),
    ('tables', 'pathway_indexes', 'Performance indexes for pathways table'),
    ('tables', 'reformat_stops', 'Query macro for reformatted stops (SELECT only)'),
    ('tables', 'reformat_pathways', 'Query macro for reformatted pathways (SELECT only)'),
    ('tables', 'create_station_views', 'Query macros for StopsView, StationsTable, and StopsTable')
  ) AS procedures(category, name, description)
);
