

CREATE OR REPLACE MACRO get_station_network_stats(
  p_station_id VARCHAR
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
  ),
  pagerank_result AS (
    SELECT
      node_id,
      rank
    FROM onager_ctr_pagerank(
      (SELECT src, dst FROM station_graph)
    )
  ),
  basic_stats AS (
    SELECT
      COUNT(DISTINCT src) AS total_nodes,
      COUNT(*) AS total_edges,
      AVG(weight) AS avg_traversal_time,
      MIN(weight) AS min_traversal_time,
      MAX(weight) AS max_traversal_time
    FROM station_graph
  )
  SELECT
    p_station_id AS station_id,
    bs.total_nodes,
    bs.total_edges,
    bs.avg_traversal_time,
    bs.min_traversal_time,
    bs.max_traversal_time,
    (SELECT node_id FROM pagerank_result ORDER BY rank DESC LIMIT 1) AS most_important_stop,
    (SELECT MAX(rank) FROM pagerank_result) AS max_importance
  FROM basic_stats bs
);
