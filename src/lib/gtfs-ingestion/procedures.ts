

export const CREATE_EDIT_STOP_TABLE = `
CREATE OR REPLACE TABLE EditStopTable (
    row_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    stop_name TEXT NOT NULL,
    stop_lat DOUBLE PRECISION NOT NULL,
    stop_lon DOUBLE PRECISION NOT NULL,
    location_type_name TEXT,
    parent_station TEXT,
    wheelchair_status TEXT,
    status TEXT,
    new_stop_name TEXT,
    new_location_type TEXT
)`;

export const CREATE_STOPS_VIEW = `
CREATE OR REPLACE VIEW StopsView AS
SELECT
  row_id,
  stop_id,
  stop_name,
  stop_lat,
  stop_lon,
  location_type_name,
  parent_station,
  wheelchair_status,
  status
FROM (
  SELECT
    edt.row_id,
    edt.stop_id,
    edt.stop_name,
    edt.stop_lat,
    edt.stop_lon,
    edt.location_type_name,
    edt.parent_station,
    edt.wheelchair_status,
    edt.status
  FROM EditStopTable edt
  WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT
    st.row_id,
    st.stop_id,
    st.stop_name,
    st.stop_lat,
    st.stop_lon,
    st.location_type_name,
    st.parent_station,
    st.wheelchair_status,
    '' AS status
  FROM stops st
  WHERE NOT EXISTS (
    SELECT 1
    FROM EditStopTable edt
    WHERE edt.row_id = st.row_id
      AND edt.status = 'deleted'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM EditStopTable edt
    WHERE edt.row_id = st.row_id
      AND edt.status = 'edit'
  )
) combined`;

export const CREATE_STATION_VIEW_MACROS = `
CREATE OR REPLACE MACRO get_stops_view_data() AS TABLE (
  SELECT
    row_id,
    stop_id,
    stop_name,
    stop_lat,
    stop_lon,
    location_type_name,
    parent_station,
    wheelchair_status,
    COALESCE(status, '') AS status
  FROM (
    SELECT
      edt.row_id,
      edt.stop_id,
      edt.stop_name,
      edt.stop_lat,
      edt.stop_lon,
      edt.location_type_name,
      edt.parent_station,
      edt.wheelchair_status,
      edt.status
    FROM EditStopTable edt
    WHERE edt.status IN ('new', 'edit', 'new edit')
    UNION ALL
    SELECT
      st.row_id,
      st.stop_id,
      st.stop_name,
      st.stop_lat,
      st.stop_lon,
      st.location_type_name,
      st.parent_station,
      st.wheelchair_status,
      '' AS status
    FROM stops st
    WHERE NOT EXISTS (
      SELECT 1
      FROM EditStopTable edt
      WHERE edt.row_id = st.row_id
        AND edt.status = 'deleted'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM EditStopTable edt
      WHERE edt.row_id = st.row_id
        AND edt.status = 'edit'
    )
  ) combined
);

CREATE OR REPLACE MACRO get_stops_table_data() AS TABLE (
  SELECT
    row_id,
    stop_id,
    stop_name,
    stop_lat,
    stop_lon,
    COALESCE(status, '') AS status,
    location_type_name,
    parent_station,
    wheelchair_status
  FROM StopsView
  WHERE location_type_name != 'Station'
    AND (parent_station IS NULL OR parent_station = '')
);

CREATE OR REPLACE MACRO get_stations_table_data() AS TABLE (
  WITH stations_base AS (
    SELECT
      row_id,
      stop_id,
      stop_name,
      stop_lat,
      stop_lon,
      location_type_name,
      parent_station,
      wheelchair_status,
      COALESCE(status, '') AS status
    FROM StopsView
    WHERE location_type_name = 'Station'
  ),
  exit_counts AS (
    SELECT
      parent_station,
      COUNT(*) AS exit_count
    FROM StopsView
    WHERE location_type_name = 'Exit/Entrance'
    GROUP BY parent_station
  ),
  all_pathways AS (
    SELECT
      s.stop_id AS station_id,
      p.pathway_id
    FROM stations_base s
    LEFT JOIN stops st
      ON st.parent_station = s.stop_id
    LEFT JOIN pathways p
      ON p.from_stop_id IN (s.stop_id, st.stop_id)
      OR p.to_stop_id IN (s.stop_id, st.stop_id)
    LEFT JOIN stops from_stop
      ON p.from_stop_id = from_stop.stop_id
    LEFT JOIN stops to_stop
      ON p.to_stop_id = to_stop.stop_id
    WHERE p.pathway_id IS NOT NULL
      AND from_stop.stop_lat IS NOT NULL
      AND from_stop.stop_lon IS NOT NULL
      AND to_stop.stop_lat IS NOT NULL
      AND to_stop.stop_lon IS NOT NULL
  ),
  pathway_counts AS (
    SELECT
      station_id,
      COUNT(DISTINCT pathway_id) AS pathway_count
    FROM all_pathways
    GROUP BY station_id
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
    CASE
      WHEN COALESCE(pc.pathway_count, 0) = 0 THEN '❌'
      WHEN COALESCE(pc.pathway_count, 0) > 0 THEN '✅'
      WHEN COALESCE(pc.pathway_count, 0) = 0
           AND COALESCE(e.exit_count, 0) > 0
      THEN '🟡'
      ELSE '❌'
    END AS pathways_status
  FROM stations_base s
  LEFT JOIN exit_counts e
    ON e.parent_station = s.stop_id
  LEFT JOIN pathway_counts pc
    ON pc.station_id = s.stop_id
)`;

export const CREATE_STOPS_TABLE = `CREATE OR REPLACE TABLE StopsTable AS SELECT * FROM get_stops_table_data()`;

export const CREATE_STATIONS_TABLE = `CREATE OR REPLACE TABLE StationsTable AS SELECT * FROM get_stations_table_data()`;

export const INITIALIZE_PATHWAY_NETWORK = `
CREATE OR REPLACE VIEW pathway_network AS
SELECT
  p.row_id,
  p.pathway_id,
  p.from_stop_id,
  p.to_stop_id,
  p.pathway_mode,
  p.is_bidirectional,
  p.length,
  p.traversal_time,
  p.stair_count,
  p.max_slope,
  p.min_width,
  p.signposted_as,
  p.reversed_signposted_as,
  p.pathway_mode_name,
  p.direction_type,

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
JOIN stops s2 ON p.to_stop_id = s2.stop_id`;

export const CREATE_PATHWAY_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_pathways_from_stop ON pathways(from_stop_id);
CREATE INDEX IF NOT EXISTS idx_pathways_to_stop ON pathways(to_stop_id);
CREATE INDEX IF NOT EXISTS idx_pathways_bidirectional ON pathways(is_bidirectional);
CREATE INDEX IF NOT EXISTS idx_stops_parent_station ON stops(parent_station);
CREATE INDEX IF NOT EXISTS idx_stops_location_type ON stops(location_type)`;
