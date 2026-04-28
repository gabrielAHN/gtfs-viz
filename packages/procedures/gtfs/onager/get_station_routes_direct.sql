

CREATE OR REPLACE MACRO get_station_routes_direct(
  p_station_id VARCHAR
) AS TABLE (
  WITH station_graph_timed AS (

    SELECT
      from_stop_id AS src,
      to_stop_id AS dst,
      traversal_time::DOUBLE AS weight
    FROM pathway_network
    WHERE from_parent_station = p_station_id
      AND to_parent_station = p_station_id
      AND from_stop_id IS NOT NULL
      AND to_stop_id IS NOT NULL
      AND from_stop_id != to_stop_id
      AND traversal_time IS NOT NULL
  ),
  station_stops AS (

    SELECT DISTINCT src AS stop_id
    FROM station_graph_timed
    UNION
    SELECT DISTINCT dst AS stop_id
    FROM station_graph_timed
  ),

  timed_paths AS (
    SELECT
      ss.stop_id AS start_stop,
      d.node_id AS end_stop,
      d.distance AS shortest_time
    FROM station_stops ss
    CROSS JOIN LATERAL (
      SELECT node_id, distance
      FROM onager_pth_dijkstra(
        (SELECT src, dst, weight FROM station_graph_timed),
        ss.stop_id
      )
      WHERE node_id != ss.stop_id
    ) d
  ),

  null_connections AS (
    SELECT DISTINCT
      p.from_stop_id AS start_stop,
      p.to_stop_id AS end_stop,
      NULL::DOUBLE AS shortest_time
    FROM pathway_network p
    WHERE p.from_parent_station = p_station_id
      AND p.to_parent_station = p_station_id
      AND p.from_stop_id != p.to_stop_id
      AND p.traversal_time IS NULL
  ),

  all_routes AS (
    SELECT * FROM timed_paths
    UNION ALL
    SELECT * FROM null_connections
    WHERE NOT EXISTS (
      SELECT 1 FROM timed_paths tp
      WHERE tp.start_stop = null_connections.start_stop
        AND tp.end_stop = null_connections.end_stop
    )
  )
  SELECT
    ar.start_stop,
    ar.end_stop,
    ar.shortest_time,
    s1.location_type_name AS from_location_type_name,
    s2.location_type_name AS to_location_type_name
  FROM all_routes ar
  LEFT JOIN stops s1 ON s1.stop_id = ar.start_stop
  LEFT JOIN stops s2 ON s2.stop_id = ar.end_stop
  ORDER BY ar.start_stop, ar.end_stop
);
