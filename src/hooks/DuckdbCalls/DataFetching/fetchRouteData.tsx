import { executeQuery } from "@/hooks/DuckdbCalls/QueryHelper";

export const fetchRouteData = async (props) => {
  const { conn, StationView } = props;

  try {
    const stationStopsQuery = `
      CREATE TEMPORARY TABLE StationStops AS
      SELECT stop_id
      FROM stops
      WHERE parent_station = '${StationView.stopId}';
    `;
    await executeQuery(conn, stationStopsQuery);

    const initializePathsQuery = `
      CREATE TEMPORARY TABLE Paths AS
      SELECT
        s.stop_id AS start_stop,
        p.to_stop_id AS current_node,
        p.traversal_time AS total_time,
        ARRAY[s.stop_id, p.to_stop_id] AS path,
        1 AS depth
      FROM
        StationStops s
      JOIN
        pathways p ON p.from_stop_id = s.stop_id;
    `;
    await executeQuery(conn, initializePathsQuery);

    const maxDepth = 10;
    for (let currentDepth = 1; currentDepth < maxDepth; currentDepth++) {
      const expandPathsQuery = `
        INSERT INTO Paths
        SELECT
          p.start_stop,
          p2.to_stop_id AS current_node,
          p.total_time + p2.traversal_time AS total_time,
          ARRAY_CONCAT(p.path, ARRAY[p2.to_stop_id]) AS path,
          ${currentDepth + 1} AS depth
        FROM
          Paths p
        JOIN
          pathways p2 ON p2.from_stop_id = p.current_node
        WHERE
          p.depth = ${currentDepth}
          AND NOT array_contains(p.path, p2.to_stop_id);
      `;
      await executeQuery(conn, expandPathsQuery);
    }

    const shortestPathsQuery = `
      CREATE TEMPORARY TABLE ShortestPaths AS
      SELECT
        start_stop,
        current_node AS end_stop,
        MIN(total_time) AS shortest_time
      FROM
        Paths
      GROUP BY
        start_stop,
        current_node;
    `;
    await executeQuery(conn, shortestPathsQuery);

    const filteredPathsQuery = `
      SELECT
        sp.start_stop,
        sp.end_stop,
        sp.shortest_time,
        s1.location_type_name AS from_location_type_name,
        s2.location_type_name AS to_location_type_name
      FROM
        ShortestPaths sp
      LEFT JOIN
        stops s1 ON s1.stop_id = sp.start_stop
      LEFT JOIN
        stops s2 ON s2.stop_id = sp.end_stop;
    `;
    const RouteDataResults = await executeQuery(conn, filteredPathsQuery);

    const dropTablesQuery = `
      DROP TABLE IF EXISTS StationStops;
      DROP TABLE IF EXISTS Paths;
      DROP TABLE IF EXISTS ShortestPaths;
    `;
    await executeQuery(conn, dropTablesQuery);

    return RouteDataResults;
  } catch (error) {
    console.error("Error executing RouteDataQuery:", error);
    throw error;
  }
};
