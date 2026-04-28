

CREATE OR REPLACE MACRO find_shortest_path_direct(
  p_station_id VARCHAR,
  start_stop VARCHAR,
  end_stop VARCHAR
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
  ),
  dijkstra_result AS (

    SELECT
      node_id AS stop_id,
      distance AS cumulative_time
    FROM onager_pth_dijkstra(
      (SELECT src, dst, weight FROM station_graph),
      start_stop
    )
  ),

  path_reconstruction AS (
    SELECT
      start_stop AS current_stop,
      end_stop AS destination,
      dr_end.cumulative_time AS total_time,

      (SELECT COUNT(*)
       FROM dijkstra_result dr
       WHERE dr.cumulative_time > 0
         AND dr.cumulative_time <= dr_end.cumulative_time) AS hop_count,

      (SELECT LIST(p.pathway_id ORDER BY dr.cumulative_time)
       FROM dijkstra_result dr
       JOIN pathway_network p ON (
         p.from_stop_id = start_stop AND p.to_stop_id = dr.stop_id
         OR EXISTS (
           SELECT 1 FROM dijkstra_result dr2
           WHERE p.from_stop_id = dr2.stop_id
             AND p.to_stop_id = dr.stop_id
             AND dr2.cumulative_time < dr.cumulative_time
         )
       )
       WHERE dr.cumulative_time > 0
         AND dr.cumulative_time <= dr_end.cumulative_time
         AND p.from_parent_station = p_station_id
      ) AS path_ids,

      (SELECT LIST(stop_id ORDER BY cumulative_time)
       FROM dijkstra_result
       WHERE cumulative_time > 0
         AND cumulative_time <= dr_end.cumulative_time
      ) AS visited_stops,

      (SELECT STRING_AGG(stop_id, ' -> ' ORDER BY cumulative_time)
       FROM dijkstra_result
       WHERE cumulative_time >= 0
         AND cumulative_time <= dr_end.cumulative_time
      ) AS path_description
    FROM dijkstra_result dr_end
    WHERE dr_end.stop_id = end_stop
  )
  SELECT * FROM path_reconstruction
);
