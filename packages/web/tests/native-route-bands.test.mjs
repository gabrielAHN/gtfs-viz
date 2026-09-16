import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8")

const transpile = (rel, imports) => {
  const exports = {}
  const out = ts.transpileModule(read(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInThisContext(`(function (exports, require) { ${out} })`)(
    exports,
    (id) => imports[id] ?? require(id),
  )
  return exports
}

const result = (rows = []) => ({
  toArray: () => rows.map((row) => ({ ...row, toJSON: () => row })),
})

const nativeDuckDb = transpile("../src/lib/cli/nativeDuckDb.ts", {
  "./launchProfile": {
    buildCliApiUrl: () => "http://cli/sql",
    getStoredCliLaunchProfile: () => null,
    readCliLaunchProfileFromUrl: () => null,
  },
})

const warnings = []
const executeQuery = async (conn, sql) => {
  const rows = await conn.query(sql)
  return rows.toArray().map((row) => row.toJSON())
}
const routeData = transpile("../src/lib/duckdb/DataFetching/fetchRouteData.tsx", {
  "@/lib/cli/nativeDuckDb": nativeDuckDb,
  "@/lib/duckdb/QueryHelper": {
    executeQuery,
    escapeSql: (value) => value.replaceAll("'", "''"),
  },
  "@gtfs-viz/duckdb-extension": {
    ROUTE_SHAPE_MACRO_VERSION: "v2-test-version",
  },
  "@/lib/duckdb/DataEditing/insertData": {},
  "@/lib/logger": { logger: { log() {}, error() {}, warn: (...args) => warnings.push(args) } },
  "@/lib/tripUtils": { markPersistedStopTimeEdits() {} },
  "./pathways/hybridPathfinding": { getPathfindingFunctions() {} },
})

const spatialSql = /prepare_route_shape_lanes|finish_route_shape_bands/
const processPerQueryConnection = (respond = () => result()) => {
  const calls = []
  return {
    __gtfsVizCliNative: true,
    calls,
    async query(sql) {
      calls.push(sql)
      if (spatialSql.test(sql) && !/LOAD spatial/i.test(sql)) {
        throw new Error("ST_Simplify exists in the spatial extension")
      }
      return respond(sql)
    },
  }
}

test("native spatial queries load spatial in the same request", async () => {
  const bodies = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body).sql)
    return { ok: true, json: async () => ({ rows: [] }) }
  }
  try {
    const conn = nativeDuckDb.createCliNativeConnection({ sessionId: "s" })
    await nativeDuckDb.queryWithSpatial(conn, "SELECT ST_Simplify(geom, 1) FROM shapes")
    assert.equal(bodies.length, 1)
    assert.match(bodies[0], /LOAD spatial;[\s\S]*ST_Simplify/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("native spatial queries do not retry non-extension errors", async () => {
  const binderError = new Error('Binder Error: Referenced column "missing" not found')
  const calls = []
  const conn = {
    __gtfsVizCliNative: true,
    async query(sql) {
      calls.push(sql)
      throw binderError
    },
  }

  await assert.rejects(
    nativeDuckDb.queryWithSpatial(conn, "SELECT missing FROM shapes"),
    (error) => error === binderError,
  )
  assert.equal(calls.length, 1)
})

test("native spatial queries retry a missing spatial extension exactly once", async () => {
  const calls = []
  const conn = {
    __gtfsVizCliNative: true,
    async query(sql) {
      calls.push(sql)
      if (calls.length === 1) {
        throw new Error(
          'IO Error: Extension "spatial" is not installed. Install it first using "INSTALL spatial".',
        )
      }
      return result()
    },
  }

  await nativeDuckDb.queryWithSpatial(conn, "SELECT ST_Simplify(geom, 1) FROM shapes")

  assert.equal(calls.length, 2)
  assert.match(
    calls[1],
    /INSTALL spatial;[\s\S]*LOAD spatial;[\s\S]*SELECT ST_Simplify\(geom, 1\) FROM shapes/,
  )
})

test("native query results expose cleaned route paths through Arrow-style columns", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      rows: [
        {
          route_id: "A",
          shape_id: "shape-1",
          route_name: "Route A",
          route_color_hex: "112233",
          route_text_color_hex: "ffffff",
          route_type_name: "Bus",
          band_count: 2,
          lons: [-71.1, -71.0],
          lats: [42.3, 42.4],
          slots: [-0.5, -0.5],
          turn_radii: [120, 140],
          band_counts: [2, 2],
        },
      ],
    }),
  })
  try {
    const conn = nativeDuckDb.createCliNativeConnection({ sessionId: "s" })
    const paths = await routeData.fetchRouteShapePaths(conn, ["A"], { offset: true })

    assert.equal(paths.length, 1)
    assert.equal(paths[0].route_id, "A")
    assert.equal(paths[0].band_count, 2)
    assert.deepEqual([...paths[0].lons], [-71.1, -71])
    assert.deepEqual([...paths[0].lats], [42.3, 42.4])
    assert.deepEqual([...paths[0].slots], [-0.5, -0.5])
    assert.deepEqual([...paths[0].bandCounts], [2, 2])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("native route lane preparation keeps spatial SQL process-local and reports progress", async () => {
  const conn = processPerQueryConnection()
  const progress = []
  const ok = await routeData.prepareRouteShapeLanes(conn, (done, total) =>
    progress.push([done, total]),
  )

  assert.equal(ok, true)
  assert.deepEqual(progress, [
    [1, 3],
    [2, 3],
    [3, 3],
  ])
  const preparation = conn.calls.filter((sql) => /prepare_route_shape_lanes_/.test(sql))
  assert.equal(preparation.length, 3)
  preparation.forEach((sql) => assert.match(sql, /LOAD spatial/i))
})

test("native compared-trip preparation keeps both spatial operations process-local", async () => {
  const conn = processPerQueryConnection((sql) => {
    if (/SELECT route_id, shape_id, shape_pt_sequence/.test(sql)) {
      return result([
        {
          route_id: "trip:T1",
          shape_id: "shape-1",
          shape_pt_sequence: 1,
          shape_pt_lat: 40,
          shape_pt_lon: -74,
          band_index: 0,
          band_count: 1,
          slot: 0,
          turn_radius: 5000,
        },
        {
          route_id: "trip:T1",
          shape_id: "shape-1",
          shape_pt_sequence: 2,
          shape_pt_lat: 40.1,
          shape_pt_lon: -73.9,
          band_index: 0,
          band_count: 1,
          slot: 0,
          turn_radius: 5000,
        },
      ])
    }
    return result()
  })

  const bands = await routeData.fetchTripShapeBands(conn, ["T1"])
  assert.deepEqual(Object.keys(bands), ["T1"])
  const spatialCalls = conn.calls.filter((sql) => spatialSql.test(sql))
  assert.equal(spatialCalls.length, 2)
  spatialCalls.forEach((sql) => assert.match(sql, /LOAD spatial/i))
})

test("valid CLI-precomputed bands survive absent web version metadata", async () => {
  let versionSelects = 0
  const conn = processPerQueryConnection((sql) => {
    if (/information_schema\.tables/i.test(sql) && /RouteShapeMacroVersion/.test(sql)) {
      return result([{ n: 0 }])
    }
    if (/information_schema\.tables/i.test(sql) && /RouteShapeBandsTable/.test(sql)) {
      return result([{ n: 1 }])
    }
    if (/SELECT version FROM RouteShapeMacroVersion/.test(sql)) {
      versionSelects++
      throw new Error("RouteShapeMacroVersion does not exist")
    }
    if (/SELECT route_id, MIN\(turn_radius\)/.test(sql)) {
      return result([{ route_id: "A", r: 50 }])
    }
    return result()
  })

  const ids = await routeData.bandedRouteIds(conn)
  assert.deepEqual([...ids], ["A"])
  assert.equal(versionSelects, 0, "first-run existence detection must not throw")
  assert.equal(
    conn.calls.some((sql) => /DROP TABLE IF EXISTS RouteShapeBandsTable/.test(sql)),
    false,
  )
})
