

CREATE OR REPLACE MACRO get_station_stops(station_id) AS TABLE (
  SELECT DISTINCT
    s.stop_id,
    s.stop_name,
    s.stop_lat,
    s.stop_lon,
    s.location_type_name
  FROM stops s
  WHERE s.parent_station = station_id
    AND s.stop_lat IS NOT NULL
    AND s.stop_lon IS NOT NULL
  ORDER BY s.stop_id
);
