import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const load = (rel) => {
  const exports = {}
  const src = readFileSync(new URL(rel, import.meta.url), "utf8")
  vm.runInNewContext(
    ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (id) =>
        id === "./fan-code.js"
          ? fanCode
          : id === "@deck.gl/layers"
            ? { PathLayer: class {} }
            : id === "@deck.gl/core"
              ? { _mergeShaders: (_a, b) => b }
              : require(id),
    },
  )
  return exports
}
const require = createRequire(import.meta.url)
const fanCode = load("../../duckdb-extension/lib/deckgl/fan-code.ts")
const fanLayer = load("../../duckdb-extension/lib/deckgl/fanned-path-layer.ts")
const exports = {
  ...fanCode,
  encodeFanZ: fanCode.encodeFanCode,
  default: fanLayer.createFannedPathLayer({
    PathLayer: class {
      getShaders() {
        return {}
      }
    },
    mergeShaders: (_a, b) => b,
  }),
}
const shader = new exports.default().getShaders().inject["vs:#main-end"]
const scalar = shader
  .slice(shader.indexOf("float zcode"), shader.indexOf("vec2 legIn"))
  .replace(/\bfloat\b/g, "let")
const offsetAt = new Function(
  "code",
  "fanZoom",
  "fanMaxPx",
  "fanBundleRef",
  `
  const instanceFanStart = Math.fround(code), instanceFanEnd = Math.fround(code), isEnd = 0;
  const fanZoomBase = 12.5, fanZoomSpread = 3.5, fanGapSpread = 4;
  const mix = (a, b, t) => a * (1 - t) + b * t;
  const {floor, min, max, abs, log2} = Math;
  const clamp = (x, lo, hi) => min(hi, max(lo, x));
  const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  ${scalar}
  return fanPx;
`,
)
const FULL = 20
const offset = (code, ramp, cap) => offsetAt(code, ramp >= 1 ? FULL : 0, cap, 1)

for (const [routes, gap, cap] of [
  [12, 7, 24],
  [20, 9, 24],
  [30, 7, 40],
  [4, 7, 24],
]) {
  test(`${routes} lanes stay evenly spaced and legible at a ${cap}px cap`, () => {
    const xs = Array.from({ length: routes }, (_, i) =>
      offset(exports.encodeFanZ((i - (routes - 1) / 2) * gap, 5000, routes, gap), 1, cap),
    )
    const gaps = xs.slice(1).map((x, i) => x - xs[i])
    assert.ok(Math.min(...gaps) > 2.9, `smeared lanes: ${JSON.stringify(xs)}`)
    assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.06, `uneven gaps: ${JSON.stringify(gaps)}`)
    const legibleSpan = ((routes - 1) * 3.0) / 2
    assert.ok(
      Math.max(...xs.map(Math.abs)) <= Math.max(cap, legibleSpan) + 0.05,
      JSON.stringify(xs),
    )
    assert.ok(Math.abs(xs[0] + xs.at(-1)) < 0.03)
  })
}
test("raw and macro merge zones stay on the centreline", () => {
  assert.equal(offset(0, 1, 24), 0)
  assert.equal(offset(exports.encodeFanZ(21, 12, 7, 7), 1, 24), 0)
  assert.equal(offset(exports.encodeFanZ(21, 5000, 7, 7), 0, 24), 0)
})
test("smoothed lane offsets survive a corridor-count transition", () => {
  assert.ok(Math.abs(offset(exports.encodeFanZ(21, 5000, 1, 7), 1, 24) - 21) < 0.02)
})
test("low zoom trunk emphasis does not obscure local details", () => {
  assert.ok(1 + exports.default.defaultProps.trunkGain.value * 5 <= 1.5)
})
test("dense bundles start fanning later than pairs, on a data-derived scale", () => {
  const ref = exports.fanBundleRefFor(27)
  const pair = exports.encodeFanZ(3.5, 5000, 2, 7)
  const dense = exports.encodeFanZ((26 / 2) * 7, 5000, 27, 7)
  const zPair = [12.4, 13.3, 14.5, 16.5].map((z) => offsetAt(pair, z, 40, ref))
  const zDense = [12.4, 13.3, 14.5, 16.5].map((z) => offsetAt(dense, z, 40, ref))
  assert.equal(zPair[0], 0)
  assert.ok(zPair[1] > 2.9, `pairs should be open by z13.3: ${zPair}`)
  assert.equal(zDense[1], 0, `27-route bundle must still be merged at z13.3: ${zDense}`)
  assert.equal(zDense[2], 0, `27-route bundle must still be merged at z14.5: ${zDense}`)
  assert.ok(zDense[3] > 30, `27-route bundle must be fully open at z16.5: ${zDense}`)
})
test("the fan-in window is scaled by the feed's widest corridor", () => {
  const code = exports.encodeFanZ((7 / 2) * 7, 5000, 8, 7)
  const small = offsetAt(code, 13.9, 40, exports.fanBundleRefFor(8))
  const big = offsetAt(code, 13.9, 40, exports.fanBundleRefFor(32))
  assert.ok(small > 2.9 && big === 0, `small=${small} big=${big}`)
  assert.equal(exports.fanBundleRefFor(2), exports.fanBundleRefFor(8))
  assert.equal(exports.fanBundleRefFor(100), exports.fanBundleRefFor(32))
  assert.equal(exports.fanBundleRefFor(32), 1)
})
test("wide bundles open compact at medium zoom and reach full lane gaps only when zoomed in", () => {
  const ref = exports.fanBundleRefFor(16)
  const outer = exports.encodeFanZ((11 / 2) * 7, 5000, 12, 7)
  const pair = exports.encodeFanZ(3.5, 5000, 2, 7)
  const full = offsetAt(outer, 19, 60, ref)
  const medium = offsetAt(outer, 15.3, 60, ref)
  assert.ok(medium > 0, "12-route bundle should already be separated at z15.3")
  assert.ok(medium < 0.55 * full, `12-route bundle too wide at z15.3: ${medium} of ${full}`)
  assert.ok(Math.abs(full - 38.5) < 0.05, `full gap not reached when zoomed in: ${full}`)
  assert.ok(Math.abs(offsetAt(pair, 13.6, 60, ref) - 3.5) < 0.05, "pairs open straight to full gap")
})
