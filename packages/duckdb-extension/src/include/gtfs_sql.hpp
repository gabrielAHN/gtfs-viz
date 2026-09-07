#pragma once

// SQL executed when the extension is loaded (or before CSV import).
// Only enum scalar macros and edit-tracking tables — no table references.
static const char *GTFS_LOAD_SQL = R"SQL(

-- Map zoom helper (scalar — no table references)
CREATE OR REPLACE MACRO fit_zoom(min_lon, max_lon, min_lat, max_lat) AS (
  GREATEST(4, LEAST(17,
    ROUND(LOG2(360.0 / GREATEST(
      GREATEST(ABS(max_lon - min_lon), 0.001),
      GREATEST(ABS(max_lat - min_lat), 0.001)
    )) - 0.3)
  ))
);

-- Enum helper macros (scalar — no table references)
CREATE OR REPLACE MACRO pathway_mode_to_name(mode) AS (
  CASE mode
    WHEN 1 THEN 'Walkway'
    WHEN 2 THEN 'Stairs'
    WHEN 3 THEN 'Moving sidewalk/travelator'
    WHEN 4 THEN 'Escalator'
    WHEN 5 THEN 'Elevator'
    WHEN 6 THEN 'Fare gate'
    WHEN 7 THEN 'Exit gate'
    ELSE '❓'
  END
);

CREATE OR REPLACE MACRO bidirectional_to_direction(is_bidirectional) AS (
  CASE is_bidirectional
    WHEN 0 THEN 'directional'
    WHEN 1 THEN 'bidirectional'
    ELSE 'unknown'
  END
);

CREATE OR REPLACE MACRO location_type_to_name(location_type, parent_station) AS (
  CASE
    WHEN location_type = 0 AND COALESCE(parent_station, '') != '' THEN 'Platform'
    WHEN location_type = 0 THEN 'Stop'
    WHEN location_type = 1 THEN 'Station'
    WHEN location_type = 2 THEN 'Exit/Entrance'
    WHEN location_type = 3 THEN 'Pathway Node'
    WHEN location_type = 4 THEN 'Boarding Area'
    ELSE 'Unknown'
  END
);

CREATE OR REPLACE MACRO wheelchair_to_emoji(wheelchair_boarding) AS (
  CASE wheelchair_boarding
    WHEN 0 THEN '🔵'
    WHEN 1 THEN '🟢'
    WHEN 2 THEN '🔴'
    ELSE '🟡'
  END
);

CREATE OR REPLACE MACRO route_type_to_name(route_type) AS (
  CASE route_type
    WHEN 0 THEN 'Tram, Streetcar, Light rail'
    WHEN 1 THEN 'Subway, Metro'
    WHEN 2 THEN 'Rail'
    WHEN 3 THEN 'Bus'
    WHEN 4 THEN 'Ferry'
    WHEN 5 THEN 'Cable tram'
    WHEN 6 THEN 'Aerial lift'
    WHEN 7 THEN 'Funicular'
    WHEN 11 THEN 'Trolleybus'
    WHEN 12 THEN 'Monorail'
    ELSE 'Other'
  END
);

CREATE OR REPLACE MACRO gtfs_color_to_hex(color_value, fallback_value) AS (
  CASE
    WHEN color_value IS NULL OR TRIM(CAST(color_value AS VARCHAR)) = '' THEN fallback_value
    WHEN LEFT(TRIM(CAST(color_value AS VARCHAR)), 1) = '#' THEN TRIM(CAST(color_value AS VARCHAR))
    ELSE '#' || TRIM(CAST(color_value AS VARCHAR))
  END
);

-- Edit tracking tables (no data dependency)
CREATE TABLE IF NOT EXISTS EditStopTable (
    row_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    stop_name TEXT,
    stop_lat DOUBLE PRECISION,
    stop_lon DOUBLE PRECISION,
    location_type_name TEXT,
    parent_station TEXT,
    level_id TEXT,
    wheelchair_status TEXT,
    status TEXT
);
ALTER TABLE EditStopTable ADD COLUMN IF NOT EXISTS level_id TEXT;

