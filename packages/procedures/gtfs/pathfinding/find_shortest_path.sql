

CREATE OR REPLACE MACRO find_shortest_path(
  p_station_id VARCHAR,
  start_stop VARCHAR,
  end_stop VARCHAR,
  max_hops INTEGER := 10
) AS TABLE (
  WITH RECURSIVE path_search AS (
    SELECT
      from_stop_id AS current_stop,
      to_stop_id AS next_stop,
      pathway_id,
      pathway_mode_name,
      COALESCE(traversal_time, 0) AS segment_time,
      COALESCE(traversal_time, 0) AS total_time,
      1 AS hop_count,
      ARRAY[from_stop_id] AS visited_stops,
      ARRAY[pathway_id] AS path_ids,
      from_stop_id || ' -> ' || to_stop_id AS path_description
    FROM pathway_network
    WHERE from_parent_station = p_station_id
      AND to_parent_station = p_station_id
      AND from_stop_id = start_stop
      AND to_stop_id != from_stop_id

    UNION ALL

    SELECT
      ps.next_stop AS current_stop,
      pr.to_stop_id AS next_stop,
      pr.pathway_id,
      pr.pathway_mode_name,
      COALESCE(pr.traversal_time, 0) AS segment_time,
      ps.total_time + COALESCE(pr.traversal_time, 0) AS total_time,
      ps.hop_count + 1 AS hop_count,
      array_append(ps.visited_stops, pr.from_stop_id) AS visited_stops,
      array_append(ps.path_ids, pr.pathway_id) AS path_ids,
      ps.path_description || ' -> ' || pr.to_stop_id AS path_description
    FROM path_search ps
    JOIN pathway_network pr
      ON ps.next_stop = pr.from_stop_id
      AND pr.from_parent_station = p_station_id
      AND pr.to_parent_station = p_station_id
      AND pr.to_stop_id != pr.from_stop_id
    WHERE ps.hop_count < max_hops
      AND NOT list_contains(ps.visited_stops, pr.to_stop_id)
  )
  SELECT
    current_stop,
    next_stop AS destination,
    total_time,
    hop_count,
    path_ids,
    visited_stops,
    path_description
  FROM path_search
  WHERE next_stop = end_stop
  ORDER BY total_time ASC, hop_count ASC
  LIMIT 1
);
