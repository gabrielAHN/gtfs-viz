

CREATE OR REPLACE VIEW pathway_network AS
SELECT
  p.*,

  COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) AS from_parent_station,
  s1.stop_lat AS from_lat,
  s1.stop_lon AS from_lon,
  s1.location_type_name AS from_location_type_name,

  COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) AS to_parent_station,
  s2.stop_lat AS to_lat,
  s2.stop_lon AS to_lon,
  s2.location_type_name AS to_location_type_name,

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
  END AS angle
FROM pathways p
JOIN stops s1 ON p.from_stop_id = s1.stop_id
JOIN stops s2 ON p.to_stop_id = s2.stop_id;

CREATE INDEX IF NOT EXISTS idx_pathways_from_stop ON pathways(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_pathways_to_stop ON pathways(to_stop_id);
CREATE INDEX IF NOT EXISTS idx_pathways_bidirectional ON pathways(is_bidirectional);
CREATE INDEX IF NOT EXISTS idx_stops_parent_station ON stops(parent_station);
CREATE INDEX IF NOT EXISTS idx_stops_location_type ON stops(location_type);
