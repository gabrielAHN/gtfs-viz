import { executeRows, queryRows } from "./runner.js";

const escapeSql = (value: string): string => value.replace(/'/g, "''");

const prepareLanesSql = (version: string) => `LOAD spatial;
BEGIN TRANSACTION;
PRAGMA gtfs_prepare_route_cache;
DELETE FROM RouteShapeLanesTable;
DELETE FROM RouteShapeBandsTable;
DELETE FROM RouteShapeMacroVersion;
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_rail();
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_bus();
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_other();
INSERT INTO RouteShapeBandsTable SELECT * FROM refresh_route_shape_bands();
INSERT INTO RouteShapeMacroVersion VALUES ('${escapeSql(version)}');
COMMIT;`;

export type RouteBandsSummary = {
  bandRows: number;
  routes: number;
  widestBundle: number;
};

export const buildRouteShapeBands = async (dbPath: string): Promise<RouteBandsSummary> => {
  const [metadata] = await queryRows(dbPath, "PRAGMA gtfs_route_cache_version");
  await executeRows(dbPath, prepareLanesSql(String(metadata.version)));
  const [summary] = await queryRows(
    dbPath,
    `SELECT count(*) AS band_rows,
            count(DISTINCT route_id) AS routes,
            COALESCE(max(band_count), 0) AS widest_bundle
     FROM RouteShapeBandsTable`,
  );
  return {
    bandRows: Number(summary?.band_rows ?? 0),
    routes: Number(summary?.routes ?? 0),
    widestBundle: Number(summary?.widest_bundle ?? 0),
  };
};

export const readRouteShapeBandsSummary = async (
  dbPath: string,
): Promise<RouteBandsSummary> => {
  const [summary] = await queryRows(
    dbPath,
    `SELECT count(*) AS band_rows,
            count(DISTINCT route_id) AS routes,
            COALESCE(max(band_count), 0) AS widest_bundle
     FROM RouteShapeBandsTable`,
  );
  return {
    bandRows: Number(summary?.band_rows ?? 0),
    routes: Number(summary?.routes ?? 0),
    widestBundle: Number(summary?.widest_bundle ?? 0),
  };
};
