

CREATE OR REPLACE MACRO get_station_pathways(station_id) AS TABLE (
  WITH stop_lookup AS (
    SELECT
      s.stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      s.location_type_name,
      s.parent_station,
      s.status
    FROM StopsView s

    UNION ALL

    SELECT
      edt.stop_id,
      edt.stop_name,
      edt.stop_lat,
      edt.stop_lon,
      edt.location_type_name,
      edt.parent_station,
      edt.status
    FROM EditStopTable edt
    WHERE edt.status = 'deleted'
      AND NOT EXISTS (
        SELECT 1
        FROM StopsView s
        WHERE s.stop_id = edt.stop_id
      )
  )
  SELECT
    p.row_id,
    p.pathway_id,
    p.from_stop_id,
    p.to_stop_id,
    s1.stop_lat as from_lat,
    s1.stop_lon as from_lon,
    s2.stop_lat as to_lat,
    s2.stop_lon as to_lon,
    p.traversal_time,
    p.length,
    p.stair_count,
    p.max_slope,
    p.min_width,
    p.signposted_as,
    p.reversed_signposted_as,
    COALESCE(p.pathway_mode_name, pathway_mode_to_name(p.pathway_mode)) as pathway_mode_name,
    p.pathway_mode,
    COALESCE(p.direction_type, bidirectional_to_direction(p.is_bidirectional)) as direction_type,
    p.is_bidirectional,
    p.status,
    s1.location_type_name AS from_location_type_name,
    s2.location_type_name AS to_location_type_name,
    COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) AS from_parent_station,
    COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) AS to_parent_station,
    CASE
      WHEN s1.stop_lat IS NOT NULL AND s1.stop_lon IS NOT NULL
           AND s2.stop_lat IS NOT NULL AND s2.stop_lon IS NOT NULL
      THEN DEGREES(
        ATAN2(
          s2.stop_lon - s1.stop_lon,
          s2.stop_lat - s1.stop_lat
        )
      )
      ELSE NULL
    END as angle
  FROM PathwaysView p
  LEFT JOIN stop_lookup s1 ON p.from_stop_id = s1.stop_id
  LEFT JOIN stop_lookup s2 ON p.to_stop_id = s2.stop_id
  WHERE COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) = station_id
     OR COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) = station_id
  ORDER BY p.pathway_id
);