CREATE TABLE IF NOT EXISTS EditPathwayTable (
    row_id INTEGER NOT NULL,
    pathway_id TEXT NOT NULL,
    from_stop_id TEXT NOT NULL,
    to_stop_id TEXT NOT NULL,
    pathway_mode INTEGER DEFAULT 1,
    is_bidirectional INTEGER DEFAULT 1,
    length DOUBLE,
    traversal_time INTEGER,
    stair_count INTEGER,
    max_slope DOUBLE,
    min_width DOUBLE,
    signposted_as TEXT,
    reversed_signposted_as TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS EditRouteTable (
    row_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    agency_id TEXT,
    route_short_name TEXT,
    route_long_name TEXT,
    route_desc TEXT,
    route_type INTEGER,
    route_url TEXT,
    route_color TEXT,
    route_text_color TEXT,
    route_sort_order INTEGER,
    shape_points_json TEXT,
    status TEXT
);
ALTER TABLE EditRouteTable ADD COLUMN IF NOT EXISTS shape_points_json TEXT;

CREATE TABLE IF NOT EXISTS EditStopTimesTable (
    row_id TEXT NOT NULL,
    trip_id TEXT NOT NULL,
    stop_sequence INTEGER,
    stop_id TEXT,
    arrival_time TEXT,
    departure_time TEXT,
    stop_headsign TEXT,
    pickup_type INTEGER,
    drop_off_type INTEGER,
    shape_dist_traveled DOUBLE,
    status TEXT
);
ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_type TEXT;
ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_source_trip_id TEXT;
ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_from_stop_name TEXT;
ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_to_stop_name TEXT;

CREATE TABLE IF NOT EXISTS EditCalendarTable (
    row_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    monday INTEGER,
    tuesday INTEGER,
    wednesday INTEGER,
    thursday INTEGER,
    friday INTEGER,
    saturday INTEGER,
    sunday INTEGER,
    start_date TEXT,
    end_date TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS EditTripsTable (
    row_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    trip_id TEXT NOT NULL,
    trip_headsign TEXT,
    trip_short_name TEXT,
    direction_id INTEGER,
    block_id TEXT,
    shape_id TEXT,
    wheelchair_accessible INTEGER,
    bikes_allowed INTEGER,
    status TEXT
);

CREATE TABLE IF NOT EXISTS EditCalendarDatesTable (
    row_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    date TEXT NOT NULL,
    exception_type INTEGER,
    status TEXT
);

)SQL";

// SQL executed after GTFS data is loaded (stops + pathways tables must exist).
// Creates views, then registers all TABLE macros that reference those views,
// then materializes tables and creates indexes.
// DuckDB validates TABLE macro references at creation time, so views must
// exist before macros that reference them can be defined.
static const char *GTFS_INIT_SQL = R"SQL(

-- ── Views (depend on stops/pathways + edit tables) ──────────────────────────

CREATE TABLE IF NOT EXISTS calendar (
  row_id INTEGER, service_id VARCHAR, monday INTEGER, tuesday INTEGER,
  wednesday INTEGER, thursday INTEGER, friday INTEGER, saturday INTEGER,
  sunday INTEGER, start_date VARCHAR, end_date VARCHAR
);
CREATE TABLE IF NOT EXISTS calendar_dates (
  row_id INTEGER, service_id VARCHAR, date VARCHAR, exception_type INTEGER
);
ALTER TABLE EditRouteTable ADD COLUMN IF NOT EXISTS shape_points_json TEXT;

CREATE OR REPLACE VIEW StopsView AS
SELECT row_id, stop_id, stop_name, stop_lat, stop_lon,
       location_type_name, parent_station, level_id, wheelchair_status, status
FROM (
  SELECT edt.row_id, edt.stop_id, edt.stop_name, edt.stop_lat, edt.stop_lon,
         edt.location_type_name, edt.parent_station, edt.level_id,
         edt.wheelchair_status, edt.status
  FROM EditStopTable edt WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT st.row_id, st.stop_id, st.stop_name, st.stop_lat, st.stop_lon,
         st.location_type_name, st.parent_station, st.level_id,
         st.wheelchair_status, '' AS status
  FROM stops st
  WHERE NOT EXISTS (SELECT 1 FROM EditStopTable edt WHERE edt.row_id = st.row_id AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditStopTable edt WHERE edt.row_id = st.row_id AND edt.status = 'edit')
) combined;

CREATE OR REPLACE VIEW PathwaysView AS
SELECT row_id, pathway_id, from_stop_id, to_stop_id, pathway_mode, is_bidirectional,
       length, traversal_time, stair_count, max_slope, min_width,
       signposted_as, reversed_signposted_as, pathway_mode_name, direction_type, status
FROM (
  SELECT edt.row_id, edt.pathway_id, edt.from_stop_id, edt.to_stop_id,
         edt.pathway_mode, edt.is_bidirectional, edt.length, edt.traversal_time,
         edt.stair_count, edt.max_slope, edt.min_width,
         edt.signposted_as, edt.reversed_signposted_as,
         pathway_mode_to_name(edt.pathway_mode) AS pathway_mode_name,
         bidirectional_to_direction(edt.is_bidirectional) AS direction_type,
         edt.status
  FROM EditPathwayTable edt WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT pt.row_id, pt.pathway_id, pt.from_stop_id, pt.to_stop_id,
         pt.pathway_mode, pt.is_bidirectional, pt.length, pt.traversal_time,
         pt.stair_count, pt.max_slope, pt.min_width,
         pt.signposted_as, pt.reversed_signposted_as,
         pt.pathway_mode_name, pt.direction_type, '' AS status
  FROM pathways pt
  WHERE NOT EXISTS (SELECT 1 FROM EditPathwayTable edt WHERE edt.row_id = pt.row_id AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditPathwayTable edt WHERE edt.row_id = pt.row_id AND edt.status = 'edit')
    AND NOT EXISTS (SELECT 1 FROM EditPathwayTable edt WHERE edt.pathway_id = pt.pathway_id AND edt.status = 'new edit')
) combined;

CREATE OR REPLACE VIEW RoutesView AS
SELECT row_id, route_id, agency_id, route_short_name, route_long_name,
       route_desc, route_type, route_url, route_color, route_text_color,
       route_sort_order, route_name, route_type_name, route_color_hex,
       route_text_color_hex, shape_points_json, status
FROM (
  SELECT edt.row_id, edt.route_id, edt.agency_id, edt.route_short_name,
         edt.route_long_name, edt.route_desc, COALESCE(edt.route_type, 3) AS route_type,
         edt.route_url, edt.route_color, edt.route_text_color,
         edt.route_sort_order,
         COALESCE(NULLIF(edt.route_short_name, ''), NULLIF(edt.route_long_name, ''), edt.route_id) AS route_name,
         route_type_to_name(COALESCE(edt.route_type, 3)) AS route_type_name,
         gtfs_color_to_hex(edt.route_color, '#4f46e5') AS route_color_hex,
         gtfs_color_to_hex(edt.route_text_color, '#ffffff') AS route_text_color_hex,
         edt.shape_points_json, edt.status
  FROM EditRouteTable edt WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT CAST(r.row_id AS TEXT) AS row_id, r.route_id, r.agency_id,
         r.route_short_name, r.route_long_name, r.route_desc, r.route_type,
         r.route_url, r.route_color, r.route_text_color, r.route_sort_order,
         r.route_name, r.route_type_name, r.route_color_hex, r.route_text_color_hex,
         NULL AS shape_points_json, '' AS status
  FROM routes r
  WHERE NOT EXISTS (SELECT 1 FROM EditRouteTable edt WHERE edt.route_id = r.route_id AND edt.status IN ('edit', 'deleted', 'new edit'))
) combined;

CREATE OR REPLACE VIEW CalendarView AS
SELECT row_id, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, status
FROM (
  SELECT edt.row_id, edt.service_id, edt.monday, edt.tuesday, edt.wednesday, edt.thursday,
         edt.friday, edt.saturday, edt.sunday, edt.start_date, edt.end_date, edt.status
  FROM EditCalendarTable edt WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT CAST(c.row_id AS TEXT) AS row_id, c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday,
         c.friday, c.saturday, c.sunday, c.start_date, c.end_date, '' AS status
  FROM calendar c
  WHERE NOT EXISTS (SELECT 1 FROM EditCalendarTable edt WHERE edt.service_id = c.service_id AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditCalendarTable edt WHERE edt.service_id = c.service_id AND edt.status IN ('edit', 'new edit'))
) combined;

CREATE OR REPLACE VIEW CalendarDatesView AS
SELECT row_id, service_id, date, exception_type, status
FROM (
  SELECT edt.row_id, edt.service_id, edt.date, edt.exception_type, edt.status
  FROM EditCalendarDatesTable edt WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT CAST(cd.row_id AS TEXT) AS row_id, cd.service_id, cd.date, cd.exception_type, '' AS status
  FROM calendar_dates cd
  WHERE NOT EXISTS (SELECT 1 FROM EditCalendarDatesTable edt WHERE edt.service_id = cd.service_id AND edt.date = cd.date AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditCalendarDatesTable edt WHERE edt.service_id = cd.service_id AND edt.date = cd.date AND edt.status IN ('edit', 'new edit'))
) combined;

CREATE OR REPLACE VIEW TripsView AS
SELECT row_id, route_id, service_id, trip_id, trip_headsign, trip_short_name,
       direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed, status
FROM (
  SELECT edt.row_id, edt.route_id, edt.service_id, edt.trip_id, edt.trip_headsign,
         edt.trip_short_name, edt.direction_id, edt.block_id, edt.shape_id,
         edt.wheelchair_accessible, edt.bikes_allowed, edt.status
  FROM EditTripsTable edt WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT CAST(t.row_id AS TEXT) AS row_id, t.route_id, t.service_id, t.trip_id, t.trip_headsign,
         t.trip_short_name, t.direction_id, t.block_id, t.shape_id,
         t.wheelchair_accessible, t.bikes_allowed, '' AS status
  FROM trips t
  WHERE NOT EXISTS (SELECT 1 FROM EditRouteTable edt WHERE edt.route_id = t.route_id AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditTripsTable edt WHERE edt.trip_id = t.trip_id AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditTripsTable edt WHERE edt.trip_id = t.trip_id AND edt.status IN ('edit', 'new edit'))
) combined;

CREATE OR REPLACE VIEW StopTimesView AS
SELECT row_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time,
       stop_headsign, pickup_type, drop_off_type, shape_dist_traveled, status
FROM (
  SELECT edt.row_id, edt.trip_id, edt.stop_sequence, edt.stop_id,
         edt.arrival_time, edt.departure_time, edt.stop_headsign,
         edt.pickup_type, edt.drop_off_type, edt.shape_dist_traveled, edt.status
  FROM EditStopTimesTable edt WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT CAST(st.row_id AS TEXT) AS row_id, st.trip_id, st.stop_sequence, st.stop_id,
         st.arrival_time, st.departure_time, st.stop_headsign,
         st.pickup_type, st.drop_off_type, st.shape_dist_traveled, '' AS status
  FROM stop_times st
  WHERE NOT EXISTS (SELECT 1 FROM EditStopTimesTable edt WHERE TRY_CAST(edt.row_id AS BIGINT) = st.row_id AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditStopTimesTable edt WHERE TRY_CAST(edt.row_id AS BIGINT) = st.row_id AND edt.status = 'edit')
    AND NOT EXISTS (SELECT 1 FROM EditStopTimesTable edt WHERE edt.trip_id = st.trip_id AND edt.status = 'new edit')
) combined;

CREATE OR REPLACE VIEW RouteStopsView AS
WITH route_stop_refs AS (
  SELECT t.route_id, st.stop_id, MIN(st.stop_sequence) AS stop_sequence
  FROM TripsView t
  JOIN StopTimesView st ON st.trip_id = t.trip_id
  WHERE t.route_id IS NOT NULL AND t.route_id != ''
    AND st.stop_id IS NOT NULL AND st.stop_id != ''
  GROUP BY t.route_id, st.stop_id
)
SELECT rs.route_id, r.route_name, r.route_short_name, r.route_long_name,
       r.route_type, r.route_type_name, r.route_color_hex, r.route_text_color_hex,
       rs.stop_id, sv.stop_name, sv.stop_lat, sv.stop_lon, sv.location_type_name,
       sv.parent_station,
       COALESCE(NULLIF(sv.parent_station, ''), sv.stop_id) AS station_id,
       station.stop_name AS station_name,
       rs.stop_sequence
FROM route_stop_refs rs
JOIN RoutesView r ON r.route_id = rs.route_id
LEFT JOIN StopsView sv ON sv.stop_id = rs.stop_id
LEFT JOIN StopsView station
  ON station.stop_id = COALESCE(NULLIF(sv.parent_station, ''), sv.stop_id)
 AND station.location_type_name = 'Station';

CREATE OR REPLACE VIEW RouteShapesView AS
WITH route_shapes AS (
  SELECT DISTINCT route_id, shape_id
  FROM TripsView
  WHERE route_id IS NOT NULL AND route_id != ''
    AND shape_id IS NOT NULL AND shape_id != ''
)
SELECT rs.route_id, r.route_name, r.route_short_name, r.route_long_name,
       r.route_type, r.route_type_name, r.route_color_hex, r.route_text_color_hex,
       rs.shape_id, s.shape_pt_lat, s.shape_pt_lon, s.shape_pt_sequence,
       s.shape_dist_traveled
FROM route_shapes rs
JOIN RoutesView r ON r.route_id = rs.route_id
JOIN shapes s ON s.shape_id = rs.shape_id
WHERE s.shape_pt_lat IS NOT NULL AND s.shape_pt_lon IS NOT NULL;

CREATE OR REPLACE TABLE RouteStopsTable AS SELECT * FROM RouteStopsView;

-- ── Station view macros (reference StopsView — must come after view creation) ─

CREATE OR REPLACE MACRO get_stops_view_data() AS TABLE (
  SELECT row_id, stop_id, stop_name, stop_lat, stop_lon,
         location_type_name, parent_station, level_id, wheelchair_status, status
  FROM StopsView
);

CREATE OR REPLACE MACRO get_stops_table_data() AS TABLE (
  WITH route_counts AS (
    SELECT stop_id,
           COUNT(DISTINCT route_id) AS route_count,
           STRING_AGG(DISTINCT route_id || '|||' || route_name || '|||' || route_color_hex || '|||' || route_text_color_hex, '\n') AS route_links
    FROM RouteStopsTable
    GROUP BY stop_id
  )
  SELECT s.row_id, s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
         s.status, s.location_type_name, s.parent_station, s.level_id, s.wheelchair_status,
         COALESCE(rc.route_count, 0) AS route_count,
         COALESCE(rc.route_links, '') AS route_links
  FROM StopsView s
  LEFT JOIN route_counts rc ON rc.stop_id = s.stop_id
  WHERE s.location_type_name != 'Station'
    AND (s.parent_station IS NULL OR s.parent_station = '')
);

CREATE OR REPLACE MACRO get_stations_table_data() AS TABLE (
  WITH exit_counts AS (
    SELECT parent_station, COUNT(*) AS exit_count
    FROM StopsView WHERE location_type_name = 'Exit/Entrance' GROUP BY parent_station
  ),
  all_pathways AS (
    SELECT s.stop_id AS station_id, p.pathway_id
    FROM StopsView s
    LEFT JOIN stops st ON st.parent_station = s.stop_id
    LEFT JOIN PathwaysView p ON p.from_stop_id IN (s.stop_id, st.stop_id) OR p.to_stop_id IN (s.stop_id, st.stop_id)
  ),
  pathway_counts AS (
    SELECT station_id, COUNT(DISTINCT pathway_id) AS pathway_count
    FROM all_pathways GROUP BY station_id
  ),
  route_counts AS (
    SELECT station_id,
           COUNT(DISTINCT route_id) AS route_count,
           STRING_AGG(DISTINCT route_id || '|||' || route_name || '|||' || route_color_hex || '|||' || route_text_color_hex, '\n') AS route_links
    FROM RouteStopsTable
    WHERE station_id IS NOT NULL
    GROUP BY station_id
  )
  SELECT s.row_id, s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.status,
         COALESCE(e.exit_count, 0) AS exit_count, s.location_type_name,
         s.parent_station, s.wheelchair_status,
         COALESCE(rc.route_count, 0) AS route_count,
         COALESCE(rc.route_links, '') AS route_links,
         CASE
           WHEN COALESCE(pc.pathway_count, 0) = 0 THEN '❌'
           WHEN COALESCE(pc.pathway_count, 0) > 0 THEN '✅'
           ELSE '❌'
         END AS pathways_status
  FROM StopsView s
  LEFT JOIN exit_counts e ON e.parent_station = s.stop_id
  LEFT JOIN pathway_counts pc ON pc.station_id = s.stop_id
  LEFT JOIN route_counts rc ON rc.station_id = s.stop_id
  WHERE s.location_type_name = 'Station'
);

CREATE OR REPLACE MACRO get_routes_table_data() AS TABLE (
  WITH stop_counts AS (
    SELECT route_id, COUNT(DISTINCT stop_id) AS stop_count
    FROM RouteStopsTable GROUP BY route_id
  ),
  station_counts AS (
    SELECT route_id, COUNT(DISTINCT station_id) AS station_count
    FROM RouteStopsTable
    WHERE station_id IS NOT NULL
    GROUP BY route_id
  ),
  shape_counts AS (
    SELECT route_id, COUNT(DISTINCT shape_id) AS shape_count
    FROM RouteShapesView GROUP BY route_id
  ),
  trip_counts AS (
    SELECT route_id, COUNT(DISTINCT trip_id) AS trip_count
    FROM TripsView GROUP BY route_id
  )
  SELECT r.row_id, r.route_id, r.agency_id, r.route_short_name, r.route_long_name,
         r.route_name, r.route_desc, r.route_type, r.route_type_name, r.route_url,
         r.route_color, r.route_text_color, r.route_color_hex, r.route_text_color_hex,
         r.route_sort_order, COALESCE(sc.stop_count, 0) AS stop_count,
         COALESCE(stc.station_count, 0) AS station_count,
         COALESCE(shc.shape_count, 0) AS shape_count, COALESCE(tc.trip_count, 0) AS trip_count,
         r.shape_points_json, COALESCE(r.status, '') AS status
  FROM RoutesView r
  LEFT JOIN stop_counts sc ON sc.route_id = r.route_id
  LEFT JOIN station_counts stc ON stc.route_id = r.route_id
  LEFT JOIN shape_counts shc ON shc.route_id = r.route_id
  LEFT JOIN trip_counts tc ON tc.route_id = r.route_id
  ORDER BY COALESCE(r.route_sort_order, TRY_CAST(r.row_id AS INTEGER), 2147483647), r.route_name, r.route_id
);

CREATE OR REPLACE MACRO get_trips_table_data() AS TABLE (
  WITH parsed_stop_times AS (
    SELECT trip_id,
           CASE WHEN NULLIF(departure_time, '') IS NULL THEN NULL
             ELSE COALESCE(TRY_CAST(SPLIT_PART(departure_time, ':', 1) AS INTEGER), 0) * 3600
                + COALESCE(TRY_CAST(SPLIT_PART(departure_time, ':', 2) AS INTEGER), 0) * 60
                + COALESCE(TRY_CAST(SPLIT_PART(departure_time, ':', 3) AS INTEGER), 0)
           END AS departure_seconds,
           CASE WHEN NULLIF(arrival_time, '') IS NULL THEN NULL
             ELSE COALESCE(TRY_CAST(SPLIT_PART(arrival_time, ':', 1) AS INTEGER), 0) * 3600
                + COALESCE(TRY_CAST(SPLIT_PART(arrival_time, ':', 2) AS INTEGER), 0) * 60
                + COALESCE(TRY_CAST(SPLIT_PART(arrival_time, ':', 3) AS INTEGER), 0)
           END AS arrival_seconds
    FROM StopTimesView
    WHERE trip_id IS NOT NULL AND trip_id != ''
  ),
  trip_times AS (
    SELECT trip_id,
           MIN(departure_seconds) AS first_departure_seconds,
           MAX(arrival_seconds) AS last_arrival_seconds
    FROM parsed_stop_times
    GROUP BY trip_id
  )
  SELECT t.trip_id, t.route_id, t.service_id, t.trip_headsign,
         t.trip_short_name, t.direction_id, t.block_id, t.shape_id,
         r.route_name, r.route_type_name, r.route_color_hex,
         tt.first_departure_seconds, tt.last_arrival_seconds
  FROM TripsView t
  LEFT JOIN RoutesView r ON r.route_id = t.route_id
  LEFT JOIN trip_times tt ON tt.trip_id = t.trip_id
  ORDER BY COALESCE(tt.first_departure_seconds, 2147483647), t.trip_id
);

-- ── Calendar table data macro ────────────────────────────────────────────────
CREATE OR REPLACE MACRO get_calendar_table_data() AS TABLE (
  SELECT cv.service_id, cv.monday, cv.tuesday, cv.wednesday, cv.thursday,
         cv.friday, cv.saturday, cv.sunday, cv.start_date, cv.end_date, cv.status
  FROM CalendarView cv
  ORDER BY cv.service_id
);

-- ── Materialized tables ─────────────────────────────────────────────────────

CREATE OR REPLACE TABLE StopsTable AS SELECT * FROM get_stops_table_data();
CREATE OR REPLACE TABLE StationsTable AS SELECT * FROM get_stations_table_data();
CREATE OR REPLACE TABLE RoutesTable AS SELECT * FROM get_routes_table_data();
CREATE OR REPLACE TABLE TripsTable AS SELECT * FROM get_trips_table_data();
CREATE OR REPLACE TABLE CalendarTable AS SELECT * FROM get_calendar_table_data();

CREATE OR REPLACE MACRO get_trips_time_bounds() AS TABLE (
  SELECT
    GREATEST(0, CAST(FLOOR(MIN(first_departure_seconds) / 300.0) * 300 AS INTEGER)) AS min_time,
    CAST(CEIL(MAX(last_arrival_seconds) / 300.0) * 300 AS INTEGER) AS max_time
  FROM TripsTable
  WHERE first_departure_seconds IS NOT NULL OR last_arrival_seconds IS NOT NULL
);

CREATE OR REPLACE MACRO get_trip_map_bounds(p_trip_id) AS TABLE (
  WITH trip_stops AS (
    SELECT s.stop_lon, s.stop_lat
    FROM StopTimesView st
    JOIN StopsView s ON s.stop_id = st.stop_id
    WHERE st.trip_id = p_trip_id AND s.stop_lon IS NOT NULL AND s.stop_lat IS NOT NULL
  ),
  b AS (
    SELECT MIN(stop_lon) AS min_lon, MAX(stop_lon) AS max_lon,
           MIN(stop_lat) AS min_lat, MAX(stop_lat) AS max_lat
    FROM trip_stops
  )
  SELECT min_lon, max_lon, min_lat, max_lat,
         (min_lon + max_lon) / 2.0 AS center_lon,
         (min_lat + max_lat) / 2.0 AS center_lat,
         fit_zoom(min_lon, max_lon, min_lat, max_lat) AS zoom
  FROM b WHERE min_lon IS NOT NULL
);

CREATE OR REPLACE MACRO get_gtfs_data_availability() AS TABLE (
  WITH counts AS (
    SELECT
      (SELECT COUNT(*) FROM StationsTable) AS stations,
      (SELECT COUNT(*) FROM StopsTable) AS stops,
      (SELECT COUNT(*) FROM PathwaysView) AS pathways,
      (SELECT COUNT(*) FROM RoutesTable) AS routes,
      (SELECT COUNT(*) FROM TripsTable) AS trips
  )
  SELECT stations, stops, pathways, routes, trips,
         stations > 0 AS has_stations,
         stops > 0 AS has_stops,
         routes > 0 AS has_routes,
         trips > 0 AS has_trips
  FROM counts
);

-- ── Pathway network view ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW pathway_network AS
SELECT p.row_id, p.pathway_id, p.from_stop_id, p.to_stop_id,
       p.pathway_mode, p.is_bidirectional, p.length, p.traversal_time,
       p.stair_count, p.max_slope, p.min_width,
       p.signposted_as, p.reversed_signposted_as,
       p.pathway_mode_name, p.direction_type,
       COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) AS from_parent_station,
       s1.stop_lat AS from_lat, s1.stop_lon AS from_lon,
       s1.location_type_name AS from_location_type_name,
       COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) AS to_parent_station,
       s2.stop_lat AS to_lat, s2.stop_lon AS to_lon,
       s2.location_type_name AS to_location_type_name,
       CASE
         WHEN s1.stop_lat IS NOT NULL AND s1.stop_lon IS NOT NULL
              AND s2.stop_lat IS NOT NULL AND s2.stop_lon IS NOT NULL
         THEN DEGREES(ATAN2(s2.stop_lon - s1.stop_lon, s2.stop_lat - s1.stop_lat))
         ELSE NULL
       END AS angle
