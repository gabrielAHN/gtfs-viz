function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function getStationId(args: Record<string, unknown> | undefined): string {
  const value = args?.stationId || args?.stopId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Named query requires args with stationId");
  }
  return value;
}

function getRouteId(args: Record<string, unknown> | undefined): string {
  const value = args?.routeId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Named query requires args with routeId");
  }
  return value;
}

export function sqlForNamedQuery(name: string, args?: Record<string, unknown>): string {
  if (name === "stations") return "SELECT * FROM StationsTable";
  if (name === "stops") return "SELECT * FROM StopsTable";
  if (name === "routes") return "SELECT * FROM RoutesTable";
  if (name === "edit-pathways" || name === "edit_pathways") {
    return "SELECT * FROM EditPathwayTable";
  }
  if (name === "edit-routes" || name === "edit_routes") {
    return "SELECT * FROM EditRouteTable";
  }
  if (name === "edit-stops" || name === "edit_stops") {
    return "SELECT * FROM EditStopTable";
  }

  if (
    name === "route-info" || name === "route_info" ||
    name === "route-stops" || name === "route_stops" ||
    name === "route-stations" || name === "route_stations" ||
    name === "route-shapes" || name === "route_shapes"
  ) {
    const routeId = escapeSql(getRouteId(args));
    if (name === "route-info" || name === "route_info") {
      return `SELECT * FROM get_route_info('${routeId}')`;
    }
    if (name === "route-stops" || name === "route_stops") {
      return `SELECT * FROM get_route_stops('${routeId}')`;
    }
    if (name === "route-stations" || name === "route_stations") {
      return `SELECT * FROM get_route_stations('${routeId}')`;
    }
    return `SELECT * FROM get_route_shapes('${routeId}')`;
  }

  const stationId = escapeSql(getStationId(args));

  if (name === "station-info") {
    return `SELECT * FROM get_station_info('${stationId}')`;
  }
  if (name === "station-stops") {
    return `SELECT * FROM get_station_stops('${stationId}')`;
  }
  if (name === "station-pathways" || name === "station_pathways") {
    return `SELECT * FROM get_station_pathways('${stationId}')`;
  }
  if (name === "station-connections" || name === "station_connections") {
    return `SELECT * FROM get_station_connections('${stationId}')`;
  }
  if (name === "pathway-aggregates") {
    return `SELECT * FROM get_pathway_aggregates('${stationId}')`;
  }
  if (name === "station-routes" || name === "station_routes") {
    return `SELECT * FROM get_station_routes('${stationId}')`;
  }
  if (name === "station-service-routes" || name === "station_service_routes") {
    return `SELECT * FROM get_station_service_routes('${stationId}')`;
  }
  if (name === "stop-service-routes" || name === "stop_service_routes") {
    return `SELECT * FROM get_stop_service_routes('${stationId}')`;
  }

  throw new Error(`Unknown named query: ${name}`);
}

export type NamedQueryName =
  | "stations"
  | "stops"
  | "routes"
  | "station-info"
  | "station-stops"
  | "station-pathways"
  | "station_pathways"
  | "station-connections"
  | "station_connections"
  | "pathway-aggregates"
  | "station-routes"
  | "station_routes"
  | "station-service-routes"
  | "station_service_routes"
  | "stop-service-routes"
  | "stop_service_routes"
  | "route-info"
  | "route_info"
  | "route-stops"
  | "route_stops"
  | "route-stations"
  | "route_stations"
  | "route-shapes"
  | "route_shapes"
  | "edit-pathways"
  | "edit_pathways"
  | "edit-routes"
  | "edit_routes"
  | "edit-stops"
  | "edit_stops";

export function isNamedQuery(name: string): name is NamedQueryName {
  return [
    "stations", "stops", "routes", "station-info", "station-stops",
    "station-pathways", "station_pathways", "station-connections",
    "station_connections", "pathway-aggregates", "station-routes",
    "station_routes", "station-service-routes", "station_service_routes",
    "stop-service-routes", "stop_service_routes",
    "route-info", "route_info", "route-stops", "route_stops",
    "route-stations", "route_stations", "route-shapes", "route_shapes",
    "edit-pathways", "edit_pathways", "edit-routes", "edit_routes", "edit-stops", "edit_stops",
  ].includes(name);
}

export function dashboardViewForNamedQuery(
  name: string,
  args?: Record<string, unknown>,
): { view: string; stationId?: string; routeId?: string } | undefined {
  if (name === "stations") return { view: "stations/map" };
  if (name === "stops") return { view: "stops/map" };
  if (name === "routes") return { view: "routes/map" };

  const routeId = typeof args?.routeId === "string" ? args.routeId : undefined;
  if (
    routeId &&
    (name === "route-info" || name === "route_info" ||
      name === "route-stops" || name === "route_stops" ||
      name === "route-stations" || name === "route_stations" ||
      name === "route-shapes" || name === "route_shapes")
  ) {
    return { view: "routes/map", routeId };
  }

  const stationId =
    typeof args?.stationId === "string" ? args.stationId
    : typeof args?.stopId === "string" ? args.stopId
    : undefined;

  if (!stationId) return undefined;

  if (name === "station-info") return { view: "stations/info", stationId };
  if (name === "station-stops") return { view: "stations/parts/table", stationId };
  if (
    name === "station-pathways" || name === "station_pathways" ||
    name === "station-connections" || name === "station_connections" ||
    name === "pathway-aggregates" ||
    name === "station-routes" || name === "station_routes"
  ) {
    return { view: "stations/pathways/flow/radial", stationId };
  }
  if (name === "station-service-routes" || name === "station_service_routes") {
    return { view: "routes/map" };
  }
  if (name === "stop-service-routes" || name === "stop_service_routes") {
    return { view: "routes/map" };
  }

  return undefined;
}
