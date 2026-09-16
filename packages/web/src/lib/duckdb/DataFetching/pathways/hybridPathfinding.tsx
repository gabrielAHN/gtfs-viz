import { logger } from "@/lib/logger"
import { InitializeOnagerDirect } from "./onagerDirectProcedures"

const checkMacroExists = async (conn: any, name: string): Promise<boolean> => {
  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count FROM duckdb_functions()
      WHERE function_name = '${name}'
    `)
    return result.toArray()[0]?.count > 0
  } catch {
    return false
  }
}

export const InitializeHybridPathfinding = async (conn: any) => {
  logger.log("Initializing pathfinding procedures...")

  try {
    const viewCheck = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.views
      WHERE table_name = 'pathway_network'
    `)
    const hasView = viewCheck.toArray()[0]?.count > 0

    if (!hasView) {
      logger.error("  pathway_network view does not exist - cannot initialize pathfinding")
      return {
        method: "none",
        success: false,
        performance: "unavailable",
        description: "pathway_network view required but not found",
      }
    }
  } catch (error) {
    logger.error("  Error checking for pathway_network view:", error)
    return {
      method: "none",
      success: false,
      performance: "unavailable",
      description: "Failed to verify pathway_network view",
    }
  }

  // All pathfinding macros are registered by the extension at load time.
  // Verify they exist.
  const requiredMacros = [
    "find_shortest_path",
    "find_reachable_stops",
    "find_all_paths",
    "get_direct_pathways",
    "get_station_routes",
  ]

  for (const name of requiredMacros) {
    if (!(await checkMacroExists(conn, name))) {
      logger.error(`  Failed to find macro ${name}`)
      return {
        method: "none",
        success: false,
        performance: "unavailable",
        description: `Missing macro: ${name}`,
      }
    }
  }
  logger.log("  Loaded 5 pathfinding procedures")

  const onagerResult = await InitializeOnagerDirect(conn)
  if (onagerResult.success && onagerResult.method === "onager_direct") {
    const onagerMacros = [
      "find_shortest_path_direct",
      "find_reachable_stops_direct",
      "get_pathway_network_info",
      "get_station_network_stats",
      "find_station_hubs_direct",
      "get_station_routes_direct",
    ]
    let loaded = 0
    for (const name of onagerMacros) {
      if (await checkMacroExists(conn, name)) loaded++
    }
    if (loaded === onagerMacros.length) {
      logger.log(`  Loaded ${loaded} Onager procedures (optimal performance)`)
      return {
        method: "onager_direct",
        success: true,
        performance: "optimal",
        description: "Pathfinding with Onager (2-20x faster)",
      }
    }
  }

  return {
    method: "recursive_cte",
    success: true,
    performance: "good",
    description: "Pathfinding with recursive CTEs",
  }
}

export const getPathfindingFunctions = async (conn: any) => {
  try {
    const checkOnagerDirect = await conn.query(`
      SELECT COUNT(*) as count
      FROM duckdb_functions()
      WHERE function_name = 'find_shortest_path_direct'
    `)

    const hasOnagerDirect = checkOnagerDirect.toArray()[0]?.count > 0

    if (hasOnagerDirect) {
      return {
        shortestPath: "find_shortest_path_direct",
        reachableStops: "find_reachable_stops_direct",
        allPaths: "find_all_paths",
        findHubs: "find_station_hubs_direct",
        getNetworkStats: "get_station_network_stats",
        method: "onager_direct",
      }
    }
  } catch {}

  return {
    shortestPath: "find_shortest_path",
    reachableStops: "find_reachable_stops",
    allPaths: "find_all_paths",
    findHubs: null,
    getNetworkStats: null,
    method: "recursive_cte",
  }
}
