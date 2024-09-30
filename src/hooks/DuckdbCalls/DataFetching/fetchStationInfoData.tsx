import { FetchProps } from "@/types/objectTypes";
import { buildAndQuery, executeQuery } from "@/hooks/DuckdbCalls/QueryHelper";


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
  const { conn, StationView, SearchText, LocationsList, StopsID } = props;

  let StationDataQuery = `
  WITH StopsViewTable AS (
    SELECT
      *
    FROM stops
    WHERE 
      parent_station = '${StationView.stopId}'
    UNION ALL
    SELECT
      *
    FROM stops
    WHERE 
      stop_id = '${StationView.stopId}'
  )
  SELECT
    *
  FROM StopsViewTable
  `;
  const conditions: string[] = [];

  if (SearchText) {
    conditions.push(`
      (
        LOWER(stop_name) LIKE LOWER('%${SearchText}%') 
        OR LOWER(stop_id) LIKE LOWER('%${SearchText}%')
      )
    `);
  }

  if (LocationsList && LocationsList.length > 0) {
    conditions.push(`
      location_type_name IN (${LocationsList.map(loc => `'${loc.location_type_name}'`).join(", ")})
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
    return { StationData: StationData };
  } catch (error) {
    return { error: 'Error executing query.' };
  }
};


export const fetchCheckStationInfo = async (props) => {
  const { conn, StationView } = props;

  let StationInfoQuery = `
    SELECT
      *
    FROM StationsTable
    WHERE 
      stop_id = '${StationView.stopId}'
  `;
  
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
  const { conn, StationView, SearchText, StopsID  } = props;

  let StationPartsQuery = `
    WITH StopsTypeTable AS (
      SELECT
        *
      FROM stops
      WHERE 
        parent_station = '${StationView.stopId}'
      UNION ALL
      SELECT
        *
      FROM stops
      WHERE 
        stop_id = '${StationView.stopId}'
    )
  SELECT
    DISTINCT location_type_name
  FROM StopsTypeTable
  `;


  const conditions: string[] = [];

  if (SearchText) {
    conditions.push(`
      (
        LOWER(stop_name) LIKE LOWER('%${SearchText}%') 
        OR LOWER(stop_id) LIKE LOWER('%${SearchText}%')
      )
    `);
  }

  if (StopsID) {
    conditions.push(`
      stop_id = '${StopsID}'
    `);
  }

  const ConditionsQuery = buildAndQuery(StationPartsQuery, conditions);

  try {
    const StationPartsData = await executeQuery(conn, ConditionsQuery);
    return { StationPartsData: StationPartsData };
  } catch (error) {
    return { error: 'Error executing query.' };
  }
};

export const fetchStationStopIds = async (props) => {
    const { conn, StationView, SearchText, LocationsList } = props;
  
    let StopIdsQuery = `
    WITH StopsIDTable AS (
      SELECT
        *
      FROM stops
      WHERE 
        parent_station = '${StationView.stopId}'
      UNION ALL
      SELECT
        *
      FROM stops
      WHERE 
        stop_id = '${StationView.stopId}'
    )
    SELECT
      DISTINCT stop_id
    FROM StopsIDTable
    `;
    const conditions: string[] = [];

    
    if (SearchText) {
      conditions.push(`
        (
          LOWER(stop_name) LIKE LOWER('%${SearchText}%') 
          OR LOWER(stop_id) LIKE LOWER('%${SearchText}%')
        )
      `);
    }
  
    if (LocationsList && LocationsList.length > 0) {
      conditions.push(`
        location_type_name IN (${LocationsList.map(loc => `'${loc.location_type_name}'`).join(", ")})
      `);
    }
  
    try {
      const conditionsQuery = buildAndQuery(StopIdsQuery, conditions);
      const StopIdsData = await executeQuery(conn, conditionsQuery);
      return { StopIdsData: StopIdsData };
    } catch (error) {
      return { error: 'Error executing query.' };
    }
  };

