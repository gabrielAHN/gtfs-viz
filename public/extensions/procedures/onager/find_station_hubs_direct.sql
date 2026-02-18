

CREATE OR REPLACE MACRO find_station_hubs_direct(
  p_station_id VARCHAR,
  top_n INTEGER := 10
) AS TABLE (
  WITH station_graph AS (
    SELECT
      from_stop_id AS src,
      to_stop_id AS dst
    FROM pathway_network
    WHERE from_parent_station = p_station_id
      AND to_parent_station = p_station_id
      AND from_stop_id IS NOT NULL
      AND to_stop_id IS NOT NULL
  )
  SELECT
    pr.node_id AS stop_id,
    ROUND(pr.rank, 4) AS importance_score,
    s.stop_name,
    s.location_type_name
  FROM onager_pth_pagerank(
    (SELECT src, dst FROM station_graph)
  ) pr
  LEFT JOIN stops s ON pr.node_id = s.stop_id
  ORDER BY pr.rank DESC
  LIMIT top_n
);
