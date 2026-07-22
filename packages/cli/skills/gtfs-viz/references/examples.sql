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

-- ============================================================================
-- Route queries
-- ============================================================================

-- List all routes
SELECT route_id, route_name, route_type_name, stop_count, trip_count
FROM RoutesTable
ORDER BY route_name;

-- Filter routes by type
SELECT route_id, route_name, route_type_name
FROM RoutesTable
WHERE route_type_name = 'Bus'
ORDER BY route_name;

-- Get route map bounds (uses spatial extension)
SELECT * FROM get_route_map_bounds(['ROUTE_ID_1', 'ROUTE_ID_2']);

-- Get routes serving a station
SELECT route_id, route_name, route_type_name
FROM get_station_service_routes('place-pktrm');

-- Get routes serving a stop
SELECT route_id, route_name, route_type_name
FROM get_stop_service_routes('10011');

-- Route services (calendar data)
SELECT service_id, monday, tuesday, wednesday, thursday, friday,
       saturday, sunday, start_date, end_date
FROM calendar
WHERE service_id IN (
  SELECT DISTINCT service_id FROM TripsView WHERE route_id = 'ROUTE_ID'
);

-- View pending edits
SELECT * FROM EditStopTable;
SELECT * FROM EditPathwayTable;
SELECT * FROM EditRouteTable;

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

-- ============================================================================
-- TRIPS & STOP TIMES
-- ============================================================================

-- List trips with stop counts for a route
SELECT t.trip_id, t.service_id, t.trip_headsign, COUNT(st.stop_id) AS stop_count
FROM trips t
LEFT JOIN stop_times st ON st.trip_id = t.trip_id
WHERE t.route_id = 'ROUTE_ID'
GROUP BY t.trip_id, t.service_id, t.trip_headsign
ORDER BY t.service_id, t.trip_id;

-- Stop times for a trip with stop names
SELECT st.stop_sequence, st.stop_id, s.stop_name, st.arrival_time, st.departure_time
FROM stop_times st
LEFT JOIN stops s ON s.stop_id = st.stop_id
WHERE st.trip_id = 'TRIP_ID'
ORDER BY st.stop_sequence;

-- Convert GTFS time strings to seconds for comparison
SELECT trip_id,
       gtfs_time_to_seconds(arrival_time) AS arrival_sec,
       gtfs_time_to_seconds(departure_time) AS departure_sec
FROM stop_times
WHERE trip_id = 'TRIP_ID';

-- Find trips with most stops
SELECT t.trip_id, t.route_id, COUNT(*) AS stops
FROM stop_times st JOIN trips t ON t.trip_id = st.trip_id
GROUP BY t.trip_id, t.route_id
ORDER BY stops DESC LIMIT 10;

-- ============================================================================
-- CALENDAR & SERVICES
-- ============================================================================

-- List services with trip counts
SELECT c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday,
       c.friday, c.saturday, c.sunday, c.start_date, c.end_date,
       COUNT(DISTINCT t.trip_id) AS trip_count
FROM calendar c
LEFT JOIN trips t ON t.service_id = c.service_id
GROUP BY c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday,
         c.friday, c.saturday, c.sunday, c.start_date, c.end_date
ORDER BY trip_count DESC;

-- Calendar exception dates for a service
SELECT * FROM calendar_dates WHERE service_id = 'SERVICE_ID' ORDER BY date;

-- ============================================================================
-- SHAPES
-- ============================================================================

-- List shapes with point counts and bounding box
SELECT shape_id, COUNT(*) AS points,
       MIN(shape_pt_lat) AS min_lat, MAX(shape_pt_lat) AS max_lat,
       MIN(shape_pt_lon) AS min_lon, MAX(shape_pt_lon) AS max_lon
FROM shapes GROUP BY shape_id ORDER BY shape_id;

-- Shape points for a specific shape
SELECT shape_pt_sequence, shape_pt_lat, shape_pt_lon, shape_dist_traveled
FROM shapes WHERE shape_id = 'SHAPE_ID' ORDER BY shape_pt_sequence;

-- ============================================================================
-- EDIT TRACKING
-- ============================================================================

-- Check pending stop time edits
SELECT * FROM EditStopTimesTable WHERE status != '';

-- Check pending calendar edits
SELECT * FROM EditCalendarTable WHERE status != '';

-- Check pending trip edits
SELECT * FROM EditTripsTable WHERE status != '';
