

CREATE OR REPLACE MACRO find_reachable_stops_direct(
  p_station_id VARCHAR,
  start_stop VARCHAR,
  max_time DOUBLE := NULL
) AS TABLE (
  WITH station_graph AS (
    SELECT
      from_stop_id AS src,
      to_stop_id AS dst,
      COALESCE(traversal_time, 1.0)::DOUBLE AS weight
    FROM pathway_network
    WHERE from_parent_station = p_station_id
      AND to_parent_station = p_station_id
      AND from_stop_id IS NOT NULL
      AND to_stop_id IS NOT NULL
      AND from_stop_id != to_stop_id
  )
  SELECT
    node_id AS reachable_stop,
    distance AS min_time,

    CAST(CEIL(distance / 60.0) AS INTEGER) AS min_hops
  FROM onager_pth_dijkstra(
    (SELECT src, dst, weight FROM station_graph),
    start_stop
  )
  WHERE node_id != start_stop
    AND (max_time IS NULL OR distance <= max_time)
  ORDER BY distance
);
