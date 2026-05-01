-- ============================================================================
-- GTFS Viz SQL Examples
-- ============================================================================
-- Run these after importing a GTFS feed:
--   gtfs-viz import feed.zip
--   gtfs-viz query --sql "<sql>"
-- ============================================================================

-- List all stations
SELECT stop_id, stop_name, exit_count, pathways_status
FROM StationsTable
ORDER BY stop_name;

-- List standalone stops (non-station)
SELECT stop_id, stop_name, stop_lat, stop_lon
FROM StopsTable
ORDER BY stop_name;

-- Get station info with pathway connectivity
SELECT * FROM get_station_info('place-pktrm');

-- Get all parts (platforms, exits, nodes) of a station
SELECT stop_id, stop_name, location_type_name
FROM get_station_stops('place-pktrm')
ORDER BY location_type_name, stop_name;

-- Get all pathways within a station
SELECT pathway_id, from_stop_id, to_stop_id, traversal_time, pathway_mode_name
FROM get_station_pathways('place-pktrm')
ORDER BY traversal_time;

-- Get connection graph for a station
SELECT from_stop_name, to_stop_name, traversal_time_seconds, pathway_mode_name
FROM get_station_connections('place-pktrm')
ORDER BY traversal_time_seconds;

-- Find shortest routes between all node pairs
SELECT start_stop, end_stop, shortest_time, from_location_type_name, to_location_type_name
FROM get_station_routes('place-sstat')
WHERE shortest_time IS NOT NULL
ORDER BY shortest_time;

-- Find entrance-to-exit routes only
SELECT start_stop, end_stop, shortest_time
FROM get_station_routes('place-sstat')
WHERE from_location_type_name = 'Exit/Entrance'
  AND to_location_type_name = 'Exit/Entrance'
  AND shortest_time IS NOT NULL
ORDER BY shortest_time;

-- Find shortest path between two specific nodes
SELECT * FROM find_shortest_path('place-pktrm', 'door-pktrm-1', 'node-pktrm-platform', 10);

-- Find all stops reachable within 120 seconds
SELECT * FROM find_reachable_stops('place-pktrm', 'door-pktrm-1', 120, 5);

-- Count stations with/without pathways
SELECT pathways_status, COUNT(*) as count
FROM StationsTable
GROUP BY pathways_status;

-- Find stations with the most exits
SELECT stop_name, exit_count
FROM StationsTable
WHERE exit_count > 0
ORDER BY exit_count DESC
LIMIT 10;

-- Pathways with no traversal time (data quality check)
SELECT pathway_id, from_stop_id, to_stop_id, pathway_mode_name
FROM PathwaysView
WHERE traversal_time IS NULL;

-- View pending edits
SELECT * FROM EditStopTable;
SELECT * FROM EditPathwayTable;

-- Count stops by location type
SELECT location_type_name, COUNT(*) as count
FROM StopsView
GROUP BY location_type_name
ORDER BY count DESC;

-- Network stats for a station (requires onager procedures)
SELECT * FROM get_station_network_stats('place-pktrm');

-- Station parts with no direct pathway edge
WITH parts AS (
  SELECT stop_id, stop_name, location_type_name
  FROM get_station_stops('place-pktrm')
  WHERE location_type_name IN ('Platform', 'Exit/Entrance', 'Pathway Node', 'Boarding Area')
),
edges AS (
  SELECT from_stop_id AS stop_id FROM get_station_pathways('place-pktrm')
  UNION
  SELECT to_stop_id AS stop_id FROM get_station_pathways('place-pktrm')
)
SELECT p.stop_id, p.stop_name, p.location_type_name
FROM parts p
LEFT JOIN edges e USING (stop_id)
WHERE e.stop_id IS NULL
ORDER BY p.location_type_name, p.stop_name, p.stop_id;

-- Platforms or boarding areas that cannot reach an entrance
WITH routes AS (
  SELECT *
  FROM get_station_routes('place-pktrm')
  WHERE shortest_time IS NOT NULL
),
targets AS (
  SELECT stop_id, stop_name, location_type_name
  FROM get_station_stops('place-pktrm')
  WHERE location_type_name IN ('Platform', 'Boarding Area')
),
reachable_exits AS (
  SELECT start_stop AS stop_id
  FROM routes
  WHERE from_location_type_name IN ('Platform', 'Boarding Area')
    AND to_location_type_name = 'Exit/Entrance'
  UNION
  SELECT end_stop AS stop_id
  FROM routes
  WHERE to_location_type_name IN ('Platform', 'Boarding Area')
    AND from_location_type_name = 'Exit/Entrance'
)
SELECT t.stop_id, t.stop_name, t.location_type_name
FROM targets t
LEFT JOIN reachable_exits r USING (stop_id)
WHERE r.stop_id IS NULL
ORDER BY t.location_type_name, t.stop_name, t.stop_id;
