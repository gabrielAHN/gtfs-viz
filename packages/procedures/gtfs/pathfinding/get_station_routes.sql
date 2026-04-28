

CREATE OR REPLACE MACRO get_station_routes(
  p_station_id VARCHAR
) AS TABLE (
  WITH RECURSIVE shortest_paths AS (

    SELECT
      p.from_stop_id AS start_stop,
      p.to_stop_id AS end_stop,
      p.traversal_time AS total_time,
      1 AS hop_count,
      ARRAY[p.from_stop_id] AS path_stops
    FROM pathway_network p
    WHERE p.from_parent_station = p_station_id
      AND p.to_parent_station = p_station_id
      AND p.from_stop_id != p.to_stop_id
      AND p.traversal_time IS NOT NULL

    UNION

    SELECT
      sp.start_stop,
      p.to_stop_id AS end_stop,
      sp.total_time + p.traversal_time AS total_time,
      sp.hop_count + 1 AS hop_count,
      array_append(sp.path_stops, p.to_stop_id) AS path_stops
    FROM shortest_paths sp
    JOIN pathway_network p
      ON sp.end_stop = p.from_stop_id
      AND p.from_parent_station = p_station_id
      AND p.to_parent_station = p_station_id
      AND p.traversal_time IS NOT NULL
    WHERE sp.hop_count < 8
      AND p.to_stop_id != sp.start_stop
      AND NOT list_contains(sp.path_stops, p.to_stop_id)
      AND NOT EXISTS (
        SELECT 1 FROM shortest_paths sp2
        WHERE sp2.start_stop = sp.start_stop
          AND sp2.end_stop = p.to_stop_id
          AND sp2.total_time <= sp.total_time + p.traversal_time
      )
  ),

  min_paths AS (
    SELECT
      start_stop,
      end_stop,
      MIN(total_time) AS shortest_time
    FROM shortest_paths
    GROUP BY start_stop, end_stop
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
    SELECT * FROM min_paths
    UNION ALL
    SELECT * FROM null_connections
    WHERE NOT EXISTS (
      SELECT 1 FROM min_paths mp
      WHERE mp.start_stop = null_connections.start_stop
        AND mp.end_stop = null_connections.end_stop
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
