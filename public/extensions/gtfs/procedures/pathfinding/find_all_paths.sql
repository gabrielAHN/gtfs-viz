

CREATE OR REPLACE MACRO find_all_paths(
  p_station_id VARCHAR,
  start_stop VARCHAR,
  end_stop VARCHAR,
  max_hops INTEGER := 5
) AS TABLE (
  WITH RECURSIVE all_paths AS (

    SELECT
      from_stop_id,
      to_stop_id,
      COALESCE(traversal_time, 0) AS total_time,
      1 AS hop_count,
      ARRAY[from_stop_id] AS visited_stops,
      ARRAY[pathway_id] AS path_ids,
      from_stop_id || ' -> ' || to_stop_id AS route
    FROM pathway_network
    WHERE from_parent_station = p_station_id
      AND to_parent_station = p_station_id
      AND from_stop_id = start_stop
      AND to_stop_id != from_stop_id

    UNION ALL

    SELECT
      ap.from_stop_id,
      pr.to_stop_id,
      ap.total_time + COALESCE(pr.traversal_time, 0) AS total_time,
      ap.hop_count + 1 AS hop_count,
      array_append(ap.visited_stops, pr.from_stop_id) AS visited_stops,
      array_append(ap.path_ids, pr.pathway_id) AS path_ids,
      ap.route || ' -> ' || pr.to_stop_id AS route
    FROM all_paths ap
    JOIN pathway_network pr
      ON ap.to_stop_id = pr.from_stop_id
      AND pr.from_parent_station = p_station_id
      AND pr.to_parent_station = p_station_id
      AND pr.to_stop_id != pr.from_stop_id
    WHERE ap.hop_count < max_hops
      AND NOT list_contains(ap.visited_stops, pr.to_stop_id)
  )
  SELECT
    total_time,
    hop_count,
    path_ids,
    route
  FROM all_paths
  WHERE to_stop_id = end_stop
  ORDER BY total_time, hop_count
);
