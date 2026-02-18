import { WheelchairStatus } from "@/components/style"

export const ReformatStopsTable = `
CREATE OR REPLACE TABLE stops AS
    SELECT
        ROW_NUMBER() OVER () AS row_id,
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
            ${
                Object.entries(WheelchairStatus)
                    .map(([icon, { value }]) => {
                    return `WHEN wheelchair_boarding = ${value} THEN '${icon}'`;
                    })
                    .join("\n        ")
                }
            ELSE '🟡'
        END AS wheelchair_status
    FROM stops;
`

export const ReformatPathwaysTable = `
    CREATE OR REPLACE TABLE pathways AS
        SELECT
        ROW_NUMBER() OVER () AS row_id,
        p.*,
        from_stops.parent_station AS from_parent_station,
        from_stops.stop_lat AS from_lat,
        from_stops.stop_lon AS from_lon,
        from_stops.location_type_name as from_location_type_name,
        to_stops.stop_lat AS to_lat,
        to_stops.stop_lon AS to_lon,
        to_stops.parent_station AS to_parent_station,
        to_stops.location_type_name as to_location_type_name,
        p.pathway_mode,
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
        p.is_bidirectional,
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
      ON p.to_stop_id = to_stops.stop_id;
`

export const EditMergeQuery = (
    columns: string[],
    mappedColumns: string[],
    tableName: string,
    editTable: string,
    merge_id: string
  ) => `
  SELECT ${columns.join(", ")}
    FROM (
      SELECT
          edt.row_id,
          ${mappedColumns.join(", ")}
      FROM ${editTable} edt
      WHERE edt.status IN ('new', 'edit', 'new edit')
        UNION ALL
      SELECT
          st.row_id,
          ${columns.join(", ")}
      FROM ${tableName} st
      WHERE NOT EXISTS (
          SELECT 1
          FROM ${editTable} edt
          WHERE edt.row_id = st.row_id
          AND edt.status = 'deleted'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM ${editTable} edt
          WHERE edt.row_id = st.row_id
          AND edt.status = 'edit'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM ${editTable} edt
          WHERE edt.${merge_id} = st.${merge_id}
          AND edt.status = 'new edit'
      )
    ) combined
  `;
  