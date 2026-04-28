

CREATE OR REPLACE MACRO get_pathway_network_info(
  p_station_id VARCHAR,
  from_stop VARCHAR := NULL,
  to_stop VARCHAR := NULL
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

  pagerank_scores AS (
    SELECT
      node_id,
      rank AS importance
    FROM onager_ctr_pagerank(
      (SELECT src, dst FROM station_graph)
    )
  )
  SELECT
    p.*,
    pr_from.importance AS from_importance,
    pr_to.importance AS to_importance,
    (pr_from.importance + pr_to.importance) / 2.0 AS pathway_importance
  FROM pathway_network p
  LEFT JOIN pagerank_scores pr_from ON p.from_stop_id = pr_from.node_id
  LEFT JOIN pagerank_scores pr_to ON p.to_stop_id = pr_to.node_id
  WHERE p.from_parent_station = p_station_id
    AND p.to_parent_station = p_station_id
    AND (from_stop IS NULL OR p.from_stop_id = from_stop)
    AND (to_stop IS NULL OR p.to_stop_id = to_stop)
  ORDER BY pathway_importance DESC
);
