// Native, shape-only regression runner for any extracted GTFS feed.
// node tests/check-feed.mjs /path/to/feed /path/to/report.json
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { corridorSQL, quote, runSQL } from "./corridor-fixture.mjs";
const [dirArg, reportPath] = process.argv.slice(2);
assert.ok(dirArg && reportPath, "Pass extracted GTFS directory and JSON report path");
const dir = resolve(dirArg);
const started = performance.now();
const file = (name) => `read_csv(${quote(`${dir}/${name}.txt`)}, header=true, all_varchar=true)`;
const routeIds = runSQL(`SELECT route_id FROM ${file("routes")} ORDER BY route_id`).map(
  (r) => r.route_id,
);
const finishChunks = [];
for (let i = 0; i < routeIds.length; i += 12)
  finishChunks.push(
    `INSERT INTO RouteShapeBandsTable SELECT * FROM finish_route_shape_bands([${routeIds
      .slice(i, i + 12)
      .map(quote)
      .join(",")}]);`,
  );
const report = runSQL(`
CREATE TABLE shapes AS SELECT shape_id, shape_pt_sequence::BIGINT shape_pt_sequence, shape_pt_lat::DOUBLE shape_pt_lat, shape_pt_lon::DOUBLE shape_pt_lon FROM ${file("shapes")};
CREATE TABLE TripsView AS SELECT route_id, trip_id, shape_id FROM ${file("trips")};
CREATE TABLE RoutesView AS SELECT route_id, route_type::INTEGER route_type, route_id route_name, '' route_color_hex, '' route_text_color_hex FROM ${file("routes")};
${corridorSQL}
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_rail();
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_bus();
INSERT INTO RouteShapeLanesTable SELECT * FROM prepare_route_shape_lanes_other();
${finishChunks.join("\n")}
CREATE TABLE source_lines AS
SELECT shape_id, first(coslat) coslat,
       ST_MakeLine(list(ST_Point(shape_pt_lon*coslat, shape_pt_lat) ORDER BY shape_pt_sequence)) geom
FROM (SELECT *, cos(radians(avg(shape_pt_lat) OVER(PARTITION BY shape_id))) coslat FROM shapes
      WHERE shape_id IN (SELECT DISTINCT shape_id FROM RouteShapeBandsTable))
GROUP BY shape_id;
CREATE TABLE deviations AS
SELECT b.route_id, ST_Distance(ST_Point(b.shape_pt_lon*s.coslat,b.shape_pt_lat),s.geom)*111320.0 metres
FROM RouteShapeBandsTable b JOIN source_lines s USING(shape_id);
WITH expected AS (
  SELECT DISTINCT t.route_id FROM TripsView t JOIN shapes s USING(shape_id) JOIN RoutesView r USING(route_id)
  WHERE s.shape_pt_lat IS NOT NULL AND s.shape_pt_lon IS NOT NULL
), ends AS (
  SELECT route_id, shape_id,
    first(shape_pt_lat ORDER BY shape_pt_sequence) a,
    first(orig_lat ORDER BY shape_pt_sequence) oa,
    first(shape_pt_lon ORDER BY shape_pt_sequence) b,
    first(orig_lon ORDER BY shape_pt_sequence) ob,
    last(shape_pt_lat ORDER BY shape_pt_sequence) c,
    last(orig_lat ORDER BY shape_pt_sequence) oc,
    last(shape_pt_lon ORDER BY shape_pt_sequence) d,
    last(orig_lon ORDER BY shape_pt_sequence) od
  FROM RouteShapeBandsTable GROUP BY route_id,shape_id
)
SELECT (SELECT count(*) FROM expected) eligible_routes,
       count(DISTINCT route_id) output_routes, count(*) output_vertices,
       count(*) FILTER(WHERE NOT isfinite(shape_pt_lat) OR NOT isfinite(shape_pt_lon) OR NOT isfinite(slot) OR shape_pt_lat IS NULL OR shape_pt_lon IS NULL OR slot IS NULL OR abs(shape_pt_lat)>90 OR abs(shape_pt_lon)>180) invalid_vertices,
       (SELECT count(*) FROM (SELECT route_id,shape_id,shape_pt_sequence,count(*) n FROM RouteShapeBandsTable GROUP BY ALL HAVING n>1)) duplicate_sequence_keys,
       (SELECT round(max(greatest(sqrt(pow((a-oa)*111320,2)+pow((b-ob)*111320*cos(radians(oa)),2)),sqrt(pow((c-oc)*111320,2)+pow((d-od)*111320*cos(radians(oc)),2)))),3) FROM ends) max_endpoint_shift_m,
       (SELECT count(*) FROM (SELECT route_id FROM expected EXCEPT SELECT route_id FROM RouteShapeBandsTable)) missing_routes,
       max(band_count) largest_bundle,
       (SELECT round(max(metres),3) FROM deviations) max_distance_to_source_m,
       (SELECT round(avg(metres),3) FROM deviations) mean_distance_to_source_m
FROM RouteShapeBandsTable;
`)[0];
report.seconds = +((performance.now() - started) / 1000).toFixed(2);
report.input = dir;
report.engine = `native DuckDB, ${process.env.GTFS_TEST_MEMORY_MB || 1200}MB memory limit, spilling disabled; not browser import validation`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
for (const k of ["invalid_vertices", "duplicate_sequence_keys", "missing_routes"])
  assert.equal(report[k], 0, k);
assert.equal(report.output_routes, report.eligible_routes);
assert.ok(report.output_vertices > 0);
assert.ok(
  report.max_endpoint_shift_m <= 20.1,
  "endpoint moved outside the configured neighbour reach",
);
assert.ok(
  report.max_distance_to_source_m <= 50,
  "cleanup departed more than 50m from source geometry",
);
