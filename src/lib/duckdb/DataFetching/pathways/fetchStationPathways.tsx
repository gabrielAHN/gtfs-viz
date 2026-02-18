

import { executeQuery } from "@/lib/duckdb/QueryHelper";
import { logger } from "@/lib/logger";
import { TimeIntervalColors } from "@/components/style";
import { recreateStopsView } from "@/lib/extensions";

let viewRecreated = false;

const ensureProceduresLoaded = async (conn: any) => {
  
  if (!viewRecreated) {
    logger.log('🔄 Recreating StopsView with correct schema...');
    await recreateStopsView(conn);
    viewRecreated = true;
    logger.log('✅ StopsView recreated successfully');
  }

  const { PATHWAY_QUERY_MACROS } = await import("@/lib/gtfs-ingestion/queries");
  try {
    await conn.query(PATHWAY_QUERY_MACROS);
  } catch (error) {
    
    logger.log('⚠️ Pathway macros not loaded - pathway_network may not exist');
  }
  return true;
};

export const resetProceduresFlag = () => {
  viewRecreated = false;
};

const checkTablesExist = async (conn: any): Promise<boolean> => {
  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name IN ('pathways', 'stops')
    `);
    const count = result.toArray()[0]?.count || 0;
    return Number(count) === 2; 
  } catch (error) {
    return false;
  }
};

export interface StationPathwaysData {
  connections: any[];
  stops: any[];
  fromStopsAvailable: { label: string; value: string }[];
  toStopsAvailable: { label: string; value: string }[];
  pathwayModesAvailable: { label: string; value: string }[];
  directionTypesAvailable: { label: string; value: string }[];
  timeIntervals: { min: number; max: number; label: string; color: string }[];
}

export const fetchStationPathwaysComplete = async (props: {
  conn: any;
  StationView: any;
  ToStop?: string;
  FromStop?: string;
  EmptyArcs?: boolean;
  TimeRange?: number[];
  DirectionTypes?: string;
  PathwayTypes?: string[];
}): Promise<StationPathwaysData> => {
  try {
    const { conn, StationView } = props;

    if (!conn) {
      logger.error('❌ No database connection');
      return {
        connections: [],
        stops: [],
        fromStopsAvailable: [],
        toStopsAvailable: [],
        pathwayModesAvailable: [],
        directionTypesAvailable: [],
        timeIntervals: [],
      };
    }

    if (!StationView || !StationView.stop_id) {
      logger.error('❌ No station view or stop_id');
      return {
        connections: [],
        stops: [],
        fromStopsAvailable: [],
        toStopsAvailable: [],
        pathwayModesAvailable: [],
        directionTypesAvailable: [],
        timeIntervals: [],
      };
    }

    const stationId = StationView.stop_id;

    logger.log(`🔍 Fetching pathways for station ${stationId}`);

    const tablesExist = await checkTablesExist(conn);
    if (!tablesExist) {
      logger.log('⚠️ Required tables (pathways, stops) do not exist yet');
      return {
        connections: [],
        stops: [],
        fromStopsAvailable: [],
        toStopsAvailable: [],
        pathwayModesAvailable: [],
        directionTypesAvailable: [],
        timeIntervals: [],
      };
    }

    const proceduresReady = await ensureProceduresLoaded(conn);
    if (!proceduresReady) {
      logger.log('⚠️ Procedures not ready - tables may be missing');
      return {
        connections: [],
        stops: [],
        fromStopsAvailable: [],
        toStopsAvailable: [],
        pathwayModesAvailable: [],
        directionTypesAvailable: [],
        timeIntervals: [],
      };
    }

    const pathways = await executeQuery(
      conn,
      `SELECT * FROM get_station_pathways('${stationId}')`
    );
    logger.log(`  📊 Query returned ${pathways.length} pathways`);

    const stops = await executeQuery(
      conn,
      `SELECT * FROM get_station_stops('${stationId}')`
    );
    logger.log(`  📊 Query returned ${stops.length} stops`);

    const [fromStopsData, toStopsData, modesData, directionsData, timeRangeData] = await Promise.all([
      executeQuery(conn, `SELECT from_stop_id FROM get_from_stops_available('${stationId}')`),
      executeQuery(conn, `SELECT to_stop_id FROM get_to_stops_available('${stationId}')`),
      executeQuery(conn, `SELECT pathway_mode_name FROM get_pathway_modes_available('${stationId}')`),
      executeQuery(conn, `SELECT direction_type FROM get_direction_types_available('${stationId}')`),
      executeQuery(conn, `SELECT * FROM get_time_range('${stationId}')`),
    ]);

    const fromStopsAvailable = fromStopsData.map((row: any) => ({
      label: row.from_stop_id,
      value: row.from_stop_id,
    }));

    const toStopsAvailable = toStopsData.map((row: any) => ({
      label: row.to_stop_id,
      value: row.to_stop_id,
    }));

    const pathwayModesAvailable = modesData.map((row: any) => ({
      label: row.pathway_mode_name,
      value: row.pathway_mode_name,
    }));

    const directionTypesAvailable = directionsData.map((row: any) => ({
      label: row.direction_type,
      value: row.direction_type,
    }));

    const timeRange = timeRangeData.length > 0 ? timeRangeData[0] : null;
    const timeIntervals = timeRange?.min_time != null && timeRange?.max_time != null
      ? [
          {
            min: timeRange.min_time,
            max: timeRange.max_time,
            label: 'All Times',
            color: TimeIntervalColors[0],
          }
        ]
      : [];

    logger.log(`✅ Loaded ${pathways.length} pathways, ${stops.length} stops for station ${stationId}`);

    return {
      connections: pathways,
      stops,
      fromStopsAvailable,
      toStopsAvailable,
      pathwayModesAvailable,
      directionTypesAvailable,
      timeIntervals,
    };

  } catch (error) {
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes('does not exist')) {
      logger.log('⚠️ Tables not found - database likely being reset');
      return {
        connections: [],
        stops: [],
        fromStopsAvailable: [],
        toStopsAvailable: [],
        pathwayModesAvailable: [],
        directionTypesAvailable: [],
        timeIntervals: [],
      };
    }

    logger.error('[ERROR] fetchStationPathwaysComplete failed:', error);
    logger.error('[ERROR] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
};
