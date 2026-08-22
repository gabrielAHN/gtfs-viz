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
  WHERE NOT EXISTS (SELECT 1 FROM EditStopTimesTable edt WHERE edt.row_id = CAST(st.row_id AS TEXT) AND edt.status = 'deleted')
    AND NOT EXISTS (SELECT 1 FROM EditStopTimesTable edt WHERE edt.row_id = CAST(st.row_id AS TEXT) AND edt.status = 'edit')
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
