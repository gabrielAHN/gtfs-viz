

CREATE OR REPLACE MACRO find_reachable_stops(
  p_station_id VARCHAR,
  start_stop VARCHAR,
  max_time INTEGER := NULL,
  max_hops INTEGER := 5
) AS TABLE (
  WITH RECURSIVE reachability AS (
    SELECT
      to_stop_id AS reachable_stop,
      COALESCE(traversal_time, 0) AS total_time,
      1 AS hop_count,
      ARRAY[from_stop_id, to_stop_id] AS path
    FROM pathway_network
    WHERE from_parent_station = p_station_id
      AND to_parent_station = p_station_id
      AND from_stop_id = start_stop
      AND to_stop_id != from_stop_id

    UNION

    SELECT
      pr.to_stop_id AS reachable_stop,
      r.total_time + COALESCE(pr.traversal_time, 0) AS total_time,
      r.hop_count + 1 AS hop_count,
      array_append(r.path, pr.to_stop_id) AS path
    FROM reachability r
    JOIN pathway_network pr
      ON r.reachable_stop = pr.from_stop_id
      AND pr.from_parent_station = p_station_id
      AND pr.to_parent_station = p_station_id
      AND pr.to_stop_id != pr.from_stop_id
    WHERE r.hop_count < max_hops
      AND NOT list_contains(r.path, pr.to_stop_id)
      AND (max_time IS NULL OR r.total_time + COALESCE(pr.traversal_time, 0) <= max_time)
  )
  SELECT DISTINCT
    reachable_stop,
    MIN(total_time) AS min_time,
    MIN(hop_count) AS min_hops
  FROM reachability
  GROUP BY reachable_stop
  ORDER BY min_time, min_hops
);
