export const CreateStationsTable = `
CREATE OR REPLACE TABLE StationsTable AS
WITH exit_counts AS (
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
    FROM StopsView s
    LEFT JOIN stops st 
        ON st.parent_station = s.stop_id
    LEFT JOIN pathways p
        ON p.from_stop_id IN (s.stop_id, st.stop_id)
        OR p.to_stop_id   IN (s.stop_id, st.stop_id)
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
FROM StopsView s

LEFT JOIN exit_counts e
    ON e.parent_station = s.stop_id

LEFT JOIN pathway_counts pc
    ON pc.station_id = s.stop_id
WHERE s.location_type_name = 'Station';
`;

export const CreateEditStopTable = `
CREATE or REPLACE TABLE EditStopTable (
    row_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    stop_name TEXT NOT NULL,
    stop_lat DOUBLE PRECISION NOT NULL,
    stop_lon DOUBLE PRECISION NOT NULL,
    location_type_name TEXT,
    parent_station TEXT,
    wheelchair_status TEXT,
    status TEXT
);
`;


export const CreateStationView = `
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
) combined;
`;
