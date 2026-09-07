import { PathLayer } from "@deck.gl/layers"
import { _mergeShaders as mergeShaders } from "@deck.gl/core"

const FAN_SHADER_INJECT = {
  "vs:#decl": `
uniform float fanRamp;
uniform float fanMaxPx;
uniform float trunkGain;
`,
  "vs:#main-end": `
if (!billboard) {
  float zcode = geometry.worldPosition.z;
  float routes = floor(zcode / 10000.0);
  float rest = zcode - routes * 10000.0;
  float mstep = floor(rest / 1000.0);
  rest -= mstep * 1000.0;
  float gap = floor(rest / 100.0);
  float lane = (rest - gap * 100.0) / 99.0 * 2.0 - 1.0;
  float halfSpan = max(0.0, routes - 1.0) * gap * 0.5;
  if (routes < 1.0) { lane = 0.0; routes = 1.0; mstep = 4.0; }
  float mergeFan = mstep < 0.5 ? 0.0 : mstep < 1.5 ? 0.26 : mstep < 2.5 ? 0.74 : mstep < 3.5 ? 0.98 : 1.0;
  float comp = halfSpan > 0.0 ? min(1.0, fanMaxPx / halfSpan) : 1.0;
  float gEff = gap * comp * fanRamp * mergeFan;
  if (gEff < 3.5) { gEff = gEff < 1.2 ? 0.0 : 3.5; }
  float fanPx = lane * max(0.0, routes - 1.0) * 0.5 * gEff;
  vec2 legIn = (currPosition - prevPosition).xy;
  vec2 legOut = (nextPosition - currPosition).xy;
  vec2 dir3 = legIn + legOut;
  if (length(dir3) < 0.5 * max(length(legIn), length(legOut))) {
    dir3 = length(legIn) >= length(legOut) ? legIn : legOut;
  }
  vec2 dir = length(dir3) > 0.0 ? normalize(dir3) : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 lateral = perp * project_pixel_size(fanPx);
  float collapsed = 1.0 - fanRamp * mergeFan;
  float trunkScale = 1.0 + trunkGain * min(routes - 1.0, 5.0) * collapsed;
  vec2 extrude = geometry.position.xy - currPosition.xy;
  geometry.position = vec4(currPosition.xy + extrude * trunkScale + lateral, 0.0, 1.0);
  gl_Position = project_common_position_to_clipspace(geometry.position);
}
`,
}

export const encodeFanZ = (
  slotPx: number,
  turnRadiusM: number,
  bandCount = 1,
  gapPx = 7,
): number => {
  const r = Number.isFinite(turnRadiusM) ? turnRadiusM : 5000
  const step = r < 20 ? 0 : r < 36 ? 1 : r < 50 ? 2 : r < 100 ? 3 : 4
  const band = Number.isFinite(bandCount) ? Math.max(1, Math.round(bandCount)) : 1
  const gap = Number.isFinite(gapPx) ? Math.min(9, Math.max(1, Math.round(gapPx))) : 7
  const count = Math.max(
    band,
    Number.isFinite(slotPx) ? Math.ceil(1 + (2 * Math.abs(slotPx)) / gap) : 1,
  )
  const routes = Math.min(512, count)
  const halfSpan = (count - 1) * gap * 0.5
  const lane =
    halfSpan > 0 && Number.isFinite(slotPx) ? Math.min(1, Math.max(-1, slotPx / halfSpan)) : 0
  return routes * 10000 + step * 1000 + gap * 100 + (lane + 1) * 49.5
}

type FannedPathLayerProps = {
  fanRamp?: number
  fanMaxPx?: number
  trunkGain?: number
}

export default class FannedPathLayer<DataT = any> extends PathLayer<DataT, FannedPathLayerProps> {
  static layerName = "FannedPathLayer"
  static defaultProps = {
    ...(PathLayer as any).defaultProps,
    fanRamp: { type: "number", value: 0, min: 0, max: 1 },
    fanMaxPx: { type: "number", value: 24, min: 0 },
    trunkGain: { type: "number", value: 0.08, min: 0 },
  }

  getShaders() {
    return mergeShaders(super.getShaders(), { inject: FAN_SHADER_INJECT })
  }

  draw(opts: any) {
    const { fanRamp = 0, fanMaxPx = 24, trunkGain = 0.08 } = this.props as any
    super.draw({
      ...opts,
      uniforms: { ...opts?.uniforms, fanRamp, fanMaxPx, trunkGain },
    })
  }
}
