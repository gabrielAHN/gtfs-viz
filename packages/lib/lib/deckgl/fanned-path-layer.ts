import { FAN_CODE_RAW } from "./fan-code.js"

export const FAN_SHADER_INJECT = {
  "vs:#decl": `
attribute float instanceFanStart;
attribute float instanceFanEnd;
uniform float fanZoom;
uniform float fanZoomBase;
uniform float fanZoomSpread;
uniform float fanGapSpread;
uniform float fanBundleRef;
uniform float fanMaxPx;
uniform float trunkGain;
`,
  "vs:#main-end": `
if (!billboard) {
  float zcode = mix(instanceFanStart, instanceFanEnd, isEnd);
  float routes = floor(zcode / 10000.0);
  float rest = zcode - routes * 10000.0;
  float mstep = floor(rest / 1000.0);
  rest -= mstep * 1000.0;
  float gap = floor(rest / 100.0);
  float lane = (rest - gap * 100.0) / 99.0 * 2.0 - 1.0;
  float halfSpan = max(0.0, routes - 1.0) * gap * 0.5;
  if (routes < 1.0) { lane = 0.0; routes = 1.0; mstep = 4.0; }
  float mergeFan = mstep < 0.5 ? 0.0 : mstep < 1.5 ? 0.26 : mstep < 2.5 ? 0.74 : mstep < 3.5 ? 0.98 : 1.0;
  float crowd = clamp((log2(max(routes, 2.0)) - 1.0) / 4.0, 0.0, 1.0);
  float fanStart = fanZoomBase + fanZoomSpread * fanBundleRef * crowd;
  float fanRamp = smoothstep(fanStart, fanStart + 0.75, fanZoom);
  float openness = smoothstep(fanStart + 0.75, fanStart + 0.751 + fanGapSpread * crowd, fanZoom);
  float compact = 3.0;
  float comp = halfSpan > 0.0 ? min(1.0, fanMaxPx / halfSpan) : 1.0;
  float gEff = mix(compact, gap, openness) * comp * fanRamp * mergeFan;
  if (gEff < compact) { gEff = gEff < 1.0 ? 0.0 : compact; }
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
  float laneScale = mix(0.6, 1.0, clamp((gEff - compact) / max(gap - compact, 0.001), 0.0, 1.0));
  float widthScale = mix(trunkScale, laneScale, fanRamp * mergeFan);
  vec2 extrude = geometry.position.xy - currPosition.xy;
  geometry.position = vec4(currPosition.xy + extrude * widthScale + lateral, 0.0, 1.0);
  gl_Position = project_common_position_to_clipspace(geometry.position);
}
`,
}

export type FanLayerProps<DataT = unknown> = {
  fanZoom?: number
  fanZoomBase?: number
  fanZoomSpread?: number
  fanGapSpread?: number
  fanBundleRef?: number
  fanMaxPx?: number
  trunkGain?: number
  getFanCodes?: ((row: DataT) => Float32Array | null | undefined) | null
}

export const FAN_LAYER_DEFAULT_PROPS = {
  fanZoom: { type: "number", value: 0, min: 0 },
  fanZoomBase: { type: "number", value: 12.5, min: 0 },
  fanZoomSpread: { type: "number", value: 3.5, min: 0 },
  fanGapSpread: { type: "number", value: 4, min: 0 },
  fanBundleRef: { type: "number", value: 1, min: 0, max: 1 },
  fanMaxPx: { type: "number", value: 24, min: 0 },
  trunkGain: { type: "number", value: 0.08, min: 0 },
  getFanCodes: { type: "accessor", value: null },
} as const

export const FAN_UNIFORM_NAMES = [
  "fanZoom",
  "fanZoomBase",
  "fanZoomSpread",
  "fanGapSpread",
  "fanBundleRef",
  "fanMaxPx",
  "trunkGain",
] as const

export const fanUniformsFromProps = (props: Record<string, unknown>): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const name of FAN_UNIFORM_NAMES) {
    const v = props[name]
    out[name] =
      typeof v === "number" && Number.isFinite(v)
        ? v
        : (FAN_LAYER_DEFAULT_PROPS[name] as { value: number }).value
  }
  return out
}

export const FAN_CODES_ATTRIBUTE = {
  size: 1,
  vertexOffset: 1,
  accessor: "getFanCodes",
  noAlloc: true,
  shaderAttributes: {
    instanceFanStart: { vertexOffset: 1 },
    instanceFanEnd: { vertexOffset: 2 },
  },
} as const

type PathTesselatorLike = { vertexStarts: number[]; instanceCount: number }

export const fillFanCodes = <DataT>(
  tesselator: PathTesselatorLike,
  data: ReadonlyArray<DataT>,
  getFanCodes: ((row: DataT) => Float32Array | null | undefined) | null | undefined,
): { value: Float32Array; startIndices: number[] } => {
  const starts = tesselator.vertexStarts
  const total = tesselator.instanceCount
  const codes = new Float32Array(total + 4)
  for (let i = 0; i < data.length; i++) {
    const start = starts[i]
    const end = starts[i + 1] ?? total
    const src = getFanCodes ? getFanCodes(data[i]) : null
    const n = end - start
    if (src && src.length >= n) codes.set(src.subarray(0, n), start)
    else codes.fill(FAN_CODE_RAW, start, end)
  }
  return { value: codes, startIndices: starts }
}

type PathLayerCtor = {
  new (...props: any[]): any
  defaultProps?: Record<string, unknown>
  layerName?: string
}

export type FannedPathLayerDeps = {
  PathLayer: PathLayerCtor
  mergeShaders: (base: any, extra: any) => any
}

export type FannedPathLayerClass<PathLayerT extends PathLayerCtor> = PathLayerT & {
  layerName: string
  defaultProps: Record<string, unknown>
}

export function createFannedPathLayer<PathLayerT extends PathLayerCtor>({
  PathLayer,
  mergeShaders,
}: FannedPathLayerDeps & { PathLayer: PathLayerT }): FannedPathLayerClass<PathLayerT> {
  class FannedPathLayer extends (PathLayer as PathLayerCtor) {
    static layerName = "FannedPathLayer"
    static defaultProps = { ...(PathLayer.defaultProps ?? {}), ...FAN_LAYER_DEFAULT_PROPS }

    getShaders() {
      return mergeShaders(super.getShaders(), { inject: FAN_SHADER_INJECT })
    }

    initializeState(...args: unknown[]) {
      super.initializeState(...args)
      this.getAttributeManager().addInstanced({
        fanCodes: { ...FAN_CODES_ATTRIBUTE, update: this.calculateFanCodes },
      })
    }

    calculateFanCodes(attribute: { value: Float32Array; startIndices: number[] }) {
      const filled = fillFanCodes(this.state.pathTesselator, this.props.data, this.props.getFanCodes)
      attribute.startIndices = filled.startIndices
      attribute.value = filled.value
    }

    draw(opts: { uniforms?: Record<string, unknown> } = {}) {
      super.draw({ ...opts, uniforms: { ...opts.uniforms, ...fanUniformsFromProps(this.props) } })
    }
  }
  return FannedPathLayer as unknown as FannedPathLayerClass<PathLayerT>
}
