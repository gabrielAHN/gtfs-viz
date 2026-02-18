import { executeQuery } from "@/lib/duckdb/QueryHelper";
import { logger } from "@/lib/logger";
import { getPathfindingFunctions } from "./hybridPathfinding";

export interface ShortestPathResult {
  current_stop: string;
  destination: string;
  total_time: number;
  hop_count: number;
  path_ids: string[];
  visited_stops: string[];
  path_description: string;
}

export interface ReachableStop {
  reachable_stop: string;
  min_time: number;
  min_hops: number;
}

export interface PathOption {
  total_time: number;
  hop_count: number;
  path_ids: string[];
  route: string;
}

export const findShortestPath = async (props: {
  conn: any;
  stationId: string;
  fromStop: string;
  toStop: string;
  maxHops?: number;
}): Promise<ShortestPathResult | null> => {
  const { conn, stationId, fromStop, toStop, maxHops = 10 } = props;

  try {
    
    const functions = await getPathfindingFunctions(conn);

    let query: string;
    if (functions.method === "onager_direct") {
      
      query = `
        SELECT * FROM ${functions.shortestPath}(
          '${stationId}',
          '${fromStop}',
          '${toStop}'
        )
      `;
      logger.log(`  Using Onager Direct for shortest path (no preprocessing)`);
    } else {
      
      query = `
        SELECT * FROM ${functions.shortestPath}(
          '${stationId}',
          '${fromStop}',
          '${toStop}',
          ${maxHops}
        )
      `;
    }

    const results = await executeQuery(conn, query);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('does not exist')) {
      logger.error("Error finding shortest path:", error);
    }
    return null;
  }
};

export const findReachableStops = async (props: {
  conn: any;
  stationId: string;
  fromStop: string;
  maxTime?: number;
  maxHops?: number;
}): Promise<ReachableStop[]> => {
  const { conn, stationId, fromStop, maxTime, maxHops = 5 } = props;

  try {
    
    const functions = await getPathfindingFunctions(conn);

    const maxTimeParam = maxTime ? maxTime : 'NULL';

    let query: string;
    if (functions.method === "onager_direct") {
      
      query = `
        SELECT * FROM ${functions.reachableStops}(
          '${stationId}',
          '${fromStop}',
          ${maxTimeParam}
        )
      `;
      logger.log(`  Using Onager Direct for reachable stops (no preprocessing)`);
    } else {
      
      query = `
        SELECT * FROM ${functions.reachableStops}(
          '${stationId}',
          '${fromStop}',
          ${maxTimeParam},
          ${maxHops}
        )
      `;
    }

    return await executeQuery(conn, query);
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('does not exist')) {
      logger.error("Error finding reachable stops:", error);
    }
    return [];
  }
};

export const findAllPaths = async (props: {
  conn: any;
  stationId: string;
  fromStop: string;
  toStop: string;
  maxHops?: number;
}): Promise<PathOption[]> => {
  const { conn, stationId, fromStop, toStop, maxHops = 5 } = props;

  try {
    
    const functions = await getPathfindingFunctions(conn);

    const query = `
      SELECT * FROM ${functions.allPaths}(
        '${stationId}',
        '${fromStop}',
        '${toStop}',
        ${maxHops}
      )
    `;

    return await executeQuery(conn, query);
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('does not exist')) {
      logger.error("Error finding all paths:", error);
    }
    return [];
  }
};

export const getDirectPathways = async (props: {
  conn: any;
  stationId: string;
  fromStop?: string;
  toStop?: string;
  directionFilter?: string;
  pathwayTypes?: string[];
}) => {
  const { conn, stationId, fromStop, toStop, directionFilter, pathwayTypes } = props;

  const fromStopParam = fromStop ? `'${fromStop}'` : 'NULL';
  const toStopParam = toStop ? `'${toStop}'` : 'NULL';
  const directionParam = directionFilter ? `'${directionFilter}'` : 'NULL';
  const typesParam = pathwayTypes && pathwayTypes.length > 0
    ? `ARRAY[${pathwayTypes.map(t => `'${t}'`).join(', ')}]`
    : 'NULL';

  const query = `
    SELECT * FROM get_direct_pathways(
      '${stationId}',
      ${fromStopParam},
      ${toStopParam},
      ${directionParam},
      ${typesParam}
    )
  `;

  try {
    return await executeQuery(conn, query);
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('does not exist')) {
      logger.error("Error getting direct pathways:", error);
    }
    return [];
  }
};

export const findStationHubs = async (props: {
  conn: any;
  stationId: string;
  topN?: number;
}) => {
  const { conn, stationId, topN = 10 } = props;

  try {
    const functions = await getPathfindingFunctions(conn);

    if (functions.method !== "onager_direct" || !functions.findHubs) {
      logger.warn("Hub identification requires Onager Direct mode");
      return [];
    }

    const query = `
      SELECT * FROM ${functions.findHubs}(
        '${stationId}',
        ${topN}
      )
    `;

    return await executeQuery(conn, query);
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('does not exist')) {
      logger.error("Error finding station hubs:", error);
    }
    return [];
  }
};

export const getNetworkStatistics = async (props: {
  conn: any;
  stationId: string;
}) => {
  const { conn, stationId } = props;

  try {
    const functions = await getPathfindingFunctions(conn);

    if (functions.method !== "onager_direct" || !functions.getNetworkStats) {
      logger.warn("Network statistics require Onager Direct mode");
      return null;
    }

    const query = `
      SELECT * FROM ${functions.getNetworkStats}(
        '${stationId}'
      )
    `;

    const results = await executeQuery(conn, query);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (!errorMsg.includes('does not exist')) {
      logger.error("Error getting network statistics:", error);
    }
    return null;
  }
};
