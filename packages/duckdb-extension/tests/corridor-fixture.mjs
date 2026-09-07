import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

export const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
const header = readFileSync(new URL("../src/include/gtfs_sql.hpp", import.meta.url), "utf8");
export const corridorSQL = header.slice(
  header.indexOf("CREATE TABLE IF NOT EXISTS RouteShapeLanesTable"),
  header.indexOf("CREATE OR REPLACE MACRO get_station_line_bands"),
);
export function runSQL(sql) {
  const memoryMB = Number(process.env.GTFS_TEST_MEMORY_MB || 1200);
  if (!Number.isInteger(memoryMB) || memoryMB < 256 || memoryMB > 1600)
    throw new Error("GTFS_TEST_MEMORY_MB must be an integer from 256 to 1600");
  const result = spawnSync("duckdb", ["-bail", "-json", ":memory:"], {
    input: `SET home_directory=${quote(homedir())}; LOAD spatial; SET memory_limit='${memoryMB}MB'; SET temp_directory=''; SET threads=2; SET preserve_insertion_order=false;\n${sql}`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180000,
    env: { ...process.env, HOME: homedir() },
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : [];
}
export function fixture(points, select, lat = 0, lon = 0) {
  const rows = Object.entries(points).flatMap(([id, coordinates]) =>
    coordinates.map(
      ([x, y], i) =>
        `(${quote(id)},${quote(id)},${i},${lat + y / 111320},${lon + x / (111320 * Math.cos((lat * Math.PI) / 180))})`,
    ),
  );
  return runSQL(`
    CREATE TABLE input(route_id VARCHAR, shape_id VARCHAR, shape_pt_sequence DOUBLE, shape_pt_lat DOUBLE, shape_pt_lon DOUBLE);
    INSERT INTO input VALUES ${rows.join(",")};
    CREATE VIEW shapes AS SELECT * EXCLUDE(route_id) FROM input;
    CREATE VIEW TripsView AS SELECT DISTINCT route_id, route_id || shape_id AS trip_id, shape_id FROM input;
    CREATE VIEW RoutesView AS SELECT DISTINCT route_id, 3 route_type, route_id route_name, '000000' route_color_hex, 'ffffff' route_text_color_hex FROM input;
    ${corridorSQL}
    INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes((SELECT list(DISTINCT route_id) FROM input), simplify_meters := 0.0, reach_meters := 20.0);
    ${select}`);
}
