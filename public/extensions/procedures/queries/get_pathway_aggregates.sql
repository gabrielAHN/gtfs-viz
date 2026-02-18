

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
