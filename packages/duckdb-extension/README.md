# GTFS DuckDB Extension

DuckDB extension for GTFS transit data — station analysis, pathway navigation, and pathfinding.

Provides a TypeScript API used by the [CLI](../cli) and [web app](../web), with all SQL embedded from a single source (`src/include/gtfs_sql.hpp`).

## TypeScript API

```typescript
import {
  installExtension,   // Full install: macros + views + tables
  installMacros,      // Enum macros + edit tables only
  installInit,        // Views + TABLE macros + materialized tables
  importGtfs,         // Full import: macros + CSV import + init
  buildImportSql,     // Generate import SQL string
  sqlForNamedQuery,   // Generate SQL for named queries
} from "@gtfs-viz/duckdb-extension";
```

## Downloaded-extension client (opt-in)

`@gtfs-viz/duckdb-extension/client` is a separate, dependency-free entry point. It imports neither the embedded SQL root nor rendering code, and importing or constructing it executes no queries. Existing app/CLI installers are unchanged. **No public/community artifact is assumed available.**

```typescript
import { createExtensionClient, type SqlExecutor } from '@gtfs-viz/duckdb-extension/client';

async function initialize(executor: SqlExecutor, repository: string, importNormalizedTables: () => Promise<void>) {
  const client = createExtensionClient(executor, { repository });
  await client.install();
  await client.load();
  await client.prepare();
  await importNormalizedTables();
  await client.init();
  return client;
}
```

Pass a WASM connection directly, or a native adapter with `query(sql: string): Promise<unknown>`. The adapter must reject SQL errors and execute queries against the intended database. Each method returns `Promise<void>`. Await operations sequentially: `load()` is its own query before any pragma; the client does not install/load implicitly, queue concurrent calls, or manage connections. Later call `await client.refresh()` after edits. Prepare creates missing edit tables; init/refresh materialize the normalized dataset and preserve pending edits. File ingestion and spatial-extension setup remain consumer responsibilities.

The repository is required and captured at construction. Only explicit HTTP(S) URLs without credentials, whitespace/control characters, backslashes, query strings, or fragments are accepted. Apostrophes are SQL-escaped, not interpolated as SQL syntax. Use a trusted HTTPS repository in production; HTTP permits isolated loopback development. DuckDB selects the engine/platform artifact path. Normal `INSTALL` cache semantics apply; this API does not force upgrades or replace cached artifacts.

Errors preserve the engine exception in `cause`, include operation-specific recovery guidance, and propagate without retry or embedded-SQL fallback. Signature policy is never modified. Do not enable unsigned extensions in consumers to bypass distribution failures.

See [downloaded-client verification](docs/downloaded-client.md) for commands, measured native/browser results, and the still-failing MVP signature gate.

## Registered Macros

### Enum Helpers

| Macro | Description |
| --- | --- |
| `pathway_mode_to_name(mode)` | Pathway mode integer to name |
| `bidirectional_to_direction(bidir)` | Bidirectional flag to direction |
| `location_type_to_name(type, parent)` | Location type to name |
| `wheelchair_to_emoji(boarding)` | Wheelchair boarding to status |

### Query Macros

| Macro | Description |
| --- | --- |
| `get_station_info(id)` | Station details with pathway/exit counts |
| `get_station_stops(id)` | All stops belonging to a station |
| `get_station_pathways(id)` | Pathways for a station |
| `get_station_connections(id)` | Directed connections with times |
| `get_pathways_filtered(...)` | Pathways with filters |
| `get_station_routes(id)` | Shortest routes between all parts |

### Pathfinding Macros

| Macro | Description |
| --- | --- |
| `find_shortest_path(station, from, to)` | Shortest path between two stops |
| `find_reachable_stops(station, from)` | All reachable stops from a point |
| `find_all_paths(station, from, to)` | All paths between two stops |
| `get_direct_pathways(station)` | Direct connections with filters |

### Route Line Macros

| Macro | Description |
| --- | --- |
| `prepare_route_shape_lanes_rail()` / `_bus()` / `_other()` | Assign each route a lane inside every corridor it shares with other routes of the same mode |
| `finish_route_shape_bands(route_ids)` | Fair the lane geometry for a set of routes and write `RouteShapeBandsTable` |
| `refresh_route_shape_bands()` | Finish every prepared route |
| `get_station_line_bands(station_id)` | Banded lines that serve one station |

## deck.gl route layer

Rendering now lives in the separate [rendering library](../lib). This database wrapper no longer exports rendering symbols or a `/deckgl` entry point.

`@gtfs-viz/lib/deckgl` renders `RouteShapeBandsTable` (or plain `shapes`) as one path layer that merges shared corridors into a trunk at low zoom and fans them into parallel lanes as you zoom in, with the fan-in staged by how many routes share the corridor and scaled to the widest corridor in the feed. The lane offset lives in the vertex shader, so zooming never re-fetches or re-tesselates.

```typescript
import { PathLayer } from "@deck.gl/layers"
import { _mergeShaders as mergeShaders } from "@deck.gl/core"
import { createRouteShapeLayer } from "@gtfs-viz/lib/deckgl"

const { RouteShapeLayer } = createRouteShapeLayer({ PathLayer, mergeShaders })

new RouteShapeLayer({
  id: "routes",
  zoom: viewState.zoom,
  data: records,            // RouteShapeRecord[]: route_id, lons, lats and, when cleaned, slots / turnRadii / bandCounts
  getColor: [30, 100, 220],
  getWidth: 3,
  widthUnits: "pixels",
})
```

The layer detects whether records carry lane data: cleaned records fan, raw records draw exactly as `PathLayer` would. Records can be built from any query over `RouteShapeBandsTable`, for example:

```sql
SELECT route_id, shape_id,
       list(shape_pt_lon ORDER BY shape_pt_sequence) AS lons,
       list(shape_pt_lat ORDER BY shape_pt_sequence) AS lats,
       list(slot ORDER BY shape_pt_sequence) AS slots,
       list(turn_radius ORDER BY shape_pt_sequence) AS turnRadii,
       list(band_count ORDER BY shape_pt_sequence) AS bandCounts
FROM RouteShapeBandsTable GROUP BY 1, 2
```

Lower-level pieces are exported for custom layers: `buildRouteShapePaths` (records → `Float64Array` XY paths + `Float32Array` fan codes), `createFannedPathLayer` (a `PathLayer` subclass that takes `getFanCodes` plus `fanZoom` / `fanBundleRef` / `fanMaxPx` props), `FAN_SHADER_INJECT`, `encodeFanCode`, `fanBundleRefFor`, `largestBundleIn`. deck.gl is a peer: pass your own `PathLayer` and `_mergeShaders` so the package does not pin a deck.gl version.

## Building

```bash
yarn build   # Generates dist/ from src/include/gtfs_sql.hpp
```