FROM PathwaysView p
JOIN StopsView s1 ON p.from_stop_id = s1.stop_id
JOIN StopsView s2 ON p.to_stop_id = s2.stop_id;

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pathways_from_stop ON pathways(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_pathways_to_stop ON pathways(to_stop_id);
CREATE INDEX IF NOT EXISTS idx_pathways_bidirectional ON pathways(is_bidirectional);
CREATE INDEX IF NOT EXISTS idx_stops_parent_station ON stops(parent_station);
CREATE INDEX IF NOT EXISTS idx_stops_location_type ON stops(location_type);
CREATE INDEX IF NOT EXISTS idx_routes_route_id ON routes(route_id);
CREATE INDEX IF NOT EXISTS idx_edit_routes_route_id ON EditRouteTable(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_route_id ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_service_id ON trips(service_id);
CREATE INDEX IF NOT EXISTS idx_trips_trip_id ON trips(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_shape_id ON trips(shape_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_trip_id ON stop_times(trip_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_stop_id ON stop_times(stop_id);
CREATE INDEX IF NOT EXISTS idx_edit_stop_times_trip_id ON EditStopTimesTable(trip_id);
CREATE INDEX IF NOT EXISTS idx_edit_stop_times_row_id ON EditStopTimesTable(row_id);
CREATE INDEX IF NOT EXISTS idx_edit_calendar_service_id ON EditCalendarTable(service_id);
CREATE INDEX IF NOT EXISTS idx_edit_calendar_dates_service_id ON EditCalendarDatesTable(service_id);
CREATE INDEX IF NOT EXISTS idx_edit_trips_trip_id ON EditTripsTable(trip_id);
CREATE INDEX IF NOT EXISTS idx_edit_trips_route_id ON EditTripsTable(route_id);
CREATE INDEX IF NOT EXISTS idx_shapes_shape_id ON shapes(shape_id);
CREATE INDEX IF NOT EXISTS idx_calendar_service_id ON calendar(service_id);
CREATE INDEX IF NOT EXISTS idx_calendar_dates_service_id ON calendar_dates(service_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON RouteStopsTable(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_id ON RouteStopsTable(stop_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_station_id ON RouteStopsTable(station_id);

-- ── Query macros (reference StopsView/PathwaysView) ─────────────────────────

CREATE OR REPLACE MACRO get_station_info(station_id) AS TABLE (
  WITH station_base AS (
    SELECT row_id, stop_id, stop_name, stop_lat, stop_lon,
           '🔵' AS status, location_type_name, parent_station, wheelchair_status
    FROM StopsView WHERE location_type_name = 'Station' AND stop_id = station_id
  ),
  exit_counts AS (
    SELECT COUNT(*) AS exit_count FROM StopsView
    WHERE location_type_name = 'Exit/Entrance' AND parent_station = station_id
  ),
  pathway_counts AS (
    SELECT COUNT(DISTINCT p.pathway_id) AS pathway_count
    FROM PathwaysView p
    JOIN StopsView s1 ON p.from_stop_id = s1.stop_id
    JOIN StopsView s2 ON p.to_stop_id = s2.stop_id
    WHERE COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) = station_id
      AND COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) = station_id
  ),
  route_counts AS (
    SELECT COUNT(DISTINCT rsv.route_id) AS route_count,
           STRING_AGG(DISTINCT rsv.route_id || '|||' || rsv.route_name || '|||' || rsv.route_color_hex || '|||' || rsv.route_text_color_hex, '\n') AS route_links
    FROM RouteStopsTable rsv
    WHERE rsv.station_id = station_id
  )
  SELECT s.row_id, s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.status,
         COALESCE(e.exit_count, 0) AS exit_count, s.location_type_name,
         s.parent_station, s.wheelchair_status,
         COALESCE(pc.pathway_count, 0) AS pathway_count,
         COALESCE(rc.route_count, 0) AS route_count,
         COALESCE(rc.route_links, '') AS route_links,
         CASE
           WHEN COALESCE(pc.pathway_count, 0) = 0 THEN '❌'
           WHEN COALESCE(pc.pathway_count, 0) > 0 THEN '✅'
           ELSE '❌'
         END AS pathways_status
  FROM station_base s CROSS JOIN exit_counts e CROSS JOIN pathway_counts pc CROSS JOIN route_counts rc
);

CREATE OR REPLACE MACRO get_station_stops(station_id) AS TABLE (
  WITH station_stops AS (
    SELECT s.row_id, s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
           s.location_type_name, s.parent_station, s.level_id, s.wheelchair_status, s.status
    FROM StopsView s
    UNION ALL
    SELECT edt.row_id, edt.stop_id, edt.stop_name, edt.stop_lat, edt.stop_lon,
           edt.location_type_name, edt.parent_station, edt.level_id, edt.wheelchair_status, edt.status
    FROM EditStopTable edt
    WHERE edt.status = 'deleted'
      AND NOT EXISTS (SELECT 1 FROM StopsView s WHERE s.stop_id = edt.stop_id)
  )
  SELECT DISTINCT s.row_id, s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
         s.location_type_name, s.parent_station, s.level_id, s.wheelchair_status, s.status
  FROM station_stops s
  WHERE COALESCE(NULLIF(s.parent_station, ''), s.stop_id) = station_id
  ORDER BY s.stop_id
);

CREATE OR REPLACE MACRO get_route_info(p_route_id) AS TABLE (
  SELECT * FROM RoutesTable WHERE route_id = p_route_id
);

CREATE OR REPLACE MACRO get_route_stops(p_route_id) AS TABLE (
  SELECT route_id, route_name, route_color_hex, route_text_color_hex,
         stop_id, stop_name, stop_lat, stop_lon, location_type_name,
         parent_station, station_id, station_name, stop_sequence
  FROM RouteStopsTable
  WHERE route_id = p_route_id
  ORDER BY stop_sequence, stop_name, stop_id
);

CREATE OR REPLACE MACRO get_route_stations(p_route_id) AS TABLE (
  SELECT DISTINCT rsv.route_id, rsv.route_name, rsv.route_color_hex,
         rsv.route_text_color_hex, rsv.station_id, station.stop_name AS station_name,
         station.stop_lat, station.stop_lon
  FROM RouteStopsTable rsv
  JOIN StopsView station ON station.stop_id = rsv.station_id
  WHERE rsv.route_id = p_route_id
    AND station.location_type_name = 'Station'
  ORDER BY station.stop_name, rsv.station_id
);

CREATE OR REPLACE MACRO get_route_shapes(p_route_id) AS TABLE (
  SELECT route_id, route_name, route_color_hex, route_text_color_hex,
         shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence,
         shape_dist_traveled
  FROM RouteShapesView
  WHERE route_id = p_route_id
  ORDER BY shape_id, shape_pt_sequence
);

CREATE OR REPLACE MACRO get_route_stops_for_routes(p_route_ids) AS TABLE (
  SELECT route_id, route_name, route_color_hex, route_text_color_hex,
         stop_id, stop_name, stop_lat, stop_lon, location_type_name,
         parent_station, station_id, station_name, stop_sequence
  FROM RouteStopsTable
  WHERE route_id IN (SELECT unnest(p_route_ids))
  ORDER BY route_id, stop_sequence, stop_name, stop_id
);

CREATE OR REPLACE MACRO get_route_shapes_for_routes(p_route_ids) AS TABLE (
  SELECT route_id, route_name, route_color_hex, route_text_color_hex,
         shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence,
         shape_dist_traveled
  FROM RouteShapesView
  WHERE route_id IN (SELECT unnest(p_route_ids))
  ORDER BY route_id, shape_id, shape_pt_sequence
);

CREATE OR REPLACE MACRO get_stations_map_bounds() AS TABLE (
  WITH b AS (
    SELECT MIN(stop_lon) AS min_lon, MAX(stop_lon) AS max_lon,
           MIN(stop_lat) AS min_lat, MAX(stop_lat) AS max_lat
    FROM StationsTable WHERE stop_lon IS NOT NULL AND stop_lat IS NOT NULL
  )
  SELECT min_lon, max_lon, min_lat, max_lat,
         (min_lon + max_lon) / 2.0 AS center_lon,
         (min_lat + max_lat) / 2.0 AS center_lat,
         fit_zoom(min_lon, max_lon, min_lat, max_lat) AS zoom
  FROM b WHERE min_lon IS NOT NULL
);

CREATE OR REPLACE MACRO get_stops_map_bounds() AS TABLE (
  WITH b AS (
    SELECT MIN(stop_lon) AS min_lon, MAX(stop_lon) AS max_lon,
           MIN(stop_lat) AS min_lat, MAX(stop_lat) AS max_lat
    FROM StopsTable WHERE stop_lon IS NOT NULL AND stop_lat IS NOT NULL
  )
  SELECT min_lon, max_lon, min_lat, max_lat,
         (min_lon + max_lon) / 2.0 AS center_lon,
         (min_lat + max_lat) / 2.0 AS center_lat,
         fit_zoom(min_lon, max_lon, min_lat, max_lat) AS zoom
  FROM b WHERE min_lon IS NOT NULL
);

CREATE OR REPLACE MACRO get_route_map_bounds(p_route_ids) AS TABLE (
  WITH shape_b AS (
    SELECT MIN(s.shape_pt_lon) AS min_lon, MAX(s.shape_pt_lon) AS max_lon,
           MIN(s.shape_pt_lat) AS min_lat, MAX(s.shape_pt_lat) AS max_lat
    FROM shapes s
    WHERE s.shape_pt_lat IS NOT NULL AND s.shape_pt_lon IS NOT NULL
      AND s.shape_id IN (SELECT DISTINCT shape_id FROM TripsView
                         WHERE route_id IN (SELECT unnest(p_route_ids)))
  ),
  stop_b AS (
    SELECT MIN(sv.stop_lon) AS min_lon, MAX(sv.stop_lon) AS max_lon,
           MIN(sv.stop_lat) AS min_lat, MAX(sv.stop_lat) AS max_lat
    FROM RouteStopsTable rsv
    JOIN StopsView sv ON sv.stop_id = rsv.stop_id
    WHERE sv.stop_lon IS NOT NULL AND sv.stop_lat IS NOT NULL
      AND rsv.route_id IN (SELECT unnest(p_route_ids))
  ),
  combined AS (
    SELECT COALESCE(NULLIF(sb.min_lon, NULL), stb.min_lon) AS min_lon,
           COALESCE(NULLIF(sb.max_lon, NULL), stb.max_lon) AS max_lon,
           COALESCE(NULLIF(sb.min_lat, NULL), stb.min_lat) AS min_lat,
           COALESCE(NULLIF(sb.max_lat, NULL), stb.max_lat) AS max_lat
    FROM shape_b sb, stop_b stb
  )
  SELECT min_lon, max_lon, min_lat, max_lat,
         (min_lon + max_lon) / 2.0 AS center_lon,
         (min_lat + max_lat) / 2.0 AS center_lat,
         fit_zoom(min_lon, max_lon, min_lat, max_lat) AS zoom
  FROM combined WHERE min_lon IS NOT NULL
);

CREATE OR REPLACE MACRO get_all_shapes_map_bounds() AS TABLE (
  WITH b AS (
    SELECT MIN(s.shape_pt_lon) AS min_lon, MAX(s.shape_pt_lon) AS max_lon,
           MIN(s.shape_pt_lat) AS min_lat, MAX(s.shape_pt_lat) AS max_lat
    FROM shapes s
    WHERE s.shape_pt_lat IS NOT NULL AND s.shape_pt_lon IS NOT NULL
  )
  SELECT min_lon, max_lon, min_lat, max_lat,
         (min_lon + max_lon) / 2.0 AS center_lon,
         (min_lat + max_lat) / 2.0 AS center_lat,
         fit_zoom(min_lon, max_lon, min_lat, max_lat) AS zoom
  FROM b WHERE min_lon IS NOT NULL
);

CREATE OR REPLACE MACRO get_station_service_routes(p_station_id) AS TABLE (
  SELECT DISTINCT rt.*
  FROM RoutesTable rt
  JOIN RouteStopsTable rsv ON rsv.route_id = rt.route_id
  WHERE rsv.station_id = p_station_id
  ORDER BY rt.route_name, rt.route_id
);

CREATE OR REPLACE MACRO get_stop_service_routes(p_stop_id) AS TABLE (
  SELECT DISTINCT rt.*
  FROM RoutesTable rt
  JOIN RouteStopsTable rsv ON rsv.route_id = rt.route_id
  WHERE rsv.stop_id = p_stop_id
  ORDER BY rt.route_name, rt.route_id
);

CREATE OR REPLACE MACRO get_station_pathways(station_id) AS TABLE (
  WITH stop_lookup AS (
    SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
           s.location_type_name, s.parent_station, s.status
    FROM StopsView s
    UNION ALL
    SELECT edt.stop_id, edt.stop_name, edt.stop_lat, edt.stop_lon,
           edt.location_type_name, edt.parent_station, edt.status
    FROM EditStopTable edt
    WHERE edt.status = 'deleted'
      AND NOT EXISTS (SELECT 1 FROM StopsView s WHERE s.stop_id = edt.stop_id)
  )
  SELECT p.row_id, p.pathway_id, p.from_stop_id, p.to_stop_id,
         s1.stop_lat as from_lat, s1.stop_lon as from_lon,
         s2.stop_lat as to_lat, s2.stop_lon as to_lon,
         p.traversal_time, p.length, p.stair_count, p.max_slope, p.min_width,
         p.signposted_as, p.reversed_signposted_as,
         COALESCE(p.pathway_mode_name, pathway_mode_to_name(p.pathway_mode)) as pathway_mode_name,
         p.pathway_mode,
         COALESCE(p.direction_type, bidirectional_to_direction(p.is_bidirectional)) as direction_type,
         p.is_bidirectional, p.status,
         s1.location_type_name AS from_location_type_name,
         s2.location_type_name AS to_location_type_name,
         COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) AS from_parent_station,
         COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) AS to_parent_station,
         CASE
           WHEN s1.stop_lat IS NOT NULL AND s1.stop_lon IS NOT NULL
                AND s2.stop_lat IS NOT NULL AND s2.stop_lon IS NOT NULL
           THEN DEGREES(ATAN2(s2.stop_lon - s1.stop_lon, s2.stop_lat - s1.stop_lat))
           ELSE NULL
         END as angle
  FROM PathwaysView p
  LEFT JOIN stop_lookup s1 ON p.from_stop_id = s1.stop_id
  LEFT JOIN stop_lookup s2 ON p.to_stop_id = s2.stop_id
  WHERE COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) = station_id
     OR COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) = station_id
  ORDER BY p.pathway_id
);

CREATE OR REPLACE MACRO get_station_stops_for_pathways(station_id) AS TABLE (
  SELECT * FROM stops WHERE parent_station = station_id
);

)SQL"
// Second part of GTFS_INIT_SQL (split for MSVC 16KB string literal limit)
R"SQL(
-- ── Pathway aggregate macros (reference pathway_network) ────────────────────

CREATE OR REPLACE MACRO get_from_stops_available(station_id) AS TABLE (
  SELECT DISTINCT from_stop_id FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
  ORDER BY from_stop_id
);

CREATE OR REPLACE MACRO get_to_stops_available(station_id) AS TABLE (
  SELECT DISTINCT to_stop_id FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
  ORDER BY to_stop_id
);

CREATE OR REPLACE MACRO get_station_connections(station_id) AS TABLE (
  WITH directed_connections AS (
    SELECT pathway_id, from_stop_id, to_stop_id, traversal_time, length,
           pathway_mode_name, direction_type, is_bidirectional, angle,
           'forward' AS edge_direction
    FROM pathway_network
    WHERE from_parent_station = station_id AND to_parent_station = station_id
      AND to_stop_id != from_stop_id
    UNION ALL
    SELECT pathway_id, to_stop_id AS from_stop_id, from_stop_id AS to_stop_id,
           traversal_time, length, pathway_mode_name, direction_type, is_bidirectional,
           angle, 'reverse' AS edge_direction
    FROM pathway_network
    WHERE from_parent_station = station_id AND to_parent_station = station_id
      AND is_bidirectional = 1 AND to_stop_id != from_stop_id
  )
  SELECT dc.pathway_id, dc.from_stop_id,
         from_stop.stop_name AS from_stop_name,
         from_stop.location_type_name AS from_location_type_name,
         dc.to_stop_id,
         to_stop.stop_name AS to_stop_name,
         to_stop.location_type_name AS to_location_type_name,
         dc.traversal_time AS traversal_time_seconds,
         CASE WHEN dc.traversal_time IS NULL THEN 'unknown'
              ELSE CAST(dc.traversal_time AS VARCHAR) || ' seconds'
         END AS time_period,
         dc.length, dc.pathway_mode_name, dc.direction_type,
         dc.is_bidirectional, dc.edge_direction, dc.angle
  FROM directed_connections dc
  LEFT JOIN StopsView from_stop ON from_stop.stop_id = dc.from_stop_id
  LEFT JOIN StopsView to_stop ON to_stop.stop_id = dc.to_stop_id
  ORDER BY dc.from_stop_id, dc.to_stop_id, dc.pathway_id, dc.edge_direction
);

CREATE OR REPLACE MACRO get_pathway_modes_available(station_id) AS TABLE (
  SELECT DISTINCT pathway_mode_name FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
  ORDER BY pathway_mode_name
);

CREATE OR REPLACE MACRO get_direction_types_available(station_id) AS TABLE (
  SELECT DISTINCT direction_type FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
  ORDER BY direction_type
);

CREATE OR REPLACE MACRO get_time_range(station_id) AS TABLE (
  SELECT MIN(traversal_time) AS min_time, MAX(traversal_time) AS max_time
  FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
    AND traversal_time IS NOT NULL
);

CREATE OR REPLACE MACRO get_all_pathway_aggregates(station_id) AS TABLE (
  WITH aggregates AS (
    SELECT
      LIST(DISTINCT from_stop_id ORDER BY from_stop_id) AS from_stops,
      LIST(DISTINCT to_stop_id ORDER BY to_stop_id) AS to_stops,
      LIST(DISTINCT pathway_mode_name ORDER BY pathway_mode_name) AS modes,
      LIST(DISTINCT direction_type ORDER BY direction_type) AS directions,
      MIN(traversal_time) AS min_time,
      MAX(traversal_time) AS max_time
    FROM pathway_network
    WHERE from_parent_station = station_id AND to_parent_station = station_id
  )
  SELECT * FROM aggregates
);

CREATE OR REPLACE MACRO get_pathways_filtered(
  station_id, to_stop, from_stop, min_time, max_time,
  include_null_time, direction_filter, pathway_types
) AS TABLE (
  SELECT pathway_id, from_lat, from_lon, to_lat, to_lon,
         from_stop_id, to_stop_id, traversal_time,
         pathway_mode_name, direction_type, angle
  FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (min_time IS NULL OR (
      (traversal_time >= min_time AND traversal_time <= max_time)
      OR (include_null_time = FALSE AND traversal_time IS NULL)
    ))
    AND (direction_filter IS NULL OR direction_type = direction_filter)
    AND (pathway_types IS NULL OR pathway_mode_name IN (SELECT unnest(pathway_types)))
);

CREATE OR REPLACE MACRO get_to_stops(station_id, from_stop, min_time, max_time) AS TABLE (
  SELECT DISTINCT to_stop_id FROM pathway_network
  WHERE to_parent_station = station_id AND from_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (min_time IS NULL OR (traversal_time >= min_time AND traversal_time <= max_time))
);

CREATE OR REPLACE MACRO get_from_stops(station_id, to_stop, min_time, max_time) AS TABLE (
  SELECT DISTINCT from_stop_id FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (min_time IS NULL OR (traversal_time >= min_time AND traversal_time <= max_time))
);

CREATE OR REPLACE MACRO get_direction_types(
  station_id, to_stop, from_stop, min_time, max_time, include_null_time
) AS TABLE (
  SELECT DISTINCT direction_type FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (min_time IS NULL OR (
      (traversal_time >= min_time AND traversal_time <= max_time)
      OR (include_null_time = FALSE AND traversal_time IS NULL)
    ))
);

CREATE OR REPLACE MACRO get_pathway_types(station_id, to_stop, from_stop) AS TABLE (
  SELECT DISTINCT pathway_mode_name FROM pathway_network
  WHERE from_parent_station = station_id AND to_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (from_stop IS NULL OR from_stop_id = from_stop)
);

CREATE OR REPLACE MACRO get_time_interval_ranges(station_id, to_stop, from_stop) AS TABLE (
  WITH valid_traversals AS (
    SELECT traversal_time FROM pathway_network
    WHERE from_parent_station = station_id AND to_parent_station = station_id
      AND (to_stop IS NULL OR to_stop_id = to_stop)
      AND (from_stop IS NULL OR from_stop_id = from_stop)
      AND traversal_time IS NOT NULL AND traversal_time > 0
  ),
  time_stats AS (
    SELECT MIN(traversal_time) AS min_time, MAX(traversal_time) AS max_time
    FROM valid_traversals
  ),
  bins AS (
    SELECT ts.min_time, ts.max_time,
           LN(ts.min_time) AS log_min_time, LN(ts.max_time) AS log_max_time,
           CASE WHEN LN(ts.max_time) = LN(ts.min_time) THEN NULL
                ELSE (LN(ts.max_time) - LN(ts.min_time)) / 5.0
           END AS interval_size
    FROM time_stats ts
  ),
  ranges AS (
    SELECT b.log_min_time + b.interval_size * generate_series AS range_start_log,
           b.log_min_time + b.interval_size * (generate_series + 1) AS range_end_log
    FROM bins b, generate_series(0, 4)
    WHERE b.interval_size IS NOT NULL
  ),
  final_ranges AS (
    SELECT EXP(r.range_start_log) AS min_value, EXP(r.range_end_log) AS max_value
    FROM ranges r
  )
  SELECT DISTINCT
    CASE WHEN min_value % 1 = 0 THEN CAST(min_value AS INT) ELSE ROUND(min_value, 2) END AS min_value,
    CASE WHEN max_value % 1 = 0 THEN CAST(max_value AS INT) ELSE ROUND(max_value, 2) END AS max_value
  FROM final_ranges ORDER BY min_value
);

-- ── Pathfinding macros (reference pathway_network) ──────────────────────────

CREATE OR REPLACE MACRO find_shortest_path(p_station_id, start_stop, end_stop, max_hops := 10) AS TABLE (
  WITH RECURSIVE path_search AS (
    SELECT from_stop_id AS current_stop, to_stop_id AS next_stop,
           pathway_id, pathway_mode_name,
           COALESCE(traversal_time, 0) AS segment_time,
           COALESCE(traversal_time, 0) AS total_time,
           1 AS hop_count,
           ARRAY[from_stop_id] AS visited_stops,
           ARRAY[pathway_id] AS path_ids,
           from_stop_id || ' -> ' || to_stop_id AS path_description
    FROM pathway_network
    WHERE from_parent_station = p_station_id AND to_parent_station = p_station_id
      AND from_stop_id = start_stop AND to_stop_id != from_stop_id
    UNION ALL
    SELECT ps.next_stop AS current_stop, pr.to_stop_id AS next_stop,
           pr.pathway_id, pr.pathway_mode_name,
           COALESCE(pr.traversal_time, 0) AS segment_time,
           ps.total_time + COALESCE(pr.traversal_time, 0) AS total_time,
           ps.hop_count + 1 AS hop_count,
           array_append(ps.visited_stops, pr.from_stop_id) AS visited_stops,
           array_append(ps.path_ids, pr.pathway_id) AS path_ids,
           ps.path_description || ' -> ' || pr.to_stop_id AS path_description
    FROM path_search ps
    JOIN pathway_network pr
      ON ps.next_stop = pr.from_stop_id
      AND pr.from_parent_station = p_station_id AND pr.to_parent_station = p_station_id
      AND pr.to_stop_id != pr.from_stop_id
    WHERE ps.hop_count < max_hops
      AND NOT list_contains(ps.visited_stops, pr.to_stop_id)
  )
  SELECT current_stop, next_stop AS destination, total_time, hop_count,
         path_ids, visited_stops, path_description
  FROM path_search WHERE next_stop = end_stop
  ORDER BY total_time ASC, hop_count ASC LIMIT 1
);

CREATE OR REPLACE MACRO find_reachable_stops(p_station_id, start_stop, max_time := NULL, max_hops := 5) AS TABLE (
  WITH RECURSIVE reachability AS (
    SELECT to_stop_id AS reachable_stop,
           COALESCE(traversal_time, 0) AS total_time,
           1 AS hop_count,
           ARRAY[from_stop_id, to_stop_id] AS path
    FROM pathway_network
    WHERE from_parent_station = p_station_id AND to_parent_station = p_station_id
      AND from_stop_id = start_stop AND to_stop_id != from_stop_id
    UNION
    SELECT pr.to_stop_id AS reachable_stop,
           r.total_time + COALESCE(pr.traversal_time, 0) AS total_time,
           r.hop_count + 1 AS hop_count,
           array_append(r.path, pr.to_stop_id) AS path
    FROM reachability r
    JOIN pathway_network pr
      ON r.reachable_stop = pr.from_stop_id
      AND pr.from_parent_station = p_station_id AND pr.to_parent_station = p_station_id
      AND pr.to_stop_id != pr.from_stop_id
    WHERE r.hop_count < max_hops
      AND NOT list_contains(r.path, pr.to_stop_id)
      AND (max_time IS NULL OR r.total_time + COALESCE(pr.traversal_time, 0) <= max_time)
  )
  SELECT DISTINCT reachable_stop, MIN(total_time) AS min_time, MIN(hop_count) AS min_hops
  FROM reachability GROUP BY reachable_stop
  ORDER BY min_time, min_hops
);

CREATE OR REPLACE MACRO find_all_paths(p_station_id, start_stop, end_stop, max_hops := 5) AS TABLE (
  WITH RECURSIVE all_paths AS (
    SELECT from_stop_id, to_stop_id,
           COALESCE(traversal_time, 0) AS total_time,
           1 AS hop_count,
           ARRAY[from_stop_id] AS visited_stops,
           ARRAY[pathway_id] AS path_ids,
           from_stop_id || ' -> ' || to_stop_id AS route
    FROM pathway_network
    WHERE from_parent_station = p_station_id AND to_parent_station = p_station_id
      AND from_stop_id = start_stop AND to_stop_id != from_stop_id
    UNION ALL
    SELECT ap.from_stop_id, pr.to_stop_id,
           ap.total_time + COALESCE(pr.traversal_time, 0) AS total_time,
           ap.hop_count + 1 AS hop_count,
           array_append(ap.visited_stops, pr.from_stop_id) AS visited_stops,
           array_append(ap.path_ids, pr.pathway_id) AS path_ids,
           ap.route || ' -> ' || pr.to_stop_id AS route
    FROM all_paths ap
    JOIN pathway_network pr
      ON ap.to_stop_id = pr.from_stop_id
      AND pr.from_parent_station = p_station_id AND pr.to_parent_station = p_station_id
      AND pr.to_stop_id != pr.from_stop_id
    WHERE ap.hop_count < max_hops
      AND NOT list_contains(ap.visited_stops, pr.to_stop_id)
  )
  SELECT total_time, hop_count, path_ids, route
  FROM all_paths WHERE to_stop_id = end_stop
  ORDER BY total_time, hop_count
);

CREATE OR REPLACE MACRO get_direct_pathways(p_station_id, from_stop := NULL, to_stop := NULL, direction_filter := NULL, pathway_types := NULL) AS TABLE (
  SELECT pathway_id, from_stop_id, to_stop_id, from_lat, from_lon, to_lat, to_lon,
         traversal_time, pathway_mode_name, pathway_mode, direction_type, is_bidirectional
  FROM pathway_network
  WHERE from_parent_station = p_station_id AND to_parent_station = p_station_id
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (direction_filter IS NULL OR direction_type = direction_filter)
    AND (pathway_types IS NULL OR list_contains(pathway_types, pathway_mode_name))
);

CREATE OR REPLACE MACRO get_station_routes(p_station_id) AS TABLE (
  WITH RECURSIVE shortest_paths AS (
    SELECT p.from_stop_id AS start_stop, p.to_stop_id AS end_stop,
           p.traversal_time AS total_time, 1 AS hop_count,
           ARRAY[p.from_stop_id] AS path_stops
    FROM pathway_network p
    WHERE p.from_parent_station = p_station_id AND p.to_parent_station = p_station_id
      AND p.from_stop_id != p.to_stop_id AND p.traversal_time IS NOT NULL
    UNION
    SELECT sp.start_stop, p.to_stop_id AS end_stop,
           sp.total_time + p.traversal_time AS total_time,
           sp.hop_count + 1 AS hop_count,
           array_append(sp.path_stops, p.to_stop_id) AS path_stops
    FROM shortest_paths sp
    JOIN pathway_network p
      ON sp.end_stop = p.from_stop_id
      AND p.from_parent_station = p_station_id AND p.to_parent_station = p_station_id
      AND p.traversal_time IS NOT NULL
    WHERE sp.hop_count < 8 AND p.to_stop_id != sp.start_stop
      AND NOT list_contains(sp.path_stops, p.to_stop_id)
      AND NOT EXISTS (
        SELECT 1 FROM shortest_paths sp2
        WHERE sp2.start_stop = sp.start_stop AND sp2.end_stop = p.to_stop_id
          AND sp2.total_time <= sp.total_time + p.traversal_time
      )
  ),
  min_paths AS (
    SELECT start_stop, end_stop, MIN(total_time) AS shortest_time
    FROM shortest_paths GROUP BY start_stop, end_stop
  ),
  null_connections AS (
    SELECT DISTINCT p.from_stop_id AS start_stop, p.to_stop_id AS end_stop,
           NULL::DOUBLE AS shortest_time
    FROM pathway_network p
    WHERE p.from_parent_station = p_station_id AND p.to_parent_station = p_station_id
      AND p.from_stop_id != p.to_stop_id AND p.traversal_time IS NULL
  ),
  all_routes AS (
    SELECT * FROM min_paths
    UNION ALL
    SELECT * FROM null_connections
    WHERE NOT EXISTS (
      SELECT 1 FROM min_paths mp
      WHERE mp.start_stop = null_connections.start_stop
        AND mp.end_stop = null_connections.end_stop
    )
  )
  SELECT ar.start_stop, ar.end_stop, ar.shortest_time,
         s1.location_type_name AS from_location_type_name,
         s2.location_type_name AS to_location_type_name
  FROM all_routes ar
  LEFT JOIN stops s1 ON s1.stop_id = ar.start_stop
  LEFT JOIN stops s2 ON s2.stop_id = ar.end_stop
  ORDER BY ar.start_stop, ar.end_stop
);

CREATE OR REPLACE MACRO route_band_offset_deg(band_index, band_count, spacing_meters) AS (
  CASE
    WHEN band_count <= 1 THEN 0.0
    ELSE (spacing_meters * (band_index - (band_count - 1) / 2.0)) / 111320.0
  END
);

CREATE OR REPLACE MACRO get_route_corridors(p_route_ids, snap_precision := 4) AS TABLE (
  WITH pts AS (
    SELECT route_id, route_type, shape_id, shape_pt_sequence, shape_pt_lat, shape_pt_lon
    FROM RouteShapesView
    WHERE route_id IN (SELECT unnest(p_route_ids))
  ),
  segs AS (
    SELECT route_id, route_type, shape_id,
           shape_pt_lat AS lat1, shape_pt_lon AS lon1,
           LEAD(shape_pt_lat) OVER w AS lat2,
           LEAD(shape_pt_lon) OVER w AS lon2
    FROM pts
    WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence)
  ),
  corridor AS (
    SELECT route_id, route_type,
           ROUND(lat1, snap_precision) AS a_lat, ROUND(lon1, snap_precision) AS a_lon,
           ROUND(lat2, snap_precision) AS b_lat, ROUND(lon2, snap_precision) AS b_lon,
           CASE WHEN ROUND(lat1, snap_precision) < ROUND(lat2, snap_precision)
                  OR (ROUND(lat1, snap_precision) = ROUND(lat2, snap_precision)
                      AND ROUND(lon1, snap_precision) <= ROUND(lon2, snap_precision))
             THEN CAST(ROUND(lat1, snap_precision) AS VARCHAR) || ',' || CAST(ROUND(lon1, snap_precision) AS VARCHAR) || '|' ||
                  CAST(ROUND(lat2, snap_precision) AS VARCHAR) || ',' || CAST(ROUND(lon2, snap_precision) AS VARCHAR)
             ELSE CAST(ROUND(lat2, snap_precision) AS VARCHAR) || ',' || CAST(ROUND(lon2, snap_precision) AS VARCHAR) || '|' ||
                  CAST(ROUND(lat1, snap_precision) AS VARCHAR) || ',' || CAST(ROUND(lon1, snap_precision) AS VARCHAR)
           END AS corridor_key
    FROM segs
    WHERE lat2 IS NOT NULL AND lon2 IS NOT NULL
  ),
  corridor_routes AS (
    SELECT DISTINCT corridor_key, route_id, route_type FROM corridor
  ),
  banded AS (
    SELECT corridor_key, route_id,
           CAST(ROW_NUMBER() OVER (PARTITION BY corridor_key ORDER BY route_type, route_id) - 1 AS INTEGER) AS band_index,
           CAST(COUNT(*) OVER (PARTITION BY corridor_key) AS INTEGER) AS band_count
    FROM corridor_routes
  )
  SELECT b.corridor_key, b.route_id, b.band_index, b.band_count
  FROM banded b
  WHERE b.band_count > 1
  ORDER BY b.corridor_key, b.band_index
);

