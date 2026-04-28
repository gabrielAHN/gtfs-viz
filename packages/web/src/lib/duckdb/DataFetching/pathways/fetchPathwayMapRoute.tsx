import { executeQuery } from "@/lib/duckdb/QueryHelper";
import { logger } from "@/lib/logger";
import { getPathwayRouteFilterData } from "@/lib/pathways/routeFilterGraph";

const toSqlString = (value?: string | null) => {
  if (value == null || value === "") {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
};

const toSqlNumber = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "NULL";
  }

  return String(value);
};

const toSqlStringList = (values?: string[] | null) => {
  if (!values || values.length === 0) {
    return "NULL";
  }

  return `[${values.map((value) => toSqlString(value)).join(", ")}]`;
};

export const fetchPathwayMapRouteData = async ({
  conn,
  stationId,
  stops,
  fromStopId,
  toStopId,
  minTime,
  maxTime,
  includeNullTime = true,
  directionType,
  pathwayTypes,
  excludeTime,
}: {
  conn: any;
  stationId: string;
  stops: any[];
  fromStopId?: string;
  toStopId?: string;
  minTime?: number;
  maxTime?: number;
  includeNullTime?: boolean;
  directionType?: string;
  pathwayTypes?: string[];
  excludeTime?: number;
}) => {
  const connectionsQuery = `
    SELECT *
    FROM get_pathways_filtered(
      ${toSqlString(stationId)},
      NULL,
      NULL,
      ${toSqlNumber(minTime)},
      ${toSqlNumber(maxTime)},
      ${includeNullTime ? "TRUE" : "FALSE"},
      ${toSqlString(directionType)},
      ${toSqlStringList(pathwayTypes)}
    )
  `;

  logger.log("🔍 Fetching pathway map route data", {
    stationId,
    fromStopId,
    toStopId,
    minTime,
    maxTime,
    includeNullTime,
    directionType,
    pathwayTypes,
    excludeTime,
  });

  let connections = await executeQuery(conn, connectionsQuery);

  if (excludeTime != null) {
    connections = connections.filter((connection: any) => {
      const traversalTime = connection?.traversal_time;
      return traversalTime !== null && traversalTime !== undefined && traversalTime !== excludeTime;
    });
  }

  return getPathwayRouteFilterData({
    stops,
    connections,
    fromStopId,
    toStopId,
  });
};
