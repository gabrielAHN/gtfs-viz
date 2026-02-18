

export const BASIC_QUERY_MACROS = `
-- Get station information with pathways status and exit count
CREATE OR REPLACE MACRO get_station_info(station_id) AS TABLE (
  SELECT
    s.row_id,
    s.stop_id,
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    s.location_type_name,
    s.parent_station,
    s.wheelchair_status,
    s.status,
    COALESCE(st.exit_count, 0) AS exit_count,
    st.pathways_status
  FROM StopsView s
  LEFT JOIN StationsTable st ON s.stop_id = st.stop_id
  WHERE s.stop_id = station_id
);

-- Get all stops within a station (already uses StopsView - good!)
CREATE OR REPLACE MACRO get_station_stops(station_id) AS TABLE (
  SELECT
    s.row_id,
    s.stop_id,
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    s.location_type_name,
    s.parent_station,
    s.wheelchair_status,
    s.status
  FROM StopsView s
  WHERE s.parent_station = station_id
     OR s.stop_id = station_id
);
`;

export const PATHWAY_QUERY_MACROS = `

-- Get station pathways (connections within a station)
CREATE OR REPLACE MACRO get_station_pathways(station_id) AS TABLE (
  SELECT
    p.*,
    pn.from_location_type_name,
    pn.to_location_type_name,
    pn.from_lat,
    pn.from_lon,
    pn.to_lat,
    pn.to_lon,
    pn.angle
  FROM pathway_network pn
  JOIN pathways p ON p.pathway_id = pn.pathway_id
  WHERE pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id
);

-- Get available from stops for filtering
CREATE OR REPLACE MACRO get_from_stops_available(station_id) AS TABLE (
  SELECT DISTINCT pn.from_stop_id
  FROM pathway_network pn
  WHERE pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id
  ORDER BY pn.from_stop_id
);

-- Get available to stops for filtering
CREATE OR REPLACE MACRO get_to_stops_available(station_id) AS TABLE (
  SELECT DISTINCT pn.to_stop_id
  FROM pathway_network pn
  WHERE pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id
  ORDER BY pn.to_stop_id
);

-- Get available pathway modes for filtering
CREATE OR REPLACE MACRO get_pathway_modes_available(station_id) AS TABLE (
  SELECT DISTINCT pn.pathway_mode_name
  FROM pathway_network pn
  WHERE pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id
  ORDER BY pn.pathway_mode_name
);

-- Get available direction types for filtering
CREATE OR REPLACE MACRO get_direction_types_available(station_id) AS TABLE (
  SELECT DISTINCT pn.direction_type
  FROM pathway_network pn
  WHERE pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id
  ORDER BY pn.direction_type
);

-- Get time range (min/max traversal times)
CREATE OR REPLACE MACRO get_time_range(station_id) AS TABLE (
  SELECT
    MIN(pn.traversal_time) AS min_time,
    MAX(pn.traversal_time) AS max_time
  FROM pathway_network pn
  WHERE (pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id)
    AND pn.traversal_time IS NOT NULL
);

-- Get station stops for pathway visualization
CREATE OR REPLACE MACRO get_station_stops_for_pathways(station_id) AS TABLE (
  SELECT
    s.row_id,
    s.stop_id,
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    s.location_type_name,
    s.parent_station,
    s.wheelchair_status
  FROM StopsView s
  WHERE s.parent_station = station_id
     OR s.stop_id = station_id
);

-- Get filtered pathways with multiple filter options
CREATE OR REPLACE MACRO get_pathways_filtered(
  station_id,
  to_stop,
  from_stop,
  min_time,
  max_time,
  include_null_time,
  direction_type,
  pathway_types
) AS TABLE (
  SELECT
    pn.*
  FROM pathway_network pn
  WHERE (pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id)
    AND (to_stop IS NULL OR pn.to_stop_id = to_stop)
    AND (from_stop IS NULL OR pn.from_stop_id = from_stop)
    AND (
      (min_time IS NULL OR max_time IS NULL) OR
      (pn.traversal_time >= min_time AND pn.traversal_time <= max_time) OR
      (include_null_time AND pn.traversal_time IS NULL)
    )
    AND (direction_type IS NULL OR pn.direction_type = direction_type)
    AND (
      pathway_types IS NULL OR
      list_contains(pathway_types, pn.pathway_mode_name)
    )
);

-- Get pathway aggregates (summary statistics)
CREATE OR REPLACE MACRO get_pathway_aggregates(station_id) AS TABLE (
  SELECT
    COUNT(*) AS total_pathways,
    COUNT(DISTINCT pn.from_stop_id) AS from_stops_count,
    COUNT(DISTINCT pn.to_stop_id) AS to_stops_count,
    COUNT(DISTINCT pn.pathway_mode_name) AS pathway_modes_count,
    AVG(pn.traversal_time) AS avg_traversal_time,
    MIN(pn.traversal_time) AS min_traversal_time,
    MAX(pn.traversal_time) AS max_traversal_time
  FROM pathway_network pn
  WHERE pn.from_parent_station = station_id
     OR pn.to_parent_station = station_id
);

-- Get time interval ranges for visualization
CREATE OR REPLACE MACRO get_time_interval_ranges(station_id) AS TABLE (
  WITH time_stats AS (
    SELECT
      MIN(traversal_time) AS min_time,
      MAX(traversal_time) AS max_time,
      COUNT(DISTINCT traversal_time) AS distinct_times
    FROM pathway_network
    WHERE (from_parent_station = station_id OR to_parent_station = station_id)
      AND traversal_time IS NOT NULL
  )
  SELECT
    min_time,
    max_time,
    CASE
      WHEN distinct_times <= 5 THEN 1
      ELSE CAST(CEIL((max_time - min_time) / 5.0) AS INTEGER)
    END AS interval_size
  FROM time_stats
);
`;

export const QUERY_MACROS = BASIC_QUERY_MACROS + '\n' + PATHWAY_QUERY_MACROS;
