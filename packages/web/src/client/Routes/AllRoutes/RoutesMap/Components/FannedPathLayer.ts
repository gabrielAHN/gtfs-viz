import { PathLayer } from "@deck.gl/layers"
import { _mergeShaders as mergeShaders } from "@deck.gl/core"
import { createRouteShapeLayer } from "@gtfs-viz/duckdb-extension/deckgl"

export {
  encodeFanCode as encodeFanZ,
  FAN_CODE_RAW,
  fanBundleRefFor,
  fanMaxPxForZoom,
  buildRouteShapePaths,
  largestBundleIn,
  routeShapeLayerState,
  type RouteShapePath,
  type RouteShapeRecord,
} from "@gtfs-viz/duckdb-extension/deckgl"

const { FannedPathLayer, RouteShapeLayer } = createRouteShapeLayer({ PathLayer, mergeShaders })

export { RouteShapeLayer }
export default FannedPathLayer
