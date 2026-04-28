
import { executeQuery } from "@/lib/duckdb/QueryHelper";
import { logger } from "@/lib/logger";
import { getPathfindingFunctions } from "./pathways/hybridPathfinding";

export const fetchRouteData = async (props) => {
  const { conn, StationView } = props;

  try {
    logger.log(`🔍 Fetching route data for station ${StationView.stop_id}`);

    const functions = await getPathfindingFunctions(conn);

    let query: string;
    if (functions.method === "onager_direct") {
      query = `SELECT * FROM get_station_routes_direct('${StationView.stop_id}')`;
      logger.log(`  Using Onager direct mode (all-pairs Dijkstra)`);
    } else {
      query = `SELECT * FROM get_station_routes('${StationView.stop_id}')`;
      logger.log(`  Using recursive CTE mode (with cache)`);
    }

    const results = await executeQuery(conn, query);

    logger.log(`  ✅ Found ${results.length} routes for station ${StationView.stop_id}`);

    return results;

  } catch (error) {
    logger.error("Error executing RouteDataQuery:", error);
    throw error;
  }
};
