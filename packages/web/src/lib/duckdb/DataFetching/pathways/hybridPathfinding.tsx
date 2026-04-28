
import { logger } from "@/lib/logger";
import { loadProcedure } from "@/lib/extensions";
import { InitializeOnagerDirect } from "./onagerDirectProcedures";

const loadProcedureSafe = async (conn: any, path: string): Promise<boolean> => {
  try {
    await loadProcedure(conn, path);
    return true;
  } catch (error) {
    const errorMsg = error?.message || String(error);
    
    if (!errorMsg.includes('does not exist') && !errorMsg.includes('Catalog Error')) {
      logger.error(`Error loading procedure ${path}:`, error);
    }
    return false;
  }
};

export const InitializeHybridPathfinding = async (conn: any) => {
  logger.log("🚀 Initializing pathfinding procedures...");

  try {
    const viewCheck = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'pathway_network'
    `);
    const hasView = viewCheck.toArray()[0]?.count > 0;

    if (!hasView) {
      logger.error("  ❌ pathway_network view does not exist - cannot initialize pathfinding");
      return {
        method: "none",
        success: false,
        performance: "unavailable",
        description: "pathway_network view required but not found",
      };
    }
  } catch (error) {
    logger.error("  ❌ Error checking for pathway_network view:", error);
    return {
      method: "none",
      success: false,
      performance: "unavailable",
      description: "Failed to verify pathway_network view",
    };
  }

  const pathfindingProcs = [
    'pathfinding/find_shortest_path',
    'pathfinding/find_reachable_stops',
    'pathfinding/find_all_paths',
    'pathfinding/get_direct_pathways',
    'pathfinding/get_station_routes'
  ];

  const onagerProcs = [
    'onager/find_shortest_path_direct',
    'onager/find_reachable_stops_direct',
    'onager/get_pathway_network_info',
    'onager/get_station_network_stats',
    'onager/find_station_hubs_direct',
    'onager/get_station_routes_direct'
  ];

  for (const proc of pathfindingProcs) {
    if (!await loadProcedureSafe(conn, proc)) {
      logger.error(`  ❌ Failed to load ${proc}`);
      return {
        method: "none",
        success: false,
        performance: "unavailable",
        description: `Failed to load procedure: ${proc}`,
      };
    }
  }
  logger.log("  ✅ Loaded 5 pathfinding procedures");

  const onagerResult = await InitializeOnagerDirect(conn);
  if (onagerResult.success && onagerResult.method === "onager_direct") {
    let loaded = 0;
    for (const proc of onagerProcs) {
      if (await loadProcedureSafe(conn, proc)) loaded++;
    }
    if (loaded === onagerProcs.length) {
      logger.log(`  ✅ Loaded ${loaded} Onager procedures (optimal performance)`);
      return {
        method: "onager_direct",
        success: true,
        performance: "optimal",
        description: "Pathfinding with Onager (2-20x faster)",
      };
    }
  }

  return {
    method: "recursive_cte",
    success: true,
    performance: "good",
    description: "Pathfinding with recursive CTEs",
  };
};

export const getPathfindingFunctions = async (conn: any) => {
  try {
    const checkOnagerDirect = await conn.query(`
      SELECT COUNT(*) as count
      FROM duckdb_functions()
      WHERE function_name = 'find_shortest_path_direct'
    `);

    const hasOnagerDirect = checkOnagerDirect.toArray()[0]?.count > 0;

    if (hasOnagerDirect) {
      return {
        shortestPath: "find_shortest_path_direct",
        reachableStops: "find_reachable_stops_direct",
        allPaths: "find_all_paths",
        findHubs: "find_station_hubs_direct",
        getNetworkStats: "get_station_network_stats",
        method: "onager_direct",
      };
    }
  } catch {
  }

  return {
    shortestPath: "find_shortest_path",
    reachableStops: "find_reachable_stops",
    allPaths: "find_all_paths",
    findHubs: null,
    getNetworkStats: null,
    method: "recursive_cte",
  };
};
