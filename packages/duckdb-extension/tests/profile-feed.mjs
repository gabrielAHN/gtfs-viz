import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { resolve } from "node:path";
import { corridorSQL, quote } from "./corridor-fixture.mjs";
import {
  externalTimerForPlatform,
  parsePeakRssMB,
  profileInvocation,
} from "./profile-timing.mjs";

const [dirArg, overridePath] = process.argv.slice(2);
const dir = resolve(dirArg);
const sql = overridePath ? readFileSync(overridePath, "utf8") : corridorSQL;
const file = (name) => `read_csv(${quote(`${dir}/${name}.txt`)}, header=true, all_varchar=true)`;
const memoryMB = Number(process.env.GTFS_TEST_MEMORY_MB || 1200);
const threads = Number(process.env.GTFS_TEST_THREADS || 2);
const timer = externalTimerForPlatform(platform(), existsSync("/usr/bin/time"));

function run(body) {
  const t0 = performance.now();
  const invocation = profileInvocation(timer);
  const r = spawnSync(invocation.command, invocation.args, {
    input: `SET home_directory=${quote(homedir())}; LOAD spatial; SET memory_limit='${memoryMB}MB'; SET temp_directory=''; SET threads=${threads}; SET preserve_insertion_order=false;\n${body}`,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, HOME: homedir() },
  });
  if (r.status !== 0) throw new Error(r.stderr);
  const out = r.stdout.trim();
  const jsonStart = out.lastIndexOf("[");
  const rows = jsonStart >= 0 ? JSON.parse(out.slice(jsonStart)) : [];
  return {
    seconds: +((performance.now() - t0) / 1000).toFixed(2),
    peakMB: parsePeakRssMB(r.stderr, timer?.rssFormat),
    rows,
  };
}

const setup = `
CREATE TABLE shapes AS SELECT shape_id, shape_pt_sequence::BIGINT shape_pt_sequence, shape_pt_lat::DOUBLE shape_pt_lat, shape_pt_lon::DOUBLE shape_pt_lon FROM ${file("shapes")};
CREATE TABLE TripsView AS SELECT route_id, trip_id, shape_id FROM ${file("trips")};
CREATE TABLE RoutesView AS SELECT route_id, route_type::INTEGER route_type, route_id route_name, '' route_color_hex, '' route_text_color_hex FROM ${file("routes")};
${sql}
`;
const phase1 = `
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_rail();
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_bus();
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_other();
`;
const routeIds = run(`${setup} SELECT route_id FROM RoutesView ORDER BY route_id;`).rows.map((r) => r.route_id);
const chunks = [];
for (let i = 0; i < routeIds.length; i += 12)
  chunks.push(`INSERT INTO RouteShapeBandsTable SELECT * FROM finish_route_shape_bands([${routeIds.slice(i, i + 12).map(quote).join(",")}]);`);

const base = run(`${setup} SELECT count(*) n FROM shapes;`);
const p1 = run(`${setup}${phase1} SELECT count(*) lanes FROM RouteShapeLanesTable;`);
const p12 = run(`${setup}${phase1}${chunks.join("\n")} SELECT count(*) bands, count(DISTINCT route_id) routes FROM RouteShapeBandsTable;`);
const report = {
  feed: dir,
  threads,
  memoryMB,
  setup_seconds: base.seconds,
  phase1_seconds: +(p1.seconds - base.seconds).toFixed(2),
  phase1_peakMB: p1.peakMB,
  lanes_rows: p1.rows[0]?.lanes,
  phase2_seconds: +(p12.seconds - p1.seconds).toFixed(2),
  total_peakMB: p12.peakMB,
  bands_rows: p12.rows[0]?.bands,
  routes: p12.rows[0]?.routes,
};
console.log(JSON.stringify(report));
