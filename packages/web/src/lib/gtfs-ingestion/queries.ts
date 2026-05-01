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
  WITH station_stops AS (
    SELECT
      s.row_id,
      s.stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      s.location_type_name,
      s.parent_station,
      s.level_id,
      s.wheelchair_status,
      s.status
    FROM StopsView s

    UNION ALL

    SELECT
      edt.row_id,
      edt.stop_id,
      edt.stop_name,
      edt.stop_lat,
      edt.stop_lon,
      edt.location_type_name,
      edt.parent_station,
      edt.level_id,
      edt.wheelchair_status,
      edt.status
    FROM EditStopTable edt
    WHERE edt.status = 'deleted'
      AND NOT EXISTS (
        SELECT 1
        FROM StopsView s
        WHERE s.stop_id = edt.stop_id
      )
  )
  SELECT
    s.row_id,
    s.stop_id,
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    s.location_type_name,
    s.parent_station,
    s.level_id,
    s.wheelchair_status,
    s.status
  FROM station_stops s
  WHERE COALESCE(NULLIF(s.parent_station, ''), s.stop_id) = station_id
);
`;

export const PATHWAY_QUERY_MACROS = `

-- Get station pathways (connections within a station)
CREATE OR REPLACE MACRO get_station_pathways(station_id) AS TABLE (
  WITH stop_lookup AS (
    SELECT
      s.stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      s.location_type_name,
      s.parent_station,
      s.status
    FROM StopsView s

    UNION ALL

    SELECT
      edt.stop_id,
      edt.stop_name,
      edt.stop_lat,
      edt.stop_lon,
      edt.location_type_name,
      edt.parent_station,
      edt.status
    FROM EditStopTable edt
    WHERE edt.status = 'deleted'
      AND NOT EXISTS (
        SELECT 1
        FROM StopsView s
        WHERE s.stop_id = edt.stop_id
      )
  )
  SELECT
    p.row_id,
    p.pathway_id,
    p.from_stop_id,
    p.to_stop_id,
    s1.stop_lat AS from_lat,
    s1.stop_lon AS from_lon,
    s2.stop_lat AS to_lat,
    s2.stop_lon AS to_lon,
    p.traversal_time,
    p.length,
    p.stair_count,
    p.max_slope,
    p.min_width,
    p.signposted_as,
    p.reversed_signposted_as,
    COALESCE(p.pathway_mode_name, pathway_mode_to_name(p.pathway_mode)) AS pathway_mode_name,
    p.pathway_mode,
    COALESCE(p.direction_type, bidirectional_to_direction(p.is_bidirectional)) AS direction_type,
    p.is_bidirectional,
    p.status,
    s1.location_type_name AS from_location_type_name,
    s2.location_type_name AS to_location_type_name,
    COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) AS from_parent_station,
    COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) AS to_parent_station,
    CASE
      WHEN s1.stop_lat IS NOT NULL AND s1.stop_lon IS NOT NULL
           AND s2.stop_lat IS NOT NULL AND s2.stop_lon IS NOT NULL
      THEN DEGREES(
        ATAN2(
          s2.stop_lon - s1.stop_lon,
          s2.stop_lat - s1.stop_lat
        )
      )
      ELSE NULL
    END AS angle
  FROM PathwaysView p
  LEFT JOIN stop_lookup s1 ON p.from_stop_id = s1.stop_id
  LEFT JOIN stop_lookup s2 ON p.to_stop_id = s2.stop_id
  WHERE COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) = station_id
     OR COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) = station_id
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

CREATE OR REPLACE MACRO get_station_connections(station_id) AS TABLE (
  WITH directed_connections AS (
    SELECT
      pathway_id,
      from_stop_id,
      to_stop_id,
      traversal_time,
      length,
      pathway_mode_name,
      direction_type,
      is_bidirectional,
      angle,
      'forward' AS edge_direction
    FROM pathway_network
    WHERE from_parent_station = station_id
      AND to_parent_station = station_id
      AND to_stop_id != from_stop_id

    UNION ALL

    SELECT
      pathway_id,
      to_stop_id AS from_stop_id,
      from_stop_id AS to_stop_id,
      traversal_time,
      length,
      pathway_mode_name,
      direction_type,
      is_bidirectional,
      angle,
      'reverse' AS edge_direction
    FROM pathway_network
    WHERE from_parent_station = station_id
      AND to_parent_station = station_id
      AND is_bidirectional = 1
      AND to_stop_id != from_stop_id
  )
  SELECT
    dc.pathway_id,
    dc.from_stop_id,
    from_stop.stop_name AS from_stop_name,
    from_stop.location_type_name AS from_location_type_name,
    dc.to_stop_id,
    to_stop.stop_name AS to_stop_name,
    to_stop.location_type_name AS to_location_type_name,
    dc.traversal_time AS traversal_time_seconds,
    CASE
      WHEN dc.traversal_time IS NULL THEN 'unknown'
      ELSE CAST(dc.traversal_time AS VARCHAR) || ' seconds'
    END AS time_period,
    dc.length,
    dc.pathway_mode_name,
    dc.direction_type,
    dc.is_bidirectional,
    dc.edge_direction,
    dc.angle
  FROM directed_connections dc
  LEFT JOIN StopsView from_stop
    ON from_stop.stop_id = dc.from_stop_id
  LEFT JOIN StopsView to_stop
    ON to_stop.stop_id = dc.to_stop_id
  ORDER BY dc.from_stop_id, dc.to_stop_id, dc.pathway_id, dc.edge_direction
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
  direction_filter,
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
    AND (direction_filter IS NULL OR pn.direction_type = direction_filter)
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

export const QUERY_MACROS = BASIC_QUERY_MACROS + "\n" + PATHWAY_QUERY_MACROS;
