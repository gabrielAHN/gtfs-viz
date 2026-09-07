import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const source = readFileSync(
  new URL(
    "../src/client/Routes/AllRoutes/RoutesMap/Components/FannedPathLayer.ts",
    import.meta.url,
  ),
  "utf8",
)
const exports = {}
const require = createRequire(import.meta.url)
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports,
    require: (id) =>
      id === "@deck.gl/layers"
        ? {
            PathLayer: class {
              getShaders() {
                return {}
              }
            },
          }
        : id === "@deck.gl/core"
          ? { _mergeShaders: (_a, b) => b }
          : require(id),
  },
)
// Execute the actual scalar GLSL decoding/fan expressions, not a second copy
// of the algorithm. The surrounding deck.gl projection is tested in-browser.
const shader = new exports.default().getShaders().inject["vs:#main-end"]
const scalar = shader
  .slice(shader.indexOf("float zcode"), shader.indexOf("vec2 legIn"))
  .replace(/\bfloat\b/g, "let")
const offset = new Function(
  "code",
  "fanRamp",
  "fanMaxPx",
  `
  const geometry = {worldPosition: {z: Math.fround(code)}};
  const {floor, min, max, abs} = Math;
  const clamp = (x, lo, hi) => min(hi, max(lo, x));
  ${scalar}
  return fanPx;
`,
)

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
    // never compressed into the smear zone: at least a casing seam per lane
    assert.ok(Math.min(...gaps) > 3.4, `smeared lanes: ${JSON.stringify(xs)}`)
    assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.06, `uneven gaps: ${JSON.stringify(gaps)}`)
    // within the cap, or overshooting it only to keep the minimum legible gap
    const legibleSpan = ((routes - 1) * 3.5) / 2
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