CREATE TABLE IF NOT EXISTS RouteShapeLanesTable (
  route_id VARCHAR,
  shape_id VARCHAR,
  shape_pt_sequence DOUBLE,
  lat DOUBLE,
  lon DOUBLE,
  coslat DOUBLE,
  ux DOUBLE,
  uy DOUBLE,
  band_index BIGINT,
  band_count BIGINT,
  shift_s DOUBLE,
  slot_s DOUBLE,
  plat DOUBLE,
  plon DOUBLE,
  nlat DOUBLE,
  nlon DOUBLE
);

CREATE OR REPLACE MACRO prepare_route_shape_lanes(
  p_route_ids, spacing_meters := 16.0, snap_precision := 4, simplify_meters := 0.5,
  reach_meters := 18.0, p_kind := 'route'
) AS TABLE (
  WITH cand AS (
    SELECT CASE WHEN p_kind = 'trip' THEN t.trip_id ELSE t.route_id END AS route_id,
           t.shape_id, COUNT(*) AS tn
    FROM TripsView t
    WHERE t.shape_id IS NOT NULL AND t.shape_id != ''
      AND (CASE WHEN p_kind = 'trip' THEN t.trip_id ELSE t.route_id END)
            IN (SELECT unnest(p_route_ids))
    GROUP BY 1, 2
  ),
  shape_len AS (
    SELECT shape_id, COUNT(*) AS n
    FROM shapes
    WHERE shape_pt_lat IS NOT NULL AND shape_pt_lon IS NOT NULL
      AND shape_id IN (SELECT shape_id FROM cand)
    GROUP BY shape_id
  ),
  scored AS (
    SELECT c.route_id, c.shape_id, c.tn, sl.n,
           MAX(sl.n) OVER (PARTITION BY c.route_id) AS mx
    FROM cand c JOIN shape_len sl USING (shape_id)
  ),
  rep AS (
    SELECT route_id, shape_id FROM (
      SELECT *, DENSE_RANK() OVER (PARTITION BY route_id ORDER BY n DESC, tn DESC, shape_id) AS rk
      FROM scored WHERE n >= 0.8 * mx
    ) WHERE rk = 1
  ),
  simplified AS (
    SELECT r.route_id, r.shape_id,
           ST_Simplify(
             ST_RemoveRepeatedPoints(
               ST_MakeLine(list(ST_Point(s.shape_pt_lon, s.shape_pt_lat)
                                ORDER BY s.shape_pt_sequence))
             ),
             simplify_meters / 111320.0
           ) AS geom
    FROM rep r
    JOIN shapes s ON s.shape_id = r.shape_id
    WHERE s.shape_pt_lat IS NOT NULL AND s.shape_pt_lon IS NOT NULL
    GROUP BY r.route_id, r.shape_id
    HAVING COUNT(*) >= 2
  ),
  exploded AS (
    SELECT route_id, shape_id,
           UNNEST(ST_Dump(ST_Points(geom))) AS d
    FROM simplified
  ),
  clean AS (
    SELECT e.route_id, COALESCE(rv.route_type, rv2.route_type) AS route_type, e.shape_id,
           e.d.path[1] AS shape_pt_sequence,
           ST_Y(e.d.geom) AS lat, ST_X(e.d.geom) AS lon
    FROM exploded e
    LEFT JOIN RoutesView rv ON p_kind = 'route' AND rv.route_id = e.route_id
    LEFT JOIN (SELECT t.trip_id, MIN(r2.route_type) AS route_type
               FROM TripsView t JOIN RoutesView r2 USING (route_id) GROUP BY t.trip_id) rv2
      ON p_kind = 'trip' AND rv2.trip_id = e.route_id
  ),
  despiked AS (
    SELECT route_id, route_type, shape_id, shape_pt_sequence, lat, lon
    FROM (
      SELECT *,
             CASE WHEN plat IS NULL OR nlat IS NULL THEN 0.0 ELSE
               DEGREES(ATAN2(
                 ((lon - plon) * cl) * (nlat - lat) - (lat - plat) * ((nlon - lon) * cl),
                 ((lon - plon) * cl) * ((nlon - lon) * cl) + (lat - plat) * (nlat - lat)))
             END AS leg_turn,
             CASE WHEN plat IS NULL THEN 1e9 ELSE
               SQRT(POWER((lon - plon) * cl * 111320.0, 2) + POWER((lat - plat) * 111320.0, 2))
             END AS leg_in_m,
             CASE WHEN nlat IS NULL THEN 1e9 ELSE
               SQRT(POWER((nlon - lon) * cl * 111320.0, 2) + POWER((nlat - lat) * 111320.0, 2))
             END AS leg_out_m
      FROM (
        SELECT *, COS(RADIANS(lat)) AS cl,
               LAG(lat)  OVER w AS plat, LAG(lon)  OVER w AS plon,
               LEAD(lat) OVER w AS nlat, LEAD(lon) OVER w AS nlon
        FROM clean
        WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence)
      )
    )
    WHERE NOT (ABS(leg_turn) >= 150.0 AND LEAST(leg_in_m, leg_out_m) <= 15.0)
  ),
  denoised AS (
    SELECT route_id, route_type, shape_id, shape_pt_sequence,
           CASE WHEN dev_m < 1.5 THEN alat ELSE lat END AS lat,
           CASE WHEN dev_m < 1.5 THEN alon ELSE lon END AS lon
    FROM (
      SELECT *,
             SQRT(POWER((alon - lon) * COS(RADIANS(lat)), 2) + POWER(alat - lat, 2)) * 111320.0 AS dev_m
      FROM (
        SELECT route_id, route_type, shape_id, shape_pt_sequence, lat, lon,
               AVG(lat) OVER w AS alat, AVG(lon) OVER w AS alon
        FROM despiked
        WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                     ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)
      )
    )
  ),
  dense AS (
    SELECT d.route_id, d.route_type, d.shape_id,
           d.shape_pt_sequence + CAST(g.j AS DOUBLE) / d.k AS shape_pt_sequence,
           d.lat + (d.nlat - d.lat) * (CAST(g.j AS DOUBLE) / d.k) AS lat,
           d.lon + (d.nlon - d.lon) * (CAST(g.j AS DOUBLE) / d.k) AS lon
    FROM (
      SELECT *, GREATEST(1, LEAST(120, CAST(CEIL(
               SQRT(POWER((nlon - lon) * COS(RADIANS(lat)) * 111320.0, 2)
                  + POWER((nlat - lat) * 111320.0, 2)) / 20.0) AS INTEGER))) AS k
      FROM (
        SELECT route_id, route_type, shape_id,
               CAST(shape_pt_sequence AS DOUBLE) AS shape_pt_sequence, lat, lon,
               LEAD(lat) OVER w AS nlat, LEAD(lon) OVER w AS nlon
        FROM denoised WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence)
      ) WHERE nlat IS NOT NULL
    ) d
    JOIN (SELECT UNNEST(range(0, 120)) AS j) g ON g.j < d.k
    UNION ALL
    SELECT route_id, route_type, shape_id, CAST(shape_pt_sequence AS DOUBLE), lat, lon
    FROM (SELECT *, LEAD(lat) OVER w AS nlat
          FROM denoised WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence))
    WHERE nlat IS NULL
  ),
  neigh AS (
    SELECT *, LEAD(lat) OVER w AS nlat, LEAD(lon) OVER w AS nlon,
              LAG(lat)  OVER w AS plat, LAG(lon)  OVER w AS plon
    FROM dense WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence)
  ),
  dir AS (
    SELECT *, COS(RADIANS(lat)) AS coslat,
           (COALESCE(nlon, lon) - COALESCE(plon, lon)) * COS(RADIANS(lat)) AS de,
           (COALESCE(nlat, lat) - COALESCE(plat, lat)) AS dn
    FROM neigh
  ),
  vtx AS MATERIALIZED (
    SELECT route_id, route_type, shape_id, shape_pt_sequence, lat, lon, coslat,
           ROW_NUMBER() OVER () AS vid,
           ROW_NUMBER() OVER (PARTITION BY route_id, shape_id
                              ORDER BY shape_pt_sequence) AS vidx,
           CASE WHEN SQRT(de*de + dn*dn) > 0 THEN de / SQRT(de*de + dn*dn) ELSE 0.0 END AS ux,
           CASE WHEN SQRT(de*de + dn*dn) > 0 THEN dn / SQRT(de*de + dn*dn) ELSE 0.0 END AS uy,
           CAST(FLOOR(lat / (reach_meters / 111320.0)) AS BIGINT) AS gy,
           CAST(FLOOR((lon * coslat) / (reach_meters / 111320.0)) AS BIGINT) AS gx
    FROM dir
  ),
  probe AS MATERIALIZED (
    SELECT a.vid, a.gy + oy.dy AS pgy, a.gx + ox.dx AS pgx
    FROM vtx a
    CROSS JOIN (SELECT UNNEST([-1, 0, 1]) AS dy) oy
    CROSS JOIN (SELECT UNNEST([-1, 0, 1]) AS dx) ox
  ),
  nbr AS (
    SELECT a.route_id, a.shape_id, a.shape_pt_sequence, a.vidx, b.route_id AS nbr_route,
           b.shape_id AS nbr_shape, b.shape_pt_sequence AS nbr_seq,
           CASE WHEN -a.uy + 0.37 * a.ux > 0 THEN 1.0 ELSE -1.0 END AS cx,
           ((b.lon - a.lon) * a.coslat * 111320.0) * a.ux + ((b.lat - a.lat) * 111320.0) * a.uy AS along,
           -((b.lon - a.lon) * a.coslat * 111320.0) * a.uy + ((b.lat - a.lat) * 111320.0) * a.ux AS perp,
           a.ux * b.ux + a.uy * b.uy AS hdg
    FROM probe p
    JOIN vtx b
      ON b.gy = p.pgy
     AND b.gx = p.pgx
    JOIN vtx a
      ON a.vid = p.vid
     AND b.route_id <> a.route_id
  ),
  strands AS (
    SELECT route_id, shape_id, shape_pt_sequence, vidx, nbr_route, nbr_shape, nbr_seq, perp, hdg, cx
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY route_id, shape_id, shape_pt_sequence, nbr_route
                                   ORDER BY ABS(along)) AS rn
      FROM nbr
      WHERE ABS(along) <= 50.0 AND ABS(perp) <= reach_meters AND ABS(hdg) >= 0.82
    ) WHERE rn = 1
  ),
  strands_s AS MATERIALIZED (
    SELECT *, AVG(perp) OVER (PARTITION BY route_id, shape_id, nbr_route
                              ORDER BY shape_pt_sequence
                              ROWS BETWEEN 15 PRECEDING AND 15 FOLLOWING) AS perp_s,
           vidx - ROW_NUMBER() OVER (PARTITION BY route_id, shape_id, nbr_route
                                     ORDER BY vidx) AS run_id
    FROM strands
  ),
  pair_med AS (
    SELECT route_id, shape_id, nbr_route, run_id, MEDIAN(perp_s) AS med_perp
    FROM strands_s
    GROUP BY route_id, shape_id, nbr_route, run_id
  ),
  all_strands AS MATERIALIZED (
    SELECT route_id, shape_id, shape_pt_sequence, route_id AS nbr_route, shape_id AS nbr_shape,
           shape_pt_sequence AS nbr_seq, 0.0 AS perp, 0.0 AS perp_s, 1.0 AS hdg,
           CASE WHEN -uy + 0.37 * ux > 0 THEN 1.0 ELSE -1.0 END AS cx,
           CAST(NULL AS BIGINT) AS run_id
    FROM vtx
    UNION ALL
    SELECT route_id, shape_id, shape_pt_sequence, nbr_route, nbr_shape, nbr_seq, perp, perp_s, hdg, cx, run_id FROM strands_s
  ),
  anchor AS (
    SELECT route_id, shape_id, shape_pt_sequence,
           arg_min(CASE WHEN hdg >= 0 THEN 1.0 ELSE -1.0 END, nbr_route) AS sgn
    FROM all_strands
    GROUP BY route_id, shape_id, shape_pt_sequence
  ),
  bundle0 AS MATERIALIZED (
    SELECT s.route_id, s.shape_id, s.shape_pt_sequence,
           CAST(COUNT(*) AS INTEGER) AS band_count,
           CAST(COUNT(*) FILTER (WHERE s.nbr_route <> s.route_id AND
                (COALESCE(p.med_perp, s.perp_s) * k.sgn < -8.0
                 OR (ABS(COALESCE(p.med_perp, s.perp_s)) <= 8.0
                     AND s.nbr_route < s.route_id)))
                AS INTEGER) AS band_index,
           MAX(k.sgn) AS sgn,
           median(s.perp_s) AS shift_raw
    FROM all_strands s
    JOIN anchor k USING (route_id, shape_id, shape_pt_sequence)
    LEFT JOIN pair_med p
      ON p.route_id = s.route_id AND p.shape_id = s.shape_id
     AND p.nbr_route = s.nbr_route AND p.run_id = s.run_id
    GROUP BY s.route_id, s.shape_id, s.shape_pt_sequence
  ),
  ranked AS (
    SELECT s.route_id, s.shape_id, s.shape_pt_sequence,
           CAST(COUNT(*) FILTER (WHERE
             (CASE WHEN n.sgn * (CASE WHEN s.hdg >= 0 THEN 1.0 ELSE -1.0 END) = r.sgn
                   THEN n.band_index ELSE n.band_count - 1 - n.band_index END) < r.band_index
             OR ((CASE WHEN n.sgn * (CASE WHEN s.hdg >= 0 THEN 1.0 ELSE -1.0 END) = r.sgn
                        THEN n.band_index ELSE n.band_count - 1 - n.band_index END) = r.band_index
                 AND s.nbr_route < s.route_id)) AS INTEGER) AS lane
    FROM all_strands s
    JOIN bundle0 r
      ON r.route_id = s.route_id AND r.shape_id = s.shape_id AND r.shape_pt_sequence = s.shape_pt_sequence
    JOIN bundle0 n
      ON n.route_id = s.nbr_route AND n.shape_id = s.nbr_shape AND n.shape_pt_sequence = s.nbr_seq
    WHERE s.nbr_route <> s.route_id
    GROUP BY s.route_id, s.shape_id, s.shape_pt_sequence
  ),
  bundle AS (
    SELECT b.route_id, b.shape_id, b.shape_pt_sequence, b.band_count,
           COALESCE(k.lane, 0) AS band_index, b.sgn, b.shift_raw
    FROM bundle0 b
    LEFT JOIN ranked k USING (route_id, shape_id, shape_pt_sequence)
  ),
  laterals AS (
    SELECT v.route_id, v.shape_id, v.shape_pt_sequence, v.lat, v.lon, v.coslat, v.ux, v.uy,
           b.band_index, b.band_count,
           AVG(b.shift_raw) OVER wsm AS shift_s,
           AVG((b.band_index - (b.band_count - 1) / 2.0) * b.sgn) OVER wsm AS slot_s,
           LAG(v.lat)  OVER w AS plat, LAG(v.lon)  OVER w AS plon,
           LEAD(v.lat) OVER w AS nlat, LEAD(v.lon) OVER w AS nlon
    FROM vtx v
    JOIN bundle b USING (route_id, shape_id, shape_pt_sequence)
    WINDOW w AS (PARTITION BY v.route_id, v.shape_id ORDER BY v.shape_pt_sequence),
           wsm AS (PARTITION BY v.route_id, v.shape_id ORDER BY v.shape_pt_sequence
                   ROWS BETWEEN 5 PRECEDING AND 5 FOLLOWING)
  )
  SELECT * FROM laterals
);

