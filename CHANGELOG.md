# Changelog

Notable changes to GTFS Viz: the web app, the docs site, `@gtfs-viz/duckdb-client` and `@gtfs-viz/lib`. GTFS Viz has no versions; it deploys from `main`, so each section is the date a change landed.

The CLI lives in [gabrielAHN/gtfs-tools](https://github.com/gabrielAHN/gtfs-tools), and its whole history, including the releases made from this repository, is in the [gtfs-tools CHANGELOG](https://github.com/gabrielAHN/gtfs-tools/blob/main/CHANGELOG.md).

## 2026-11-05

### Changed

- GTFS Viz has no versions: no `version` in the root, web or docs `package.json`, no release workflow and no tags. It deploys from `main`, and this changelog is dated.
- yarn 1 ignores a workspace without a version, so the web app and the docs are no longer yarn workspaces. Their dependencies move to the root `package.json`, and the root scripts run them. `@gtfs-viz/duckdb-client` and `@gtfs-viz/lib` stay workspaces at version `0.0.0`, which yarn needs to link them.
- `dashboard-manifest.json` is `{name, commit, cliApi: 1}`: the commit identifies the dashboard build, and there is no `version`. CI checks the new shape.
- The docs list the CLI's releases under GTFS Tools CLI, from its first npm release on. Those made from this repository link to their pull requests and GitHub releases here. GTFS Viz has no releases page; `/docs/gtfs-viz/releases/` and its old release pages open the GTFS Tools CLI releases.
- The docs only describe `@gabrielahn/gtfs-tools` and the `gtfs-tools` command.

## 2026-11-04

Pull request: [#25](https://github.com/gabrielAHN/gtfs-viz/pull/25)

### Changed

- The CLI moves to [gabrielAHN/gtfs-tools](https://github.com/gabrielAHN/gtfs-tools), which builds its dashboard from this repository as a git submodule. This repository keeps the web app, the docs and `@gtfs-viz/duckdb-client`.
- The docs gain a GTFS Tools CLI part. The CLI page moves to `/docs/gtfs-tools/cli/` (the old `/docs/gtfs-viz/cli/` still opens it), and `/docs/agents/` describes the `gtfs-tools` agent skill (`npx skills add gabrielAHN/gtfs-tools`).
- The browser import limit prompt and import errors point to the gtfs-tools CLI for full imports. The app links to the public docs site, so the CLI page and Docs links also open the docs from the CLI dashboard.

### Added

- `yarn build:dashboard` builds the CLI-mode web app into `packages/web/dist` and writes `dashboard-manifest.json` next to it. gtfs-tools runs this build in its submodule, so the dashboard ships with the CLI and works offline.

### Build notes

- The extension integration job in CI runs on the DuckDB v2.0.0 CLI. Its native harness drives `@gtfs-viz/duckdb-client` with the DuckDB CLI directly.
- CI runs `yarn build:dashboard` on every pull request and checks its manifest.

## 2026-09-29

Pull request: [#20](https://github.com/gabrielAHN/gtfs-viz/pull/20)

### Changed

- Load the separate [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) extension instead of bundling the SQL toolbox; `@gtfs-viz/duckdb-client` installs and loads it, and rendering lives in `@gtfs-viz/lib`.
- Import feeds in the web app with the extension's `gtfs_import` pragma.
- Serve the app, the docs at `/docs/` and the GTFS DuckDB browser build at `/extensions/` from one deployment.
- An unconfigured extension repository shows an actionable error, with no silent fallback.

### Added

- GTFS Tools docs with project pages, the function reference, agent skill categories, releases and upcoming features, each page also as markdown.
- A Docs button in the header, intro and footer.
- Share the light or dark theme between the app and the docs.

### Fixed

- Reopen a browser session by loading the extension instead of rebuilding the dataset.
- Opening the stations table before selecting a row no longer crashes.
- The import page is centered on small screens.

### Build notes

- Use Node 22.
- `yarn install --frozen-lockfile --ignore-engines`, then `yarn build`, `yarn test` and `yarn run check`.
- `yarn preview:deploy` runs the deploy build locally.
- GitHub Actions build, check and test every change and run the integration suite against the latest GTFS DuckDB build.

## 2026-09-15

Pull request: [#19](https://github.com/gabrielAHN/gtfs-viz/pull/19)

### Added

- Render overlapping routes as parallel bands, with stable lane assignment through shared corridors, and a **Separate Route(s)** map toggle.
- Render compared trips in lanes using their GTFS shape geometry, with a stop-to-stop fallback.
- Build route bands on demand with the DuckDB corridor macros.
- Ship the reusable deck.gl route-shape layer from `@gtfs-viz/lib/deckgl`.

### Changed

- Reduce corridor-processing time and peak memory, shrink persisted band data, defer route cleanup from import, and improve large-feed loading with persistent storage and controlled in-memory fallback.

### Build notes

- Use Node 22.
- Install dependencies with `yarn install --frozen-lockfile --ignore-engines`.
- Build all packages with `yarn build`.
- Run package checks with `yarn run check`.
- Corridor and DuckDB profile tests live in the [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) repository.
- Run all route renderer and native bridge tests:

  ```sh
  node --test \
    packages/web/tests/route-fan.test.mjs \
    packages/web/tests/route-render.test.mjs \
    packages/web/tests/native-route-bands.test.mjs
  ```

- Native test harnesses require the DuckDB CLI with the spatial extension installed.

## 2026-08-24

Pull requests: [#17](https://github.com/gabrielAHN/gtfs-viz/pull/17), [#18](https://github.com/gabrielAHN/gtfs-viz/pull/18)

### Added

- Trip rerouting: replace a section of a trip with another route's stop pattern between shared boundary stations, with replacement times fitted to the trip.
- Timetable and map previews that highlight possible and completed reroutes.
- Edits & Export review of reroutes, skipped stops, schedule changes, service changes and combined edits, in table and map comparison views, with per-category revert.
- Table pagination, the selected trip and the reroute form state are kept in the URL.

### Changed

- Reroute candidates come from shared DuckDB macros with a five-minute query cache, instead of large web-side queries.
- Browser DuckDB sessions use one thread, a 2 GB memory cap and no insertion-order preservation.
- Applying a reroute uses the shared form-processing overlay and returns to the edited trip.

## 2026-07-22

Pull request: [#16](https://github.com/gabrielAHN/gtfs-viz/pull/16)

### Added

- Compare up to 5 trips side by side in timetable, timeline and map views.
- Edit a trip's stop times: add, remove, reorder and retime stops, with undo and redo, in every view.
- Export stop times grouped by service, with a side-by-side diff for each trip.

### Fixed

- "Constructor Map requires 'new'" and react-map-gl `useImperativeHandle` crashes.
- A `useDuckDB` null crash on route pages.
- The edit timetable keeps showing every row after a reorder.

## 2026-06-15

Pull request: [#15](https://github.com/gabrielAHN/gtfs-viz/pull/15)

### Added

- Route map and table with type and name filters, and editing from popups.
- Route shape editor: draw, drag, insert and delete points, with undo and reset.
- Trip comparison of up to 5 trips in a table or a service diagram.
- Route export with shape change detection and comparison mini-maps.
- Import file recommendations within the browser's memory budget.

### Changed

- All map zoom comes from the DuckDB `fit_zoom` macro.
- Large feeds load one shape per route, downsampled, and route shapes load per selected route.

## 2026-05-01

Pull request: [#12](https://github.com/gabrielAHN/gtfs-viz/pull/12)

### Added

- Stop popups: stop info opens the map on the stop with its popup open.
- New platforms in Export open the pathway flow with the station selected.
- The stops section of Export turns on when a new platform is added.

### Changed

- Code-split web build: the flow editor and the export page load lazily, cutting the main bundle from 1,036 kB to 449 kB.
- The GTFS SQL becomes a DuckDB extension package shared by the web app.
- The Railway deploy builds only the SQL package and the web app, on Node 22.12.

### Security

- Web editing functions format SQL values instead of interpolating raw strings.

## 2026-04-03

Pull request: [#8](https://github.com/gabrielAHN/gtfs-viz/pull/8)

### Added

- Pathways Flow with nested Column and Radial views.
- Rebuilt pathways editor with shared node, edge and orphan selection popups.
- Inline pathway connection forms, including orphan connection repair from the flow canvas.
- From Nodes and To Nodes filters across Pathways Flow, Map and Table.
- Export of pathway edits and new connections.

### Changed

- Stable canvas placement and viewport during flow edits.
- Pathways Table separates timed and untimed connections, filters by wheelchair access and deep-links to the flow.
- Pathways Map filtering follows the pathway graph through intermediate nodes.

## 2026-02-19

Pull request: [#7](https://github.com/gabrielAHN/gtfs-viz/pull/7)

### Added

- Station and stop maps on DuckDB-WASM, pathway visualization and station editing.
- Export of edited GTFS files.
- Editing with form validation, and pathfinding between station parts.
- TanStack Router with file-based routing.
- Docker deployment with Caddy, configured for Railway.

## 2024-02-16

### Added
- **Station/Stop Type Management**
  - Upgrade stops to stations with type validation
  - Downgrade stations to stops with automatic child handling
  - Coordinate validation (lat/lon required for all operations)
  - Parent-child management (automatically detach children during downgrade)
  - Auto-navigation after upgrade/downgrade operations

- **Enhanced Export System**
  - Visual change indicators (🆕 New, 🗑️ Deleted, 🔻 Downgraded, 🔗 Detached)
  - Inline original value comparison when clicking rows
  - Detect station downgrades with affected parts count
  - Show detached parts when parent station is downgraded
  - Parent station column added to export table
  - Navigate from export to source item in map/table view
  - Highlight changed fields in yellow for easy comparison

- **Stops Route Filtering**
  - Filter stops route to only show "Stop" and "Unknown/Null" types
  - Exclude stations, platforms, and entrances from stops view
  - Consistent filtering across all dropdowns and data views

- **Form UX Improvements**
  - Disable all form inputs during async operations
  - Visual feedback during mutations
  - Prevent user input conflicts during data modifications

### Fixed
- **GTFS Import Errors**
  - Handle CSV files missing optional columns (parent_station, location_type, wheelchair_boarding)
  - Add ALTER TABLE statements to create missing columns with defaults
  - Restructure SQL with CTE pattern to avoid column reference errors
  - Validate CSV structure before import

- **Data Integrity**
  - NOT NULL constraint errors by validating coordinates before operations
  - Parent station handling during downgrades (set to null)
  - Proper status tracking for all edit operations

### Changed
- **Code Quality**
  - Removed comments from 184 files across codebase
  - Self-documenting code with clear naming
  - Kept only essential keywords (IMPORTANT, WARNING, NOTE) in lib/extensions

- **Infrastructure**
  - Migrated to TanStack Router for type-safe routing
  - Reorganized hooks from src/hooks/DuckdbCalls to src/lib/duckdb
  - Updated build configuration (Vite, TypeScript)
  - Simplified Railway deployment (consolidated into railpack.json)
  - Added health check endpoint (/health) with 100s timeout
  - Added restart policy (ON_FAILURE, max 3 retries)

- **Documentation**
  - Updated README with project description and features
  - Added tech stack documentation
  - Created streamlined DEPLOYMENT.md (65 lines)
  - Added deployment workflow explanation

### Deployment
- Railway deployment simplified with single railpack.json configuration
- Health checks enabled for monitoring
- Asset optimization with long-term caching
- Security headers configured (XSS, clickjacking protection)
- Gzip compression enabled

## 2024-01-15

### Added
- GitHub funding configuration
- Community support setup for open source contributions
- Sponsorship options enabled

## 2023-12-01

### Added
- Complete application rewrite with modern stack
- Browser-based GTFS file processing with DuckDB WASM
- Interactive map visualization with Deck.gl
- Dual view (table and map) for stations and stops
- Station component management (entrances, exits, platforms, pathways)
- Pathway visualization and pathfinding
- Edit stations and stops with form interface
- Export edited data back to GTFS format

### Technology Stack
- React + TypeScript
- DuckDB WASM for in-browser SQL database
- Deck.gl for WebGL-powered mapping
- TanStack Query for data management
- Shadcn UI components

## 2023-06-01

### Added
- Initial release of GTFS Viz
- Basic GTFS visualization features
