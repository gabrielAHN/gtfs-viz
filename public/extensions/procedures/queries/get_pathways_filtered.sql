

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
    pathway_id,
    from_lat,
    from_lon,
    to_lat,
    to_lon,
    from_stop_id,
    to_stop_id,
    traversal_time,
    pathway_mode_name,
    direction_type,
    angle
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (
      min_time IS NULL
      OR (
        (traversal_time >= min_time AND traversal_time <= max_time)
        OR (include_null_time = FALSE AND traversal_time IS NULL)
      )
    )
    AND (direction_type IS NULL OR direction_type = direction_type)
    AND (pathway_types IS NULL OR pathway_mode_name IN (SELECT unnest(pathway_types)))
);

CREATE OR REPLACE MACRO get_station_stops_for_pathways(station_id) AS TABLE (
  SELECT *
  FROM stops
  WHERE parent_station = station_id
);

CREATE OR REPLACE MACRO get_to_stops(station_id, from_stop, min_time, max_time) AS TABLE (
  SELECT DISTINCT to_stop_id
  FROM pathway_network
  WHERE to_parent_station = station_id
    AND from_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (min_time IS NULL OR (traversal_time >= min_time AND traversal_time <= max_time))
);

CREATE OR REPLACE MACRO get_from_stops(station_id, to_stop, min_time, max_time) AS TABLE (
  SELECT DISTINCT from_stop_id
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (min_time IS NULL OR (traversal_time >= min_time AND traversal_time <= max_time))
);

CREATE OR REPLACE MACRO get_direction_types(
  station_id,
  to_stop,
  from_stop,
  min_time,
  max_time,
  include_null_time
) AS TABLE (
  SELECT DISTINCT direction_type
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (
      min_time IS NULL
      OR (
        (traversal_time >= min_time AND traversal_time <= max_time)
        OR (include_null_time = FALSE AND traversal_time IS NULL)
      )
    )
);

CREATE OR REPLACE MACRO get_pathway_types(station_id, to_stop, from_stop) AS TABLE (
  SELECT DISTINCT pathway_mode_name
  FROM pathway_network
  WHERE from_parent_station = station_id
    AND to_parent_station = station_id
    AND to_stop_id != from_stop_id
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (from_stop IS NULL OR from_stop_id = from_stop)
);
