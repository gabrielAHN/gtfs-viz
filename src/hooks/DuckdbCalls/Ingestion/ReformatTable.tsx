export const ReformatStopsTable = `
    CREATE OR REPLACE TABLE stops AS
        SELECT
        *,
        CASE
            WHEN location_type = 0 THEN 'Platform'
            WHEN location_type = 1 THEN 'Station'
            WHEN location_type = 2 THEN 'Exit/Entrance'
            WHEN location_type = 3 THEN 'Pathway Node'
            WHEN location_type = 4 THEN 'Unknown'
            ELSE 'Unknown'
        END AS location_type_name,
        CASE
            WHEN wheelchair_boarding = 0 THEN '❓'
            WHEN wheelchair_boarding = 1 THEN '✅'
            WHEN wheelchair_boarding = 2 THEN '❌'
            ELSE '❓'
        END AS wheelchair_boarding_name 
    FROM stops;
`

export const ReformatPathwaysTable = `
    CREATE OR REPLACE TABLE pathways AS
        SELECT
        p.*,
        from_stops.parent_station AS from_parent_station,
        from_stops.stop_lat AS from_lat,
        from_stops.stop_lon AS from_lon,
        from_stops.location_type_name as from_location_type_name,
        to_stops.stop_lat AS to_lat,
        to_stops.stop_lon AS to_lon,
        to_stops.parent_station AS to_parent_station,
        to_stops.location_type_name as to_location_type_name,
        CASE 
            p.pathway_mode
            WHEN 1 THEN 'Walkway'
            WHEN 2 THEN 'Stairs'
            WHEN 3 THEN 'Moving sidewalk/travelator'
            WHEN 4 THEN 'Escalator'
            WHEN 5 THEN 'Elevator'
            WHEN 6 THEN 'Fare gate'
            WHEN 7 THEN 'Exit gate'
            ELSE '❓'
        END AS pathway_mode_name,
        CASE 
            p.is_bidirectional
            WHEN 0 THEN 'directional'
            WHEN 1 THEN 'bidirectional'
            ELSE 'unknown'
        END AS direction_type
    FROM pathways p
    JOIN stops from_stops
      ON p.from_stop_id = from_stops.stop_id
    JOIN stops to_stops
      ON p.to_stop_id = to_stops.stop_id
`