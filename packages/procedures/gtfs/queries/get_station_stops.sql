

CREATE OR REPLACE MACRO get_station_stops(station_id) AS TABLE (
  WITH station_stops AS (
    SELECT
      s.row_id,
      s.stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      s.location_type_name,
      s.parent_station,
      s.level_id,
      s.wheelchair_status,
      s.status
    FROM StopsView s

    UNION ALL

    SELECT
      edt.row_id,
      edt.stop_id,
      edt.stop_name,
      edt.stop_lat,
      edt.stop_lon,
      edt.location_type_name,
      edt.parent_station,
      edt.level_id,
      edt.wheelchair_status,
      edt.status
    FROM EditStopTable edt
    WHERE edt.status = 'deleted'
      AND NOT EXISTS (
        SELECT 1
        FROM StopsView s
        WHERE s.stop_id = edt.stop_id
      )
  )
  SELECT DISTINCT
    s.row_id,
    s.stop_id,
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    s.location_type_name,
    s.parent_station,
    s.level_id,
    s.wheelchair_status,
    s.status
  FROM station_stops s
  WHERE COALESCE(NULLIF(s.parent_station, ''), s.stop_id) = station_id
  ORDER BY s.stop_id
);
