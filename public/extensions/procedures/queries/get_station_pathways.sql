

CREATE OR REPLACE MACRO get_station_pathways(station_id) AS TABLE (
  SELECT
    p.pathway_id,
    p.from_stop_id,
    p.to_stop_id,
    s1.stop_lat as from_lat,
    s1.stop_lon as from_lon,
    s2.stop_lat as to_lat,
    s2.stop_lon as to_lon,
    p.traversal_time,
    COALESCE(p.pathway_mode_name, pathway_mode_to_name(p.pathway_mode)) as pathway_mode_name,
    p.pathway_mode,
    COALESCE(p.direction_type, bidirectional_to_direction(p.is_bidirectional)) as direction_type,
    p.is_bidirectional,
    0 as angle
  FROM pathways p
  JOIN stops s1 ON p.from_stop_id = s1.stop_id
  JOIN stops s2 ON p.to_stop_id = s2.stop_id
  WHERE (
    COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) = station_id
    AND COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) = station_id
  )
  AND s1.stop_lat IS NOT NULL
  AND s1.stop_lon IS NOT NULL
  AND s2.stop_lat IS NOT NULL
  AND s2.stop_lon IS NOT NULL
  ORDER BY p.pathway_id
);