CREATE OR REPLACE MACRO finish_route_shape_bands(p_route_ids) AS TABLE (
  WITH laterals AS (
    SELECT * FROM RouteShapeLanesTable
    WHERE route_id IN (SELECT unnest(p_route_ids))
  ),
  radius AS (
    SELECT *,
      CASE WHEN plat IS NULL OR nlat IS NULL THEN 1e9 ELSE
        ( SQRT(POWER((lon - plon) * coslat * 111320.0, 2) + POWER((lat - plat) * 111320.0, 2))
        * SQRT(POWER((nlon - lon) * coslat * 111320.0, 2) + POWER((nlat - lat) * 111320.0, 2))
        * SQRT(POWER((nlon - plon) * coslat * 111320.0, 2) + POWER((nlat - plat) * 111320.0, 2)) )
        / GREATEST(2.0 * ABS( ((lon - plon) * coslat * 111320.0) * ((nlat - plat) * 111320.0)
                             - ((lat - plat) * 111320.0) * ((nlon - plon) * coslat * 111320.0) ), 1e-6)
      END AS turn_r,
      DEGREES(ATAN2(ux * LEAD(uy) OVER wd - uy * LEAD(ux) OVER wd,
                    ux * LEAD(ux) OVER wd + uy * LEAD(uy) OVER wd)) AS dh,
      CASE WHEN nlat IS NULL THEN 0.0 ELSE
        SQRT(POWER((nlon - lon) * coslat * 111320.0, 2) + POWER((nlat - lat) * 111320.0, 2))
      END AS seg_m
    FROM laterals
    WINDOW wd AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence)
  ),
  radius_w AS (
    SELECT *,
      MIN(turn_r) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                        ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING) AS turn_rw,
      SUM(seg_m) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                       ROWS UNBOUNDED PRECEDING) AS cum_m,
      SUM(seg_m) OVER (PARTITION BY route_id, shape_id) AS total_m,
      CASE WHEN ABS(COALESCE(dh, 0.0)) >= 150.0 THEN 0.0 ELSE COALESCE(dh, 0.0) END AS dh_s
    FROM radius
  ),
  gridv AS (
    SELECT route_id, shape_id, shape_pt_sequence, lat, lon, coslat, cum_m,
           CAST(FLOOR(lat * 111320.0 / 30.0) AS BIGINT) AS gy,
           CAST(FLOOR(lon * coslat * 111320.0 / 30.0) AS BIGINT) AS gx
    FROM radius_w
  ),
  probe AS (
    SELECT g.*, g.gx + o.dx AS px, g.gy + o.dy AS py
    FROM gridv g
    CROSS JOIN (SELECT UNNEST([-1, 0, 1]) AS dx) ox
    CROSS JOIN (SELECT UNNEST([-1, 0, 1]) AS dy) oy
    CROSS JOIN LATERAL (SELECT ox.dx AS dx, oy.dy AS dy) o
  ),
  closure AS (
    SELECT a.route_id, a.shape_id, a.shape_pt_sequence, MAX(b.cum_m) AS loop_to
    FROM probe a
    JOIN gridv b
      ON b.route_id = a.route_id AND b.shape_id = a.shape_id
     AND b.gx = a.px AND b.gy = a.py
    WHERE b.cum_m - a.cum_m BETWEEN 80.0 AND 700.0
      AND SQRT(POWER((b.lon - a.lon) * a.coslat * 111320.0, 2)
             + POWER((b.lat - a.lat) * 111320.0, 2)) <= 30.0
    GROUP BY 1, 2, 3
  ),
  radius_t AS (
    SELECT *,
      SUM(CASE WHEN cum_m <= 300.0 THEN dh_s END) OVER (PARTITION BY route_id, shape_id) AS turn_start,
      SUM(CASE WHEN total_m - cum_m <= 300.0 THEN dh_s END) OVER (PARTITION BY route_id, shape_id) AS turn_end,
      SUM(CASE WHEN total_m - cum_m <= 300.0 THEN ABS(dh_s) ELSE 0.0 END)
        OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
              ROWS UNBOUNDED PRECEDING) AS bend_end,
      SUM(CASE WHEN cum_m <= 300.0 THEN ABS(dh_s) ELSE 0.0 END)
        OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence DESC
              ROWS UNBOUNDED PRECEDING) AS bend_start,
      SUM(dh_s) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                      ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING) AS turn_prev,
      SUM(dh_s) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                      ROWS BETWEEN CURRENT ROW AND 9 FOLLOWING) AS turn_next,
      SUM(dh_s) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                      ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING) AS turn_hairpin,
      MAX(c.loop_to) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                           ROWS UNBOUNDED PRECEDING) AS loop_end
    FROM radius_w r
    LEFT JOIN closure c USING (route_id, shape_id, shape_pt_sequence)
  ),
  flagged AS (
    SELECT *,
           CASE WHEN (cum_m <= 300.0 AND ABS(COALESCE(turn_start, 0.0)) >= 120.0
                      AND bend_start >= 45.0)
                  OR (total_m - cum_m <= 300.0 AND ABS(COALESCE(turn_end, 0.0)) >= 120.0
                      AND bend_end >= 45.0)
                  OR (SIGN(COALESCE(turn_prev, 0.0)) = SIGN(COALESCE(turn_next, 0.0))
                      AND ABS(COALESCE(turn_prev, 0.0)) >= 80.0
                      AND ABS(COALESCE(turn_next, 0.0)) >= 80.0
                      AND ABS(COALESCE(turn_prev, 0.0) + COALESCE(turn_next, 0.0)) >= 240.0)
                  OR ABS(COALESCE(turn_hairpin, 0.0)) >= 135.0
                  OR (loop_end IS NOT NULL AND cum_m <= loop_end)
                THEN 1 ELSE 0 END AS merge_here
    FROM radius_t
  ),
  tapered AS (
    SELECT *,
           MAX(merge_here) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                                 ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS near1,
           MAX(merge_here) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                                 ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING) AS near2,
           MAX(merge_here) OVER (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence
                                 ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING) AS near3
    FROM flagged
  ),
  offc AS MATERIALIZED (
    SELECT route_id, shape_id,
           ROW_NUMBER() OVER w AS ord,
           COUNT(*) OVER (PARTITION BY route_id, shape_id) AS npts,
           lat + (ux * GREATEST(-0.8 * turn_r, LEAST(0.8 * turn_r, shift_s)))
                 / 111320.0
             AS y,
           lon + (-uy * GREATEST(-0.8 * turn_r, LEAST(0.8 * turn_r, shift_s)))
                 / (111320.0 * GREATEST(coslat, 1e-6))
             AS x,
           lat AS orig_lat, lon AS orig_lon,
           band_index, band_count, slot_s,
           CASE WHEN merge_here = 1 THEN 12.0
                WHEN near1 = 1 THEN 28.0
                WHEN near2 = 1 THEN 44.0
                WHEN near3 = 1 THEN 56.0
                ELSE 5000.0 END AS turn_rw
    FROM tapered
    WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY shape_pt_sequence)
  ),
  simp AS (
    SELECT route_id, shape_id,
           UNNEST(ST_Dump(ST_Points(ST_Simplify(
             ST_MakeLine(list(ST_Point(x, y) ORDER BY ord)), 1.0 / 111320.0)))) AS d
    FROM offc
    GROUP BY route_id, shape_id
  ),
  fin1 AS (
    SELECT o.route_id, o.shape_id, o.ord, o.x, o.y, o.orig_lat, o.orig_lon,
           o.band_index, o.band_count, o.slot_s, o.turn_rw
    FROM (
      SELECT *, LAG(slot_s) OVER w AS pslot, LEAD(slot_s) OVER w AS nslot,
             LAG(turn_rw) OVER w AS pturn, LEAD(turn_rw) OVER w AS nturn
      FROM offc
      WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY ord)
    ) o
    WHERE EXISTS (SELECT 1 FROM (SELECT route_id, shape_id, ST_X(d.geom) AS x, ST_Y(d.geom) AS y FROM simp) k
                  WHERE k.route_id = o.route_id AND k.shape_id = o.shape_id AND k.x = o.x AND k.y = o.y)
       OR ABS(o.slot_s - COALESCE(o.pslot, o.slot_s)) > 0.02
       OR ABS(o.slot_s - COALESCE(o.nslot, o.slot_s)) > 0.02
       OR o.turn_rw <> COALESCE(o.pturn, o.turn_rw)
       OR o.turn_rw <> COALESCE(o.nturn, o.turn_rw)
       OR o.ord % 10 = 1
  ),
  fin1d AS (
    SELECT route_id, shape_id, ord, x, y, orig_lat, orig_lon,
           band_index, band_count, slot_s, turn_rw
    FROM (
      SELECT *,
        ((x - LAG(x) OVER w) * COS(RADIANS(y)) * 111320.0) AS ix,
        ((y - LAG(y) OVER w) * 111320.0) AS iy,
        ((LEAD(x) OVER w - x) * COS(RADIANS(y)) * 111320.0) AS ox,
        ((LEAD(y) OVER w - y) * 111320.0) AS oy
      FROM (
        SELECT * FROM (
          SELECT *, LAG(x) OVER w AS dx0, LAG(y) OVER w AS dy0
          FROM fin1 WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY ord)
        )
        WHERE dx0 IS NULL
           OR SQRT(POWER((x - dx0) * COS(RADIANS(y)) * 111320.0, 2)
                 + POWER((y - dy0) * 111320.0, 2)) >= 0.5
      ) WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY ord)
    )
    WHERE ix IS NULL OR ox IS NULL
       OR LEAST(SQRT(ix*ix + iy*iy), SQRT(ox*ox + oy*oy)) >= 6.0
       OR (ix*ox + iy*oy) >= -0.866 * SQRT(ix*ix + iy*iy) * SQRT(ox*ox + oy*oy)
  ),
  ck1 AS (
    SELECT route_id, shape_id, orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw, x, y,
           ROW_NUMBER() OVER w AS ord,
           LEAD(x) OVER w AS nx, LEAD(y) OVER w AS ny,
           COUNT(*) OVER (PARTITION BY route_id, shape_id) AS n
    FROM fin1d WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY ord)
  ),
  ck1p AS (
    SELECT route_id, shape_id, CAST(ord * 2 AS DOUBLE) AS ord, x, y,
           orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw
    FROM ck1 WHERE ord = 1
    UNION ALL
    SELECT route_id, shape_id, CAST(ord * 2 AS DOUBLE) + g.j * 0.5,
           x + (nx - x) * CASE WHEN g.j = 1 THEN qf ELSE 1.0 - qf END,
           y + (ny - y) * CASE WHEN g.j = 1 THEN qf ELSE 1.0 - qf END,
           orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw
    FROM (SELECT *, CASE WHEN d > 32.0 THEN 8.0 / d ELSE 0.25 END AS qf
          FROM (SELECT *, SQRT(POWER((nx - x) * COS(RADIANS(y)) * 111320.0, 2)
                                 + POWER((ny - y) * 111320.0, 2)) AS d
                FROM ck1 WHERE nx IS NOT NULL)) s
    JOIN (SELECT UNNEST(range(1, 3)) AS j) g ON TRUE
    UNION ALL
    SELECT route_id, shape_id, CAST(ord * 2 AS DOUBLE) + 1.0, x, y,
           orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw
    FROM ck1 WHERE ord = n
  ),
  ck2 AS (
    SELECT route_id, shape_id, orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw, x, y,
           ROW_NUMBER() OVER w AS ord,
           LEAD(x) OVER w AS nx, LEAD(y) OVER w AS ny,
           COUNT(*) OVER (PARTITION BY route_id, shape_id) AS n
    FROM ck1p WINDOW w AS (PARTITION BY route_id, shape_id ORDER BY ord)
  ),
  ck2p AS (
    SELECT route_id, shape_id, CAST(ord * 2 AS DOUBLE) AS ord, x, y,
           orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw
    FROM ck2 WHERE ord = 1
    UNION ALL
    SELECT route_id, shape_id, CAST(ord * 2 AS DOUBLE) + g.j * 0.5,
           x + (nx - x) * CASE WHEN g.j = 1 THEN qf ELSE 1.0 - qf END,
           y + (ny - y) * CASE WHEN g.j = 1 THEN qf ELSE 1.0 - qf END,
           orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw
    FROM (SELECT *, CASE WHEN d > 32.0 THEN 8.0 / d ELSE 0.25 END AS qf
          FROM (SELECT *, SQRT(POWER((nx - x) * COS(RADIANS(y)) * 111320.0, 2)
                                 + POWER((ny - y) * 111320.0, 2)) AS d
                FROM ck2 WHERE nx IS NOT NULL)) s
    JOIN (SELECT UNNEST(range(1, 3)) AS j) g ON TRUE
    UNION ALL
    SELECT route_id, shape_id, CAST(ord * 2 AS DOUBLE) + 1.0, x, y,
           orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw
    FROM ck2 WHERE ord = n
  ),
  smoothed AS (
    SELECT route_id, shape_id, ord AS shape_pt_sequence,
           y AS shape_pt_lat, x AS shape_pt_lon,
           orig_lat, orig_lon, band_index, band_count, slot_s, turn_rw
    FROM ck2p
  )
  SELECT sm.route_id, rv.route_name, rv.route_color_hex, rv.route_text_color_hex, sm.shape_id,
         sm.shape_pt_sequence, sm.shape_pt_lat, sm.shape_pt_lon,
         sm.orig_lat, sm.orig_lon, sm.band_index, sm.band_count, sm.slot_s AS slot, sm.turn_rw AS turn_radius
  FROM smoothed sm
  LEFT JOIN RoutesView rv ON rv.route_id = sm.route_id
);

