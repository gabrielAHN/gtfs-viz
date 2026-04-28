-- ============================================================================
-- GTFS Extension for DuckDB
-- ============================================================================
--
-- Installs all GTFS macros, views, tables, and pathfinding procedures.
--
-- Usage (run DuckDB from this directory):
--   .read install.sql
--
-- Or load the pre-built single file (no .read chain required):
--   .read dist/gtfs.sql
--
-- Requires: stops table already imported from GTFS CSV
-- ============================================================================

-- Enum macros (location_type_to_name, wheelchair_to_emoji, etc.)
.read utils/gtfs_enums.sql

-- Edit tracking tables
.read tables/create_edit_stop_table.sql
.read tables/create_edit_pathway_table.sql

-- Views (StopsView, PathwaysView, station views)
.read tables/create_stops_view.sql
.read tables/create_pathways_view.sql
.read tables/create_station_views.sql

-- Materialized tables (StopsTable, StationsTable)
.read tables/create_stops_table.sql
.read tables/create_stations_table.sql

-- Pathway network
.read tables/initialize_pathway_network.sql

-- Query macros
.read queries/get_station_info.sql
.read queries/get_station_stops.sql
.read queries/get_station_pathways.sql
.read queries/get_pathway_aggregates.sql
.read queries/get_pathways_filtered.sql
.read queries/get_time_interval_ranges.sql
.read queries/get_station_routes.sql

-- Pathfinding
.read pathfinding/find_shortest_path.sql
.read pathfinding/find_reachable_stops.sql
.read pathfinding/find_all_paths.sql
.read pathfinding/get_direct_pathways.sql
.read pathfinding/get_station_routes.sql

SELECT 'GTFS extension installed' AS status;
