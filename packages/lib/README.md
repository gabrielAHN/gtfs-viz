# GTFS Viz rendering library

`@gtfs-viz/lib` contains route-path adapters, fan-code encoding, shaders, and deck.gl layer factories. The root entry point and `@gtfs-viz/lib/deckgl` expose the same rendering API.

There are no runtime dependencies, SQL installers, or DuckDB imports. Applications inject their own deck.gl `PathLayer` and shader merger:

```typescript
import { PathLayer } from "@deck.gl/layers"
import { _mergeShaders as mergeShaders } from "@deck.gl/core"
import { createRouteShapeLayer } from "@gtfs-viz/lib"

const { RouteShapeLayer } = createRouteShapeLayer({ PathLayer, mergeShaders })
const layer = new RouteShapeLayer({
  id: "routes",
  data: [{ route_id: "A", lons: [0, 0.001], lats: [0, 0.001] }],
  zoom: 15,
  getColor: [30, 100, 220],
  getWidth: 3,
  widthUnits: "pixels",
})
```

Records carrying `slots`, `turnRadii`, and `bandCounts` support cleaned corridor lanes; raw records remain ordinary paths. Database algorithms live in the separate [GTFS DuckDB Extension](https://github.com/gabrielAHN/gtfs-duckdb-extension); `@gtfs-viz/duckdb-client` only downloads and loads it. Rendering imports formerly taken from that package's root or `/deckgl` entry point must move here; there is no compatibility re-export.

From the repository root:

```bash
yarn install --ignore-engines
yarn build:lib
yarn workspace @gtfs-viz/lib run test
yarn test
yarn build
yarn run check
```

The boundary test compiles the library into an isolated temporary package, checks its module imports and dependency declarations, and imports both public entry points in a fresh Node process without the database wrapper or DuckDB installed. The web regression tests exercise shader behavior, path conversion, and deck.gl tessellation.
