import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import ts from "typescript"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8")
const LIB = "../../duckdb-extension/lib/deckgl/"
const loaded = {}
const loadLib = (name) => {
  if (loaded[name]) return loaded[name]
  const out = ts.transpileModule(read(LIB + name + ".ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInThisContext(`(function (exports, require) { ${out} })`)(exports, (id) =>
    id.startsWith("./") ? loadLib(id.slice(2).replace(/\.js$/, "")) : require(id),
  )
  loaded[name] = exports
  return exports
}
const mapSource = read("../src/client/Routes/AllRoutes/RoutesMap/Components/MapSection.tsx")
const tripSource = read("../src/client/Trips/components/Map/Components/MapSection.tsx")

test("every route path layer skips deck.gl path normalisation", () => {
  for (const [name, src] of [
    ["routes", mapSource],
    ["trips", tripSource],
  ]) {
    const layers = src.split("new FannedPathLayer(").slice(1)
    assert.ok(layers.length > 0, `${name}: no FannedPathLayer found`)
    for (const block of layers) {
      const body = block.slice(0, block.indexOf("})"))
      assert.ok(
        body.includes('_pathType: "open"'),
        `${name}: layer without _pathType open:\n${body}`,
      )
    }
  }
})

test("loaded chunks are drawn as one layer pair once the stream settles", () => {
  assert.match(mapSource, /setSettledChunks\(chunkPaths\)/)
  assert.match(
    mapSource,
    /settledChunks === chunkPaths && chunkPaths\.length > 1 \? \[paths\] : chunkPaths/,
  )
  assert.match(mapSource, /routes-shape-\$\{layerKey\}/)
})

test("selection and hover lookups are indexed by route, not scanned", () => {
  assert.match(mapSource, /pathsByRoute\.get\(selectedRouteId\)/)
  assert.match(mapSource, /pathsByRoute\.get\(hoverRouteId\)/)
  assert.doesNotMatch(
    mapSource,
    /linePaths\.filter\(\(row: any\) => String\(row\.route_id\) === (selectedRouteId|hoverRouteId)\)/,
  )
})

test("_pathType open keeps deck.gl tesselation output identical for open paths", () => {
  const {
    default: PathTesselator,
  } = require("@deck.gl/layers/dist/es5/path-layer/path-tesselator.js")
  const paths = [
    { path: new Float64Array([0, 0, 0.001, 0.001, 0.002, 0.0015]) },
    { path: new Float64Array([1, 1, 1.001, 1.002]) },
  ]
  const run = (normalize) => {
    const t = new PathTesselator({ fp64: false })
    t.updateGeometry({
      data: paths,
      buffers: {},
      normalize,
      loop: false,
      getGeometry: (d) => d.path,
      positionFormat: "XY",
      wrapLongitude: false,
      dataChanged: true,
    })
    return {
      count: t.instanceCount,
      pos: Array.from(t.get("positions")),
      types: Array.from(t.get("segmentTypes")),
    }
  }
  assert.deepEqual(run(false), run(true))
})

test("encodeFanCode stays cheap per vertex", () => {
  const { encodeFanCode } = loadLib("fan-code")
  const n = 200000
  let acc = 0
  const t0 = performance.now()
  for (let i = 0; i < n; i++) acc += encodeFanCode((i % 13) - 6, i % 7 ? 5000 : 12, 1 + (i % 5), 7)
  const ms = performance.now() - t0
  assert.ok(acc > 0)
  assert.ok(ms < 250, `encodeFanCode took ${ms.toFixed(0)} ms for ${n} vertices`)
})

test("fan codes line up with deck.gl's per-vertex instance layout", () => {
  const { createFannedPathLayer } = loadLib("fanned-path-layer")
  const exports = {
    FAN_CODE_RAW: loadLib("fan-code").FAN_CODE_RAW,
    default: createFannedPathLayer({
      PathLayer: class {
        initializeState() {}
      },
      mergeShaders: (_a, b) => b,
    }),
  }
  const {
    default: PathTesselator,
  } = require("@deck.gl/layers/dist/es5/path-layer/path-tesselator.js")
  const data = [
    {
      path: new Float64Array([0, 0, 0.001, 0, 0.002, 0]),
      fanCodes: new Float32Array([11, 12, 13]),
    },
    { path: new Float64Array([1, 1, 1.001, 1]), fanCodes: null },
    {
      path: new Float64Array([2, 2, 2.001, 2, 2.002, 2, 2.003, 2]),
      fanCodes: new Float32Array([41, 42, 43, 44]),
    },
  ]
  const tess = new PathTesselator({ fp64: false })
  tess.updateGeometry({
    data,
    buffers: {},
    normalize: false,
    loop: false,
    getGeometry: (d) => d.path,
    positionFormat: "XY",
    wrapLongitude: false,
    dataChanged: true,
  })
  const layer = new exports.default()
  layer.state = { pathTesselator: tess }
  layer.props = { data, getFanCodes: (d) => d.fanCodes }
  const attribute = {}
  layer.calculateFanCodes(attribute)
  assert.deepEqual(attribute.startIndices, tess.vertexStarts)
  const raw = exports.FAN_CODE_RAW
  assert.deepEqual(Array.from(attribute.value.subarray(0, tess.instanceCount)), [
    11,
    12,
    13,
    raw,
    raw,
    41,
    42,
    43,
    44,
  ])
  assert.equal(attribute.value.length >= tess.instanceCount + 2, true)
})

test("buildRouteShapePaths emits XY positions plus fan codes only for cleaned records", () => {
  const { buildRouteShapePaths, largestBundleIn } = loadLib("route-shape-paths")
  const { FAN_CODE_RAW } = loadLib("fan-code")
  const records = [
    {
      route_id: "A",
      route_type_name: "Bus",
      lons: new Float64Array([0, 0.001, 0.002]),
      lats: new Float64Array([0, 0, 0]),
      slots: new Float32Array([-0.5, -0.5, -0.5]),
      turnRadii: new Float32Array([5000, 5000, 5000]),
      bandCounts: new Float32Array([2, 2, 2]),
    },
    { route_id: "B", route_type_name: "Bus", lons: [1, 1.001], lats: [1, 1] },
    { route_id: "C", lons: [2], lats: [2] },
  ]
  const out = buildRouteShapePaths(records)
  assert.equal(out.length, 2)
  assert.deepEqual(Array.from(out[0].path), [0, 0, 0.001, 0, 0.002, 0])
  assert.ok(out[0].fanCodes instanceof Float32Array)
  assert.equal(out[0].fanCodes.length, 3)
  assert.notEqual(out[0].fanCodes[1], FAN_CODE_RAW)
  assert.equal(out[0].lons, undefined)
  assert.equal(out[1].fanCodes, null)
  assert.equal(largestBundleIn(records), 2)
  assert.equal(largestBundleIn([{ band_count: 9 }, ...records]), 9)
})

test("routeShapeLayerProps hides the cleaned vs raw distinction from callers", () => {
  const { routeShapeLayerProps, routeShapeLayerState } = loadLib("route-shape-layer")
  const cleaned = [
    {
      route_id: "A",
      lons: [0, 0.001],
      lats: [0, 0],
      slots: [0.5, 0.5],
      turnRadii: [5000, 5000],
      bandCounts: [16, 16],
    },
  ]
  const raw = [{ route_id: "A", lons: [0, 0.001], lats: [0, 0] }]
  const c = routeShapeLayerProps({ id: "x", data: cleaned, zoom: 15, getColor: [1, 2, 3] })
  const r = routeShapeLayerProps({ id: "x", data: raw, zoom: 15 })
  assert.equal(c.fanZoom, 15)
  assert.equal(r.fanZoom, 0)
  assert.equal(c.positionFormat, "XY")
  assert.equal(c._pathType, "open")
  assert.deepEqual(c.getColor, [1, 2, 3])
  assert.ok(c.getFanCodes(c.data[0]) instanceof Float32Array)
  assert.equal(r.getFanCodes(r.data[0]), null)
  assert.equal(routeShapeLayerState(cleaned, 15).fanBundleRef, (Math.log2(16) - 1) / 4)
  assert.equal(routeShapeLayerState(raw, 15).fanBundleRef, (Math.log2(8) - 1) / 4)
  const prebuilt = routeShapeLayerProps({ id: "x", data: c.data, zoom: 16 })
  assert.equal(prebuilt.data, c.data)
})

test("the web app consumes the layer from the library instead of a local copy", () => {
  const fanSource = read("../src/client/Routes/AllRoutes/RoutesMap/Components/FannedPathLayer.ts")
  assert.match(fanSource, /from "@gtfs-viz\/duckdb-extension\/deckgl"/)
  assert.doesNotMatch(fanSource, /vs:#main-end/)
})
