# Corridor regression checks

Run from the repository root:

```sh
node --test packages/duckdb-extension/tests/corridor-lanes.test.mjs
node --test packages/web/tests/route-fan.test.mjs
node packages/duckdb-extension/tests/check-feed.mjs /path/to/extracted-gtfs /tmp/feed-report.json
```

The native checks need the DuckDB CLI and its installed `spatial` extension. They read the SQL directly from `src/include/gtfs_sql.hpp`, not a possibly stale build. Node is the only test-runner dependency; the web shader test also uses the project's existing TypeScript compiler.

`check-feed.mjs` reads `shapes.txt`, `trips.txt` and `routes.txt`, prepares all three mode groups, and finishes in twelve-route chunks. It checks route coverage, finite coordinates, sequence uniqueness, bounded endpoint displacement and distance to the **source polyline**, under a 1200 MB no-spill limit. Set `GTFS_TEST_MEMORY_MB=1600` to test the web app's memory budget. Full native in-memory loading of Budapest exceeds 1200 MB; it passes at 1600 MB. These are shape-processing tests, not full browser-import or schedule-data memory tests.

## Non-example feeds checked

- TriMet: https://developer.trimet.org/schedule/gtfs.zip — 110/110 eligible routes, maximum distance to source 17.757 m.
- SFMTA: https://muni-gtfs.apps.sfmta.com/data/muni_gtfs-current.zip — 68/68 eligible routes, maximum distance to source 19.704 m. SFMTA's data terms: https://www.sfmta.com/reports/gtfs-transit-data.

Those results describe the downloaded snapshots, not future feed versions. No feed files are committed. Budapest and Chicago also pass coverage/geometry checks; this does **not** establish correct lane ordering at all junctions.

## What these checks do not prove

- The current per-vertex neighbour/ranking approach still permits lane crossings where routes join and neighbour sets differ. The curved-shape regression catches compass-seam flips, not general corridor topology.
- Native success is not DuckDB-WASM validation. Browser screenshots must use a rebuilt extension and web package, enable `Separate Route(s)`, wait for optimisation to finish, and inspect the actual result.
- `orig_lat` / `orig_lon` are carried from source vertices through fairing, not interpolated point-for-point correspondence. Subtracting them from every output point overstates geometric displacement. Measure distance to the selected source polyline instead.
- Shapes with fewer than two valid distinct points cannot define a drawable line. Broken coordinates, date-line crossings and geographically distant routes in one feed need separate validation.
- The macro selects one representative shape per route. It is not a lossless exporter of every trip's shape variant.

## Using standalone shapes.txt

The geometry stages use only shape points and minimal route-to-shape metadata, not stops, schedules or OSM. In a **separate scratch database**, load the standard shapes columns into `shapes`, expose one synthetic `route_id` per `shape_id` through `TripsView`, and expose matching `RoutesView` rows with a route type and display metadata. Then install/call `prepare_route_shape_lanes` and `finish_route_shape_bands`. Treating each shape as a route displays every shape variant; it does not infer which variants belong to the same transit service. Do not replace an imported GTFS database's real views with this adapter.
