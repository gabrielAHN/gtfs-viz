import { FetchProps } from "@/types/objectTypes";
import { buildAndQuery, executeQuery, executeColumnQuery } from "@/lib/duckdb/QueryHelper";
import { logger } from "@/lib/logger";
import { recreateStopsView } from "@/lib/extensions";

let viewRecreated = false;

const ensureProceduresLoaded = async (conn: any) => {
  
  if (!viewRecreated) {
    await recreateStopsView(conn);
    viewRecreated = true;
  }
  return true;
};

export const resetStationInfoProceduresFlag = () => {
  viewRecreated = false;
};

const checkTablesExist = async (conn: any): Promise<boolean> => {
  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name IN ('stops', 'pathways')
    `);
    const count = result.toArray()[0]?.count || 0;
    return Number(count) >= 1; 
  } catch (error) {
    return false;
  }
};

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
    const errorMsg = error?.message || String(error);
    
    if (!errorMsg.includes('does not exist')) {
      logger.error('[fetchCheckStationData] Error:', error);
    }
    return { error: 'Error executing query.' };
  }
};

export const fetchCheckStationInfo = async (props) => {
  const { conn, stop_id } = props;

  try {
    
    const tablesExist = await checkTablesExist(conn);
    if (!tablesExist) {
      logger.log('⚠️ Required tables (stops, pathways) do not exist yet');
      return null;
    }

    const proceduresReady = await ensureProceduresLoaded(conn);
    if (!proceduresReady) {
      logger.log('⚠️ Procedures not ready - tables may be missing');
      return null;
    }

    const query = `SELECT * FROM get_station_info('${stop_id}')`;
    const StationInfoData = await executeQuery(conn, query);

    if (StationInfoData && StationInfoData.length > 0) {
      return StationInfoData[0];
    }
    return null;

  } catch (error) {
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes('does not exist')) {
      logger.log('⚠️ Tables/procedures not found - database likely being reset');
      return null;
    }

    logger.error('[fetchCheckStationInfo] Error:', error);
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
      location_type_name,
      stop_id
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
    const result = await executeQuery(conn, ConditionsQuery);

    const groupedByType = result.reduce((acc, row) => {
      const typeName = row.location_type_name;
      if (!acc[typeName]) {
        acc[typeName] = [];
      }
      acc[typeName].push({
        label: row.stop_id,
        value: row.stop_id
      });
      return acc;
    }, {});

    return Object.keys(groupedByType).map(typeName => ({
      label: typeName,
      value: typeName,
      stops: groupedByType[typeName]
    }));
  } catch (error) {
    const errorMsg = error?.message || String(error);
    
    if (!errorMsg.includes('does not exist')) {
      logger.error('Error in fetchStationPartTypes:', error);
    }
    return [];
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
