

CREATE OR REPLACE MACRO get_direct_pathways(
  p_station_id VARCHAR,
  from_stop VARCHAR := NULL,
  to_stop VARCHAR := NULL,
  direction_filter VARCHAR := NULL,
  pathway_types VARCHAR[] := NULL
) AS TABLE (
  SELECT
    pathway_id,
    from_stop_id,
    to_stop_id,
    from_lat,
    from_lon,
    to_lat,
    to_lon,
    traversal_time,
    pathway_mode_name,
    pathway_mode,
    direction_type,
    is_bidirectional
  FROM pathway_network
  WHERE from_parent_station = p_station_id
    AND to_parent_station = p_station_id
    AND (from_stop IS NULL OR from_stop_id = from_stop)
    AND (to_stop IS NULL OR to_stop_id = to_stop)
    AND (direction_filter IS NULL OR direction_type = direction_filter)
    AND (pathway_types IS NULL OR list_contains(pathway_types, pathway_mode_name))
);
