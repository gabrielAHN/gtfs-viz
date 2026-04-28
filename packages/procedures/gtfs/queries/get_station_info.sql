

CREATE OR REPLACE MACRO get_station_info(station_id) AS TABLE (
  WITH station_base AS (
    SELECT
      row_id,
      stop_id,
      stop_name,
      stop_lat,
      stop_lon,
      '🔵' AS status,
      location_type_name,
      parent_station,
      wheelchair_status
    FROM stops
    WHERE location_type_name = 'Station'
      AND stop_id = station_id
  ),
  exit_counts AS (
    SELECT
      COUNT(*) AS exit_count
    FROM stops
    WHERE location_type_name = 'Exit/Entrance'
      AND parent_station = station_id
  ),
  pathway_counts AS (
    SELECT
      COUNT(DISTINCT p.pathway_id) AS pathway_count
    FROM pathways p
    JOIN stops s1 ON p.from_stop_id = s1.stop_id
    JOIN stops s2 ON p.to_stop_id = s2.stop_id
    WHERE (
      COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) = station_id
      AND COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) = station_id
    )
  )
  SELECT
    s.row_id,
    s.stop_id,
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    s.status,
    COALESCE(e.exit_count, 0) AS exit_count,
    s.location_type_name,
    s.parent_station,
    s.wheelchair_status,
    COALESCE(pc.pathway_count, 0) AS pathway_count,
    CASE
      WHEN COALESCE(pc.pathway_count, 0) = 0 THEN '❌'
      WHEN COALESCE(pc.pathway_count, 0) > 0 THEN '✅'
      WHEN COALESCE(pc.pathway_count, 0) = 0
        AND COALESCE(e.exit_count, 0) > 0
      THEN '🟡'
      ELSE '❌'
    END AS pathways_status
  FROM station_base s
  CROSS JOIN exit_counts e
  CROSS JOIN pathway_counts pc
);
