

-- Note: This tests procedure loading, not execution (requires actual GTFS data)

.print ''
.print '======================================================================'
.print 'GTFS PATHFINDING PROCEDURES - LOAD TEST'
.print '======================================================================'
.print ''

.print 'TEST 1: Loading table preprocessing and ingestion procedures...'
.print '  → Loading pathway_indexes.sql'
.read procedures/tables/pathway_indexes.sql
.print '  → Loading pathway_network_view.sql'
.read procedures/tables/pathway_network_view.sql
.print '  → Loading reformat_stops.sql'
.read procedures/tables/reformat_stops.sql
.print '  → Loading reformat_pathways.sql'
.read procedures/tables/reformat_pathways.sql
.print '  → Loading create_station_views.sql'
.read procedures/tables/create_station_views.sql
.print '  → Loading import_gtfs.sql (ingestion)'
.read procedures/ingestion/import_gtfs.sql
.print '  → Loading reformat_tables.sql (ingestion)'
.read procedures/ingestion/reformat_tables.sql
.print '  ✓ Table preprocessing and ingestion loaded successfully'
.print ''

.print 'TEST 2: Loading CTE-based pathfinding procedures...'
.print '  → Loading find_shortest_path.sql'
.read procedures/pathfinding/find_shortest_path.sql
.print '  → Loading find_reachable_stops.sql'
.read procedures/pathfinding/find_reachable_stops.sql
.print '  → Loading find_all_paths.sql'
.read procedures/pathfinding/find_all_paths.sql
.print '  → Loading get_direct_pathways.sql'
.read procedures/pathfinding/get_direct_pathways.sql
.print '  → Loading get_station_routes.sql'
.read procedures/pathfinding/get_station_routes.sql
.print '  ✓ All pathfinding procedures loaded successfully'
.print ''

.print 'TEST 3: Verifying loaded macros...'
.print 'Loaded pathfinding, ingestion, and table macros:'
SELECT macro_name, parameter_count
FROM duckdb_functions()
WHERE macro_name IN (
  'find_shortest_path',
  'find_reachable_stops',
  'find_all_paths',
  'get_direct_pathways',
  'get_station_routes',
  'import_stops_from_zip',
  'import_pathways_from_zip',
  'import_gtfs_core',
  'import_gtfs_all',
  'setup_gtfs_from_zip',
  'reformat_stops_table',
  'reformat_pathways_table',
  'reformat_stops_table_inplace',
  'reformat_pathways_table_inplace',
  'reformat_all_tables',
  'get_stops_view_data',
  'get_stops_table_data',
  'get_stations_table_data'
)
ORDER BY macro_name;
.print ''

.print 'TEST 4: Loading Onager procedures (optional)...'
.print 'Checking if Onager extension is available...'

.print '  → Attempting to install Onager extension...'
INSTALL onager FROM community;
LOAD onager;
.print '  ✓ Onager extension loaded'

.print '  → Loading find_shortest_path_direct.sql'
.read procedures/onager/find_shortest_path_direct.sql
.print '  → Loading find_reachable_stops_direct.sql'
.read procedures/onager/find_reachable_stops_direct.sql
.print '  → Loading get_pathway_network_info.sql'
.read procedures/onager/get_pathway_network_info.sql
.print '  → Loading get_station_network_stats.sql'
.read procedures/onager/get_station_network_stats.sql
.print '  → Loading find_station_hubs_direct.sql'
.read procedures/onager/find_station_hubs_direct.sql
.print '  → Loading get_station_routes_direct.sql'
.read procedures/onager/get_station_routes_direct.sql
.print '  ✓ All Onager procedures loaded successfully'
.print ''

.print 'TEST 5: Verifying all loaded macros...'
.print 'All loaded pathfinding, ingestion, and table macros:'
SELECT macro_name, parameter_count
FROM duckdb_functions()
WHERE macro_name IN (
  'find_shortest_path',
  'find_reachable_stops',
  'find_all_paths',
  'get_direct_pathways',
  'get_station_routes',
  'find_shortest_path_direct',
  'find_reachable_stops_direct',
  'get_pathway_network_info',
  'get_station_network_stats',
  'find_station_hubs_direct',
  'get_station_routes_direct',
  'import_stops_from_zip',
  'import_pathways_from_zip',
  'import_routes_from_zip',
  'import_gtfs_core',
  'import_gtfs_all',
  'setup_gtfs_from_zip',
  'reformat_stops_table',
  'reformat_pathways_table',
  'reformat_stops_table_inplace',
  'reformat_pathways_table_inplace',
  'reformat_all_tables',
  'get_stops_view_data',
  'get_stops_table_data',
  'get_stations_table_data'
)
ORDER BY macro_name;
.print ''

.print 'TEST 6: Checking created views...'
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'pathway_network';
.print ''

.print '======================================================================'
.print 'TEST SUMMARY'
.print '======================================================================'
.print ''
.print 'If you see this message without errors, all procedures loaded successfully!'
.print ''
.print 'Next steps:'
.print '  1. Ensure you have GTFS data loaded (pathways and stops tables)'
.print '  2. Try running example queries from README.md or QUICK_REFERENCE.md'
.print '  3. Check performance with your actual data'
.print ''
.print 'Example test query (requires GTFS data):'
.print '  SELECT COUNT(*) FROM pathways;'
.print '  SELECT * FROM get_direct_pathways(''your_station_id'') LIMIT 5;'
.print ''
.print '======================================================================'
