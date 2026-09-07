import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./corridor-fixture.mjs";

const arc = Array.from({ length: 41 }, (_, i) => [
  1000 * Math.sin(i / 50),
  1000 * (1 - Math.cos(i / 50)),
]);
for (const reversed of [false, true]) {
  test(`shared curved shapes keep their lanes (opposite representative=${reversed})`, () => {
    const rows = fixture(
      { A: arc, B: reversed ? [...arc].reverse() : arc },
      `SELECT route_id, min(slot_s) lo, max(slot_s) hi FROM RouteShapeLanesTable GROUP BY route_id ORDER BY route_id`,
    );
    for (const r of rows) assert.ok(Math.abs(r.hi - r.lo) < 1e-6, JSON.stringify(rows));
    assert.ok(Math.abs(rows[0].lo - (reversed ? -rows[1].lo : rows[1].lo)) > 0.99);
  });
}
for (const [lat, lon] of [
  [0, 0],
  [47.52, 19.15],
  [41.88, -87.63],
  [-33.8, 151.2],
  [60, 151],
]) {
  test(`parallel staggered samples share a trunk at ${lat},${lon}`, () => {
    const a = Array.from({ length: 101 }, (_, i) => [0, i * 20]);
    const b = a.map(([x, y]) => [x + 8, y + 9]);
    const rows = fixture(
      { A: a, B: b },
      `SELECT route_id, min(band_count) minimum, avg(band_count) average, max(abs((lon - ${lon + 4 / (111320 * Math.cos((lat * Math.PI) / 180))}) * ${111320 * Math.cos((lat * Math.PI) / 180)} - uy*shift_s)) lateral_error_m FROM RouteShapeLanesTable WHERE lat BETWEEN ${lat + 200 / 111320} AND ${lat + 1800 / 111320} GROUP BY route_id`,
      lat,
      lon,
    );
    assert.equal(rows.length, 2);
    for (const r of rows) {
      assert.equal(r.minimum, 2, JSON.stringify(rows));
      assert.ok(r.lateral_error_m < 0.02, JSON.stringify(rows));
    }
  });
}
test("a route joining a corridor keeps one side of it afterwards", () => {
  // B approaches from the east, joins A, then runs parallel 7 m east of it.
  // Per-vertex neighbour ranking flickered lanes after the join, drawing B
  // back and forth across A. The whole shared run must agree on one order.
  const a = Array.from({ length: 101 }, (_, i) => [0, i * 20]);
  const b = [
    ...Array.from({ length: 10 }, (_, i) => [300 - i * 29.3, i * 50]),
    ...Array.from({ length: 76 }, (_, i) => [7, 500 + i * 20]),
  ];
  const rows = fixture(
    { A: a, B: b },
    `SELECT route_id, min(slot_s) lo, max(slot_s) hi, count(*) FILTER (WHERE band_count > 1) shared
     FROM RouteShapeLanesTable WHERE lat BETWEEN ${700 / 111320} AND ${1900 / 111320} GROUP BY route_id ORDER BY route_id`,
  );
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.ok(r.shared > 40, JSON.stringify(rows));
    assert.ok(
      Math.abs(r.hi - r.lo) < 1e-6,
      `lane changed inside the corridor: ${JSON.stringify(rows)}`,
    );
  }
  assert.ok(Math.abs(rows[0].lo - rows[1].lo) > 0.99, JSON.stringify(rows));
});
test("a bundle wider than the neighbour reach keeps unique steady lanes", () => {
  // Six parallel routes 8 m apart: 40 m across, wider than reach_meters (20),
  // so the outer routes never see each other and each route ranks a DIFFERENT
  // strand subset. Per-vertex ranking gave edge routes duplicate or wandering
  // lanes there. Every vertex must still get a steady, unique physical order.
  const mk = (x) => Array.from({ length: 101 }, (_, i) => [x + (i % 2), i * 20]);
  const routes = Object.fromEntries([0, 8, 16, 24, 32, 40].map((x, k) => [`R${k}`, mk(x)]));
  const rows = fixture(
    routes,
    `SELECT route_id, min(lon*111320.0 - uy*shift_s) lo, max(lon*111320.0 - uy*shift_s) hi
     FROM RouteShapeLanesTable WHERE lat BETWEEN ${300 / 111320} AND ${1700 / 111320}
     GROUP BY route_id ORDER BY lo`,
  );
  assert.equal(rows.length, 6);
  for (const r of rows) {
    // steady: the centreline this route converges to holds still along the run
    assert.ok(r.hi - r.lo < 2.0, `wandering centreline: ${JSON.stringify(rows)}`);
  }
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i].lo - rows[i - 1].hi;
    assert.ok(gap > 2.0, `two routes converged onto one line: ${JSON.stringify(rows)}`);
  }
});