CREATE OR REPLACE MACRO prepare_route_shape_lanes_rail() AS TABLE (
  SELECT * FROM prepare_route_shape_lanes(
    (SELECT COALESCE(list(route_id), []) FROM RoutesView
     WHERE route_type IN (0, 1, 2, 5, 7, 12)
        OR route_type BETWEEN 100 AND 199
        OR route_type BETWEEN 400 AND 405
        OR route_type BETWEEN 900 AND 906),
    spacing_meters := 16.0, snap_precision := 4, simplify_meters := 0.5,
    reach_meters := 20.0)
);
CREATE OR REPLACE MACRO prepare_route_shape_lanes_bus() AS TABLE (
  SELECT * FROM prepare_route_shape_lanes(
    (SELECT COALESCE(list(route_id), []) FROM RoutesView
     WHERE route_type IN (3, 11)
        OR route_type BETWEEN 200 AND 299
        OR route_type BETWEEN 700 AND 799
        OR route_type = 800),
    spacing_meters := 7.0, snap_precision := 4, simplify_meters := 4.0,
    reach_meters := 20.0)
);
CREATE OR REPLACE MACRO prepare_route_shape_lanes_other() AS TABLE (
  SELECT * FROM prepare_route_shape_lanes(
    (SELECT COALESCE(list(route_id), []) FROM RoutesView
     WHERE route_type IS NULL OR NOT (route_type IN (0, 1, 2, 3, 5, 7, 11, 12)
        OR route_type BETWEEN 100 AND 199
        OR route_type BETWEEN 200 AND 299
        OR route_type BETWEEN 400 AND 405
        OR route_type BETWEEN 700 AND 799
        OR route_type = 800
        OR route_type BETWEEN 900 AND 906)),
    spacing_meters := 12.0, snap_precision := 4, simplify_meters := 2.0,
    reach_meters := 18.0)
);

