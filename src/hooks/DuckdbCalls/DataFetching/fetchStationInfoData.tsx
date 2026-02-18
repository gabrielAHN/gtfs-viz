import { FetchProps } from "@/types/objectTypes";
import { buildAndQuery, executeQuery, executeColumnQuery } from "@/hooks/DuckdbCalls/QueryHelper";


const addConditions = (props: FetchProps): string[] => {
  const { SearchText, LocationsList } = props;
  const conditions: string[] = [];

  if (SearchText) {
    conditions.push(`LOWER(stop_name) LIKE '%${SearchText.toLowerCase()}%'`);
  }

  if (LocationsList && LocationsList.length > 0) {
    conditions.push(`location_type IN (${LocationsList.map(loc => `'${loc}'`).join(", ")})`);
  }

  return conditions;
};

export const fetchStationInfoData = async (props: FetchProps): Promise<{ StationParts: any[]; }> => {
  const { conn, StationView } = props;
  const stopsBaseQuery = `
    SELECT * FROM stops
    WHERE parent_station = '${StationView.stopId}'
  `;

  const stationBaseQuery = `
    SELECT * FROM StationsTable
    WHERE stop_id = '${StationView.stopId}'
  `;

  const conditions = addConditions(props);

  const StopsQuery = buildAndQuery(stopsBaseQuery, conditions);
  const StationQuery = buildAndQuery(stationBaseQuery, conditions);

  const Stops = await executeQuery(conn, StopsQuery);
  const Stations = await executeQuery(conn, StationQuery);

  const StationParts = [...Stops, ...Stations];

  return { StationParts };
};

export const fetchCheckPathways = async (props: FetchProps): Promise<{ success: boolean; error?: string; StationParts?: string[]; }> => {
  const { conn, StationView } = props;

  const PathwaysQuery = `
    SELECT * FROM StationsTable
    WHERE stop_id = '${StationView.stopId}'
    AND pathways_status = '✅'
  `;

  try {
    const PathwatsData = await executeQuery(conn, PathwaysQuery);

    if (PathwatsData && PathwatsData.length > 0) {
      return { success: true, StationParts: PathwatsData };
    } else {
      return { success: false, error: 'No pathways found for the given Station.' };
    }
  } catch (error) {
    return { success: false, error: 'Error executing query.' };
  }
};

export const fetchCheckStationData = async (props: any) => {
  const { conn, table, StationView, LocationsList, StopsID } = props;

  let StationDataQuery = `
  WITH StopsViewTable AS (
    SELECT
      *
    FROM ${table}
    WHERE 
      parent_station = '${StationView.stop_id}'
    UNION ALL
    SELECT
      *
    FROM ${table}
    WHERE 
      stop_id = '${StationView.stop_id}'
  )
  SELECT
    *
  FROM StopsViewTable
  `;
  const conditions: string[] = [];

  if (LocationsList && LocationsList.length > 0) {
    conditions.push(`
      location_type_name IN (${LocationsList.map(loc => `'${loc}'`).join(", ")})
    `);
  }

  if (StopsID) {
    conditions.push(`
      stop_id == '${StopsID}'
    `);
  }

  try {
    const ConditionsQuery = buildAndQuery(StationDataQuery, conditions);
    const StationData = await executeQuery(conn, ConditionsQuery);
    return StationData
  } catch (error) {
    return { error: 'Error executing query.' };
  }
};


export const fetchCheckStationInfo = async (props) => {
  const { conn, table, stop_id } = props;

  let StationInfoQuery = `
    WITH exit_counts AS (
      SELECT
          parent_station,
          COUNT(*) AS exit_count
      FROM ${table}
      WHERE location_type_name = 'Exit/Entrance'
      AND parent_station = '${stop_id}'
      GROUP BY parent_station
    ),
    all_pathways AS (
        SELECT 
            s.stop_id AS station_id, 
            p.pathway_id
        FROM ${table} s
        LEFT JOIN pathways p
            ON p.from_parent_station = '${stop_id}'
            OR p.to_parent_station = '${stop_id}'
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
        pc.pathway_count,
        CASE
            WHEN COALESCE(pc.pathway_count, 0) = 0 THEN '❌'
            WHEN COALESCE(pc.pathway_count, 0) > 0 THEN '✅'
            WHEN COALESCE(pc.pathway_count, 0) = 0
                AND COALESCE(e.exit_count, 0) > 0
            THEN '🟡'
            ELSE '❌'
        END AS pathways_status
    FROM ${table} s
    LEFT JOIN exit_counts e
        ON e.parent_station = s.stop_id
    LEFT JOIN pathway_counts pc
        ON pc.station_id = s.stop_id
    WHERE s.location_type_name = 'Station'
    AND s.stop_id = '${stop_id}';
  `

  try {
    const StationInfoData = await executeQuery(conn, StationInfoQuery);
    if (StationInfoData && StationInfoData.length > 0) {
      return StationInfoData[0];
    }
    return null;

  } catch (error) {
    return { error: 'Error executing query.' };
  }
};

export const fetchStationPartTypes = async (props) => {
  const { conn, table, StationView, StopsID } = props;

  let StationPartsQuery = `
    WITH StopsTypeTable AS (
      SELECT
        *
      FROM ${table}
      WHERE 
        parent_station = '${StationView.stop_id}'
      UNION ALL
      SELECT
        *
      FROM ${table}
      WHERE 
        stop_id = '${StationView.stop_id}'
    )
  SELECT
    DISTINCT location_type_name
  FROM StopsTypeTable
  `;


  const conditions: string[] = [];

  if (StopsID) {
    conditions.push(`
      stop_id = '${StopsID}'
    `);
  }

  const ConditionsQuery = buildAndQuery(StationPartsQuery, conditions);

  try {
    return executeColumnQuery(conn, ConditionsQuery, "location_type_name");
  } catch (error) {
    return { error: 'Error executing query.' };
  }
};

export const fetchStationStopIds = async (props) => {
  const { conn, table, StationView, LocationsList } = props;

  let StopIdsQuery = `
    WITH StopsIDTable AS (
      SELECT
        *
      FROM ${table}
      WHERE 
        parent_station = '${StationView.stop_id}'
      UNION ALL
      SELECT
        *
      FROM ${table}
      WHERE 
        stop_id = '${StationView.stop_id}'
    )
    SELECT
      DISTINCT stop_id
    FROM StopsIDTable
    `;
  const conditions: string[] = [];


  if (LocationsList && LocationsList.length > 0) {
    conditions.push(`
        location_type_name IN (${LocationsList.map(loc => `'${loc.location_type_name}'`).join(", ")})
      `);
  }

  try {
    const conditionsQuery = buildAndQuery(StopIdsQuery, conditions);
    return executeColumnQuery(conn, conditionsQuery, "stop_id");
  } catch (error) {
    return { error: 'Error executing query.' };
  }
};

