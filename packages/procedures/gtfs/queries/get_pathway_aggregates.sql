

CREATE OR REPLACE MACRO get_from_stops_available(station_id) AS TABLE (
  SELECT DISTINCT from_stop_id
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
  ORDER BY from_stop_id
);

CREATE OR REPLACE MACRO get_to_stops_available(station_id) AS TABLE (
  SELECT DISTINCT to_stop_id
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
  ORDER BY to_stop_id
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

CREATE OR REPLACE MACRO get_pathway_modes_available(station_id) AS TABLE (
  SELECT DISTINCT pathway_mode_name
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
  ORDER BY pathway_mode_name
);

CREATE OR REPLACE MACRO get_direction_types_available(station_id) AS TABLE (
  SELECT DISTINCT direction_type
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
  ORDER BY direction_type
);

CREATE OR REPLACE MACRO get_time_range(station_id) AS TABLE (
  SELECT
    MIN(traversal_time) AS min_time,
    MAX(traversal_time) AS max_time
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
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
    WHERE from_parent_station = station_id
      AND to_parent_station = station_id
  )
  SELECT * FROM aggregates
);