CREATE TABLE IF NOT EXISTS RouteShapeBandsTable (
  route_id VARCHAR,
  route_name VARCHAR,
  route_color_hex VARCHAR,
  route_text_color_hex VARCHAR,
  shape_id VARCHAR,
  shape_pt_sequence DOUBLE,
  shape_pt_lat DOUBLE,
  shape_pt_lon DOUBLE,
  orig_lat DOUBLE,
  orig_lon DOUBLE,
  band_index INTEGER,
  band_count INTEGER,
  slot DOUBLE,
  turn_radius DOUBLE
);

CREATE OR REPLACE MACRO refresh_route_shape_bands() AS TABLE (
  SELECT * FROM finish_route_shape_bands(
    (SELECT COALESCE(list(DISTINCT route_id), []) FROM RouteShapeLanesTable))
);

CREATE OR REPLACE MACRO get_station_line_bands(
  p_ids, p_kind := 'route', spacing_meters := 30.0
) AS TABLE (
  WITH base AS (
    SELECT 'route' AS entity_kind, rs.route_id AS entity_id, rs.route_id AS route_id,
           rs.route_type, rs.station_id AS node_id, rs.stop_sequence AS seq
    FROM RouteStopsView rs
    WHERE p_kind = 'route' AND rs.route_id IN (SELECT unnest(p_ids))
    UNION ALL
    SELECT 'trip' AS entity_kind, stt.trip_id AS entity_id, t.route_id,
           r.route_type,
           COALESCE(NULLIF(sv.parent_station, ''), stt.stop_id) AS node_id,
           stt.stop_sequence AS seq
    FROM StopTimesView stt
    JOIN TripsView t ON t.trip_id = stt.trip_id
    LEFT JOIN RoutesView r ON r.route_id = t.route_id
    LEFT JOIN StopsView sv ON sv.stop_id = stt.stop_id
    WHERE p_kind = 'trip' AND stt.trip_id IN (SELECT unnest(p_ids))
  ),
  nodes AS (
    SELECT b.entity_kind, b.entity_id, b.route_id, b.route_type, b.node_id,
           MIN(b.seq) AS seq,
           ANY_VALUE(st.stop_lat) AS lat, ANY_VALUE(st.stop_lon) AS lon
    FROM base b
    JOIN StopsView st ON st.stop_id = b.node_id
    WHERE st.stop_lat IS NOT NULL AND st.stop_lon IS NOT NULL
    GROUP BY b.entity_kind, b.entity_id, b.route_id, b.route_type, b.node_id
  ),
  ordered AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY seq, node_id) AS ord
    FROM nodes
  ),
  segs AS (
    SELECT entity_kind, entity_id, route_id, route_type, ord,
           node_id AS from_node, lat AS lat1, lon AS lon1,
           LEAD(node_id) OVER w AS to_node,
           LEAD(lat) OVER w AS lat2, LEAD(lon) OVER w AS lon2
    FROM ordered
    WINDOW w AS (PARTITION BY entity_id ORDER BY ord)
  ),
  corridor AS (
    SELECT *,
           CASE WHEN from_node <= to_node
             THEN from_node || '||' || to_node
             ELSE to_node || '||' || from_node
           END AS corridor_key
    FROM segs
    WHERE to_node IS NOT NULL
  ),
  corridor_entities AS (
    SELECT DISTINCT corridor_key, entity_id, route_type FROM corridor
  ),
  band_order AS (
    SELECT corridor_key, entity_id,
           CAST(ROW_NUMBER() OVER (PARTITION BY corridor_key ORDER BY route_type, entity_id) - 1 AS INTEGER) AS band_index,
           CAST(COUNT(*) OVER (PARTITION BY corridor_key) AS INTEGER) AS band_count
    FROM corridor_entities
  ),
  offset_calc AS (
    SELECT c.entity_kind, c.entity_id, c.route_id, c.ord,
           c.lat1, c.lon1, c.lat2, c.lon2, b.band_index, b.band_count,
           route_band_offset_deg(b.band_index, b.band_count, spacing_meters) AS off_deg,
           COS(RADIANS((c.lat1 + c.lat2) / 2.0)) AS mx,
           SQRT(POWER((c.lon2 - c.lon1) * COS(RADIANS((c.lat1 + c.lat2) / 2.0)), 2)
                + POWER(c.lat2 - c.lat1, 2)) AS seg_len,
           ((c.lon2 - c.lon1) * COS(RADIANS((c.lat1 + c.lat2) / 2.0))) AS dx,
           (c.lat2 - c.lat1) AS dy
    FROM corridor c
    JOIN band_order b USING (corridor_key, entity_id)
  ),
  offset_delta AS (
    SELECT *,
           CASE WHEN seg_len = 0 THEN 0.0 ELSE (dx / seg_len) * off_deg END AS dlat,
           CASE WHEN seg_len = 0 OR mx = 0 THEN 0.0 ELSE ((-dy / seg_len) * off_deg) / mx END AS dlon
    FROM offset_calc
  ),
  out_pts AS (
    SELECT entity_kind, entity_id, route_id, ord AS seq,
           lat1 + dlat AS lat, lon1 + dlon AS lon, band_index, band_count
    FROM offset_delta
    UNION ALL
    SELECT entity_kind, entity_id, route_id, ord + 1 AS seq,
           lat2 + dlat AS lat, lon2 + dlon AS lon, band_index, band_count
    FROM offset_delta od
    WHERE od.ord = (SELECT MAX(o2.ord) FROM offset_delta o2 WHERE o2.entity_id = od.entity_id)
  )
  SELECT o.entity_kind, o.entity_id, o.route_id,
         r.route_name, r.route_color_hex, r.route_text_color_hex, r.route_type_name,
         o.entity_id AS shape_id,
         o.lat AS shape_pt_lat, o.lon AS shape_pt_lon,
         CAST(o.seq AS DOUBLE) AS shape_pt_sequence,
         NULL::DOUBLE AS shape_dist_traveled,
         o.band_index, o.band_count
  FROM out_pts o
  LEFT JOIN RoutesView r ON r.route_id = o.route_id
  ORDER BY o.entity_id, o.seq
);

)SQL";

static const char *GTFS_REROUTE_SQL = R"SQL(

CREATE OR REPLACE MACRO gtfs_time_to_seconds(t) AS (
  CASE WHEN NULLIF(CAST(t AS VARCHAR), '') IS NULL THEN NULL
    ELSE COALESCE(TRY_CAST(SPLIT_PART(CAST(t AS VARCHAR), ':', 1) AS BIGINT), 0) * 3600
       + COALESCE(TRY_CAST(SPLIT_PART(CAST(t AS VARCHAR), ':', 2) AS BIGINT), 0) * 60
       + COALESCE(TRY_CAST(SPLIT_PART(CAST(t AS VARCHAR), ':', 3) AS BIGINT), 0)
  END
);

