import { fanBundleRefFor, fanMaxPxForZoom } from "./fan-code.js"
import { createFannedPathLayer, type FannedPathLayerDeps, type FanLayerProps } from "./fanned-path-layer.js"
import {
  buildRouteShapePaths,
  isRouteShapePath,
  largestBundleIn,
  type RouteShapePath,
  type RouteShapeRecord,
} from "./route-shape-paths.js"

export type RouteShapeLayerProps = {
  id: string
  data: ReadonlyArray<RouteShapeRecord | RouteShapePath>
  zoom: number
  cleaned?: boolean
  largestBundle?: number
  fanZoomBase?: number
  fanZoomSpread?: number
  fanGapSpread?: number
  fanMaxPx?: number
  trunkGain?: number
  [layerProp: string]: unknown
}

export type RouteShapeLayerState = {
  cleaned: boolean
  fanZoom: number
  fanBundleRef: number
  fanMaxPx: number
}

export const routeShapeLayerState = (
  data: ReadonlyArray<RouteShapeRecord | RouteShapePath>,
  zoom: number,
  options: { cleaned?: boolean; largestBundle?: number; fanMaxPx?: number } = {},
): RouteShapeLayerState => {
  const cleaned =
    options.cleaned ??
    data.some((row) =>
      isRouteShapePath(row) ? row.fanCodes != null : (row as RouteShapeRecord).slots != null,
    )
  const largest = options.largestBundle ?? (cleaned ? largestBundleIn(data) : 0)
  return {
    cleaned,
    fanZoom: cleaned ? zoom : 0,
    fanBundleRef: fanBundleRefFor(largest),
    fanMaxPx: options.fanMaxPx ?? fanMaxPxForZoom(zoom),
  }
}

export const routeShapeLayerProps = ({
  data,
  zoom,
  cleaned,
  largestBundle,
  fanZoomBase,
  fanZoomSpread,
  fanGapSpread,
  fanMaxPx,
  trunkGain,
  ...layerProps
}: RouteShapeLayerProps): Record<string, unknown> & FanLayerProps<RouteShapePath> => {
  const state = routeShapeLayerState(data, zoom, { cleaned, largestBundle, fanMaxPx })
  const paths = data.every(isRouteShapePath)
    ? (data as ReadonlyArray<RouteShapePath>)
    : buildRouteShapePaths(data as ReadonlyArray<RouteShapeRecord>, { cleaned: state.cleaned })
  return {
    ...layerProps,
    data: paths,
    getPath: (row: RouteShapePath) => row.path,
    getFanCodes: (row: RouteShapePath) => row.fanCodes,
    positionFormat: "XY",
    _pathType: "open",
    fanZoom: state.fanZoom,
    fanBundleRef: state.fanBundleRef,
    fanMaxPx: state.fanMaxPx,
    ...(fanZoomBase != null ? { fanZoomBase } : {}),
    ...(fanZoomSpread != null ? { fanZoomSpread } : {}),
    ...(fanGapSpread != null ? { fanGapSpread } : {}),
    ...(trunkGain != null ? { trunkGain } : {}),
  }
}

export function createRouteShapeLayer(deps: FannedPathLayerDeps) {
  const FannedPathLayer = createFannedPathLayer(deps)
  class RouteShapeLayer extends FannedPathLayer {
    static layerName = "RouteShapeLayer"
    constructor(props: RouteShapeLayerProps) {
      super(routeShapeLayerProps(props))
    }
  }
  return { FannedPathLayer, RouteShapeLayer }
}
