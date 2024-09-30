export const CreateStationsTable = `
CREATE TABLE StationsTable
AS
(
    -- Main query for parent stations with correct exit count and refined pathway logic
    SELECT 
        s.stop_id AS stop_id,
        s.stop_name AS stop_name,
        s.stop_lat AS stop_lat,
        s.stop_lon AS stop_lon,
        -- Count only exits/entrances (location_type = 2) for each parent station
        COALESCE(
            (SELECT COUNT(*)
             FROM stops e
             WHERE e.parent_station = s.stop_id AND e.location_type = 2),
            0
        ) AS exit_count,
        s.location_type AS location_type,
        s.parent_station AS parent_station,
        -- Wheelchair boarding status as emojis
        CASE 
            s.wheelchair_boarding 
            WHEN 0 THEN '🟡'
            WHEN 1 THEN '✅'
            WHEN 2 THEN '❌'
            ELSE '❓'
        END AS wheelchair_status,
        -- Refined Pathways status (❌, 🟡, ✅) based on connections, nodes, and stops
        CASE
            -- ❌ No pathways, nodes, or stops for this parent station
            WHEN COALESCE(
                    (SELECT COUNT(p.pathway_id)
                     FROM pathways p
                     WHERE p.from_stop_id = s.stop_id OR p.to_stop_id = s.stop_id
                        OR p.from_stop_id IN (SELECT stop_id FROM stops WHERE parent_station = s.stop_id)
                        OR p.to_stop_id IN (SELECT stop_id FROM stops WHERE parent_station = s.stop_id)),
                    0
                ) = 0 
            THEN '❌'
            -- ✅ Some connections between stops and nodes exist
            WHEN COALESCE(
                    (SELECT COUNT(p.pathway_id)
                     FROM pathways p
                     WHERE p.from_stop_id = s.stop_id OR p.to_stop_id = s.stop_id
                        OR p.from_stop_id IN (SELECT stop_id FROM stops WHERE parent_station = s.stop_id)
                        OR p.to_stop_id IN (SELECT stop_id FROM stops WHERE parent_station = s.stop_id)),
                    0
                ) > 0 
            THEN '✅'
            -- 🟡 No connections, or connections but missing nodes or stops
            WHEN COALESCE(
                    (SELECT COUNT(p.pathway_id)
                     FROM pathways p
                     WHERE p.from_stop_id = s.stop_id OR p.to_stop_id = s.stop_id
                        OR p.from_stop_id IN (SELECT stop_id FROM stops WHERE parent_station = s.stop_id)
                        OR p.to_stop_id IN (SELECT stop_id FROM stops WHERE parent_station = s.stop_id)),
                    0
                ) = 0
                AND COALESCE(
                    (SELECT COUNT(*) FROM stops WHERE parent_station = s.stop_id AND location_type = 2),
                    0
                ) > 0
            THEN '🟡'
            -- Default to ❌ if no valid connections, nodes, or stops
            ELSE '❌'
        END AS pathways_status
    FROM 
        stops s
    -- Left join to find child stops (exits/entrances) for each parent station
    LEFT JOIN 
        stops e ON s.stop_id = e.parent_station AND e.location_type = 2
    WHERE 
        s.location_type = 1 -- Filter for parent stations
    GROUP BY 
        s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.location_type, s.parent_station, s.wheelchair_boarding
);
`;