CREATE OR REPLACE MACRO seconds_to_gtfs_time(s) AS (
  CASE WHEN s IS NULL THEN NULL
    ELSE lpad(CAST(CAST(s AS BIGINT) // 3600 AS VARCHAR), 2, '0') || ':' ||
         lpad(CAST((CAST(s AS BIGINT) % 3600) // 60 AS VARCHAR), 2, '0') || ':' ||
         lpad(CAST(CAST(s AS BIGINT) % 60 AS VARCHAR), 2, '0')
  END
);

CREATE OR REPLACE MACRO get_trip_reroute_routes(p_trip_id) AS TABLE (
  WITH affected_trip AS MATERIALIZED (
    SELECT route_id
    FROM TripsView
    WHERE trip_id = p_trip_id
    LIMIT 1
  ),
  affected_stops AS MATERIALIZED (
    SELECT ROW_NUMBER() OVER (ORDER BY st.stop_sequence) AS affected_position,
           st.stop_id, sv.stop_name AS station_name
    FROM StopTimesView st
    JOIN StopsView sv ON sv.stop_id = st.stop_id
    WHERE st.trip_id = p_trip_id
      AND sv.stop_name IS NOT NULL
  ),
  affected_pattern AS MATERIALIZED (
    SELECT LIST(stop_id ORDER BY affected_position) AS stop_ids
    FROM affected_stops
  ),
  donor_representatives AS MATERIALIZED (
    SELECT t.route_id, t.direction_id,
           COALESCE(NULLIF(t.shape_id, ''), 'headsign:' || COALESCE(t.trip_headsign, '')) AS pattern_id,
           MIN(t.trip_id) AS donor_trip_id
    FROM TripsView t
    CROSS JOIN affected_trip
    WHERE t.trip_id != p_trip_id
      AND t.route_id != affected_trip.route_id
    GROUP BY t.route_id, t.direction_id,
             COALESCE(NULLIF(t.shape_id, ''), 'headsign:' || COALESCE(t.trip_headsign, ''))
  ),
  donor_stop_rows AS MATERIALIZED (
    SELECT edits.trip_id, edits.stop_sequence, edits.stop_id
    FROM donor_representatives representatives
    JOIN EditStopTimesTable edits ON edits.trip_id = representatives.donor_trip_id
    WHERE edits.status IN ('new', 'edit', 'new edit')
    UNION ALL
    SELECT st.trip_id, st.stop_sequence, st.stop_id
    FROM donor_representatives representatives
    JOIN stop_times st ON st.trip_id = representatives.donor_trip_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM EditStopTimesTable edits
      WHERE edits.row_id = CAST(st.row_id AS TEXT)
        AND edits.status IN ('deleted', 'edit')
    )
      AND NOT EXISTS (
        SELECT 1
        FROM EditStopTimesTable edits
        WHERE edits.trip_id = st.trip_id
          AND edits.status = 'new edit'
      )
  ),
  donor_stops AS MATERIALIZED (
    SELECT representatives.route_id, representatives.donor_trip_id,
           ROW_NUMBER() OVER (
             PARTITION BY representatives.donor_trip_id
             ORDER BY st.stop_sequence
           ) AS donor_position,
           st.stop_id, sv.stop_name AS station_name
    FROM donor_representatives representatives
    JOIN donor_stop_rows st ON st.trip_id = representatives.donor_trip_id
    JOIN StopsView sv ON sv.stop_id = st.stop_id
    WHERE sv.stop_name IS NOT NULL
  ),
  donor_patterns AS MATERIALIZED (
    SELECT route_id, donor_trip_id,
           LIST(stop_id ORDER BY donor_position) AS stop_ids
    FROM donor_stops
    GROUP BY route_id, donor_trip_id
  ),
  shared_stations AS MATERIALIZED (
    SELECT donors.route_id, donors.donor_trip_id,
           affected.station_name,
           affected.affected_position,
           donors.donor_position
    FROM donor_stops donors
    JOIN affected_stops affected ON affected.station_name = donors.station_name
  ),
  candidate_stats AS MATERIALIZED (
    SELECT route_id, donor_trip_id,
           COUNT(DISTINCT station_name) AS shared_station_count
    FROM shared_stations
    GROUP BY route_id, donor_trip_id
    HAVING COUNT(DISTINCT station_name) >= 2
  ),
  pattern_pairs AS MATERIALIZED (
    SELECT candidates.route_id, candidates.donor_trip_id,
           candidates.shared_station_count,
           starts.affected_position AS affected_from_position,
           ends.affected_position AS affected_to_position,
           starts.donor_position AS donor_from_position,
           ends.donor_position AS donor_to_position
    FROM candidate_stats candidates
    JOIN shared_stations starts USING (route_id, donor_trip_id)
    JOIN shared_stations ends USING (route_id, donor_trip_id)
    WHERE ends.affected_position > starts.affected_position
      AND ends.donor_position > starts.donor_position
  ),
  changed_candidates AS MATERIALIZED (
    SELECT DISTINCT pairs.route_id, pairs.donor_trip_id,
           pairs.shared_station_count
    FROM pattern_pairs pairs
    JOIN donor_patterns donor USING (route_id, donor_trip_id)
    CROSS JOIN affected_pattern affected
    WHERE LIST_SLICE(
            affected.stop_ids,
            pairs.affected_from_position + 1,
            pairs.affected_to_position - 1
          ) <> LIST_SLICE(
            donor.stop_ids,
            pairs.donor_from_position + 1,
            pairs.donor_to_position - 1
          )
  ),
  ranked AS (
    SELECT *, ROW_NUMBER() OVER (
      PARTITION BY route_id
      ORDER BY shared_station_count DESC, donor_trip_id
    ) AS route_rank
    FROM changed_candidates
  )
  SELECT r.route_id, r.route_name, r.route_short_name, r.route_type_name,
         r.route_color_hex, ranked.donor_trip_id, ranked.shared_station_count
  FROM ranked
  JOIN RoutesView r ON r.route_id = ranked.route_id
  WHERE ranked.route_rank = 1
  ORDER BY r.route_sort_order NULLS LAST, r.route_name, r.route_id
);

CREATE OR REPLACE MACRO get_trip_reroute_boundary_pairs(p_trip_id, p_donor_trip_id) AS TABLE (
  WITH affected_stops AS MATERIALIZED (
    SELECT st.stop_sequence AS affected_sequence,
           ROW_NUMBER() OVER (ORDER BY st.stop_sequence) AS affected_position,
           st.stop_id, sv.stop_name AS station_name
    FROM StopTimesView st
    JOIN StopsView sv ON sv.stop_id = st.stop_id
    WHERE st.trip_id = p_trip_id
      AND sv.stop_name IS NOT NULL
  ),
  donor_stops AS MATERIALIZED (
    SELECT st.stop_sequence AS donor_sequence,
           ROW_NUMBER() OVER (ORDER BY st.stop_sequence) AS donor_position,
           st.stop_id, sv.stop_name AS station_name
    FROM StopTimesView st
    JOIN StopsView sv ON sv.stop_id = st.stop_id
    WHERE st.trip_id = p_donor_trip_id
      AND sv.stop_name IS NOT NULL
  ),
  affected AS MATERIALIZED (
    SELECT station_name, MIN(affected_sequence) AS affected_sequence,
           MIN(affected_position) AS affected_position
    FROM affected_stops
    GROUP BY station_name
  ),
  donor AS MATERIALIZED (
    SELECT station_name, MIN(donor_sequence) AS donor_sequence,
           MIN(donor_position) AS donor_position
    FROM donor_stops
    GROUP BY station_name
  ),
  affected_pattern AS MATERIALIZED (
    SELECT LIST(stop_id ORDER BY affected_position) AS stop_ids
    FROM affected_stops
  ),
  donor_pattern AS MATERIALIZED (
    SELECT LIST(stop_id ORDER BY donor_position) AS stop_ids
    FROM donor_stops
  ),
  shared AS MATERIALIZED (
    SELECT affected.station_name, affected.affected_sequence, affected.affected_position,
           donor.donor_sequence, donor.donor_position
    FROM affected
    JOIN donor USING (station_name)
  ),
  pairs AS (
    SELECT start_station.station_name AS from_station,
           end_station.station_name AS to_station,
           start_station.affected_sequence AS affected_from_sequence,
           end_station.affected_sequence AS affected_to_sequence,
           start_station.donor_sequence AS donor_from_sequence,
           end_station.donor_sequence AS donor_to_sequence,
           start_station.affected_position AS affected_from_position,
           end_station.affected_position AS affected_to_position,
           start_station.donor_position AS donor_from_position,
           end_station.donor_position AS donor_to_position
    FROM shared start_station
    JOIN shared end_station
      ON end_station.affected_position > start_station.affected_position
     AND end_station.donor_position > start_station.donor_position
  )
  SELECT from_station, to_station,
         affected_from_sequence, affected_to_sequence,
         donor_from_sequence, donor_to_sequence
  FROM pairs
  CROSS JOIN affected_pattern
  CROSS JOIN donor_pattern
  WHERE LIST_SLICE(
          affected_pattern.stop_ids,
          pairs.affected_from_position + 1,
          pairs.affected_to_position - 1
        ) <> LIST_SLICE(
          donor_pattern.stop_ids,
          pairs.donor_from_position + 1,
          pairs.donor_to_position - 1
        )
  ORDER BY affected_from_sequence, affected_to_sequence
);

-- Reroute p_trip_id via p_donor_trip_id between the two shared boundary stops (by stop name).
-- Pick a donor trip in the SAME direction as the affected trip. Returns the merged stop list:
-- affected stops up to the first boundary + donor stops between (donor stop_ids, donor timing
-- scaled into the affected trip's boundary window) + affected stops from the second boundary on.
CREATE OR REPLACE MACRO get_reroute_stop_times(p_trip_id, p_donor_trip_id, p_from_name, p_to_name) AS TABLE (
  WITH aff AS (
    SELECT st.stop_sequence AS seq, st.stop_id, s.stop_name, st.arrival_time, st.departure_time,
           gtfs_time_to_seconds(st.arrival_time) AS arr, gtfs_time_to_seconds(st.departure_time) AS dep
    FROM StopTimesView st JOIN StopsView s ON s.stop_id = st.stop_id
    WHERE st.trip_id = p_trip_id
  ),
  don AS (
    SELECT st.stop_sequence AS seq, st.stop_id, s.stop_name,
           gtfs_time_to_seconds(st.arrival_time) AS arr, gtfs_time_to_seconds(st.departure_time) AS dep
    FROM StopTimesView st JOIN StopsView s ON s.stop_id = st.stop_id
    WHERE st.trip_id = p_donor_trip_id
  ),
  b AS (
    SELECT
      (SELECT seq FROM aff WHERE stop_name = p_from_name ORDER BY seq LIMIT 1) AS a1,
      (SELECT seq FROM aff WHERE stop_name = p_to_name   ORDER BY seq LIMIT 1) AS a2,
      (SELECT seq FROM don WHERE stop_name = p_from_name ORDER BY seq LIMIT 1) AS d1,
      (SELECT seq FROM don WHERE stop_name = p_to_name   ORDER BY seq LIMIT 1) AS d2
  ),
  -- Normalize boundary order so --from/--to work regardless of the trip's direction
  -- (northbound trips have the "from" stop at a higher stop_sequence than the "to" stop).
  bounds AS (
    SELECT LEAST(a1, a2) AS a_lo, GREATEST(a1, a2) AS a_hi,
           LEAST(d1, d2) AS d_lo, GREATEST(d1, d2) AS d_hi
    FROM b
  ),
  anchors AS (
    SELECT bd.a_lo, bd.a_hi, bd.d_lo, bd.d_hi,
      (SELECT dep FROM aff WHERE seq = bd.a_lo) AS a_lo_dep,
      (SELECT arr FROM aff WHERE seq = bd.a_hi) AS a_hi_arr,
      (SELECT dep FROM don WHERE seq = bd.d_lo) AS d_lo_dep,
      (SELECT arr FROM don WHERE seq = bd.d_hi) AS d_hi_arr
    FROM bounds bd
  ),
  k AS (
    SELECT *,
      CASE WHEN (d_hi_arr - d_lo_dep) > 0
           THEN (a_hi_arr - a_lo_dep)::DOUBLE / (d_hi_arr - d_lo_dep) ELSE 1 END AS scale
    FROM anchors
  ),
  parts AS (
    SELECT 0 AS part, aff.seq AS ord, aff.stop_id, aff.arrival_time, aff.departure_time
    FROM aff, k WHERE aff.seq <= k.a_lo
    UNION ALL
    SELECT 1 AS part, don.seq AS ord, don.stop_id,
      seconds_to_gtfs_time(CAST(round(k.a_lo_dep + (don.arr - k.d_lo_dep) * k.scale) AS BIGINT)),
      seconds_to_gtfs_time(CAST(round(k.a_lo_dep + (don.dep - k.d_lo_dep) * k.scale) AS BIGINT))
    FROM don, k WHERE don.seq > k.d_lo AND don.seq < k.d_hi
    UNION ALL
    SELECT 2 AS part, aff.seq AS ord, aff.stop_id, aff.arrival_time, aff.departure_time
    FROM aff, k WHERE aff.seq >= k.a_hi
  )
  SELECT row_number() OVER (ORDER BY part, ord) AS stop_sequence, stop_id, arrival_time, departure_time
  FROM parts
);

-- Unified stop selection for a trip: keep the stops in [p_first_name .. p_last_name] (inclusive;
-- NULL/'' = open end) minus any whose name is in p_remove_names (pass [] to remove none). This is the
-- single code path behind remove_stops (skip/express, bypass = full range, remove names),
-- truncate_trip (short-turn = remove nothing, restrict range), and each half of split_trip.
CREATE OR REPLACE MACRO get_trip_stops(p_trip_id, p_remove_names, p_first_name, p_last_name) AS TABLE (
  WITH t AS (
    SELECT st.stop_sequence AS seq, st.stop_id, s.stop_name, st.arrival_time, st.departure_time
    FROM stop_times st JOIN StopsView s ON s.stop_id = st.stop_id
    WHERE st.trip_id = p_trip_id
  ),
  bounds AS (
    SELECT
      COALESCE((SELECT MIN(seq) FROM t WHERE p_first_name IS NOT NULL AND p_first_name <> '' AND stop_name = p_first_name),
               (SELECT MIN(seq) FROM t)) AS lo,
      COALESCE((SELECT MIN(seq) FROM t WHERE p_last_name IS NOT NULL AND p_last_name <> '' AND stop_name = p_last_name),
               (SELECT MAX(seq) FROM t)) AS hi
  )
  SELECT row_number() OVER (ORDER BY t.seq) AS stop_sequence, t.stop_id, t.arrival_time, t.departure_time
  FROM t, bounds
  WHERE t.seq >= bounds.lo AND t.seq <= bounds.hi
    AND NOT list_contains(p_remove_names, t.stop_name)
);

)SQL";
