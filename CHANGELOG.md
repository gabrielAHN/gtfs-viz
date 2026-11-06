# Changelog

Notable changes to GTFS Viz: the web app, the docs site, `@gtfs-viz/duckdb-client` and `@gtfs-viz/lib`. GTFS Viz has no versions; it deploys from `main`, so each section is the date a change landed. Each section lists its changes under Added, Changed, Removed, Fixed and Security.

[GTFS Tools](https://github.com/gabrielAHN/gtfs-tools) has its own changelog.

## 2026-11-06

### Changed

- The docs' GTFS Tools releases link only to gtfs-tools pull requests and releases, and their highlights are labelled with the gtfs-tools CHANGELOG categories.
- Old GTFS Viz release pages (`/docs/gtfs-viz/releases/…`) open the GTFS Viz page.
- Every section of this changelog uses the same categories.

## 2026-11-05

### Changed

- GTFS Viz has no versions: no `version` in the root, web or docs `package.json`, no release workflow and no tags. It deploys from `main`, and this changelog is dated.
- yarn 1 ignores a workspace without a version, so the web app and the docs are no longer yarn workspaces. Their dependencies move to the root `package.json`, and the root scripts run them. `@gtfs-viz/duckdb-client` and `@gtfs-viz/lib` stay workspaces at version `0.0.0`, which yarn needs to link them.
- `dashboard-manifest.json` is `{name, commit, cliApi: 1}`: the commit identifies the dashboard build, and there is no `version`. CI checks the new shape.
- The docs list the gtfs-tools releases under GTFS Tools. GTFS Viz has no releases page.
- The docs only describe `@gabrielahn/gtfs-tools` and the `gtfs-tools` command.

## 2026-11-04

### Added

- `yarn build:dashboard` builds the web app as the gtfs-tools dashboard into `packages/web/dist` and writes `dashboard-manifest.json` next to it. gtfs-tools runs this build in its submodule, so its dashboard works offline.

### Changed

- This repository keeps the web app, the docs and `@gtfs-viz/duckdb-client`. [gtfs-tools](https://github.com/gabrielAHN/gtfs-tools) has its own repository and builds its dashboard from this one as a git submodule.
- The docs gain GTFS Tools pages and the `gtfs-tools` agent skill install (`npx skills add gabrielAHN/gtfs-tools`); older links open the new pages.
- The browser import limit prompt and import errors point to gtfs-tools for full imports. The app links to the public docs site, so Docs links also work from the gtfs-tools dashboard.
- The extension integration job in CI runs on DuckDB v2.0.0. Its native harness drives `@gtfs-viz/duckdb-client` with DuckDB directly.
- CI runs `yarn build:dashboard` on every pull request and checks its manifest.

## 2026-09-29

### Added

- GTFS Tools docs with project pages, the function reference, agent skill categories, releases and upcoming features, each page also as markdown.
- A Docs button in the header, intro and footer.
- The light or dark theme is shared between the app and the docs.
- `yarn preview:deploy` runs the deploy build locally.

### Changed

- The app loads the separate [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) extension instead of bundling the SQL toolbox; `@gtfs-viz/duckdb-client` installs and loads it, and rendering lives in `@gtfs-viz/lib`.
- The web app imports feeds with the extension's `gtfs_import` pragma.
- One deployment serves the app, the docs at `/docs/` and the GTFS DuckDB browser build at `/extensions/`.
- An unconfigured extension repository shows an actionable error, with no silent fallback.
- GitHub Actions build, check and test every change and run the integration suite against the latest GTFS DuckDB build.

### Fixed

- Reopening a browser session loads the extension instead of rebuilding the dataset.
- Opening the stations table before selecting a row no longer crashes.
- The import page is centered on small screens.

## 2026-09-16

### Added

- Overlapping routes render as parallel bands, with stable lane assignment through shared corridors, and a **Separate Route(s)** map toggle.
- Compared trips render in lanes using their GTFS shape geometry, with a stop-to-stop fallback.
- Route bands are built on demand with the DuckDB corridor macros.
- The reusable deck.gl route-shape layer ships from `@gtfs-viz/lib/deckgl`.

### Changed

- Corridor processing is faster and uses less peak memory, persisted band data is smaller, route cleanup is deferred from import, and large feeds load with persistent storage and a controlled in-memory fallback.
- Builds need Node 22.

## 2026-08-24

### Added

- Trip rerouting: replace a section of a trip with another route's stop pattern between shared boundary stations, with replacement times fitted to the trip.
- Timetable and map previews that highlight possible and completed reroutes.
- Edits & Export review of reroutes, skipped stops, schedule changes, service changes and combined edits, in table and map comparison views, with per-category revert.
- Table pagination is kept in the URL.
- The selected trip and the reroute form state are kept in the URL.

### Changed

- Reroute candidates come from shared DuckDB macros with a five-minute query cache, instead of large web-side queries.
- Browser DuckDB sessions use one thread, a 2 GB memory cap and no insertion-order preservation.
- Applying a reroute uses the shared form-processing overlay and returns to the edited trip.

## 2026-07-22

### Added

- Compare up to 5 trips side by side in timetable, timeline and map views.
- Edit a trip's stop times: add, remove, reorder and retime stops, with undo and redo, in every view.
- Export stop times grouped by service, with a side-by-side diff for each trip.

### Fixed

- "Constructor Map requires 'new'" and react-map-gl `useImperativeHandle` crashes.
- A `useDuckDB` null crash on route pages.
- The edit timetable keeps showing every row after a reorder.

## 2026-06-15

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

### Added

- Station and stop maps on DuckDB-WASM, pathway visualization and station editing.
- Export of edited GTFS files.
- Editing with form validation, and pathfinding between station parts.
- TanStack Router with file-based routing.
- Docker deployment with Caddy, configured for Railway.

## 2024-02-16

### Added

- Upgrade stops to stations and downgrade stations to stops, with type and coordinate validation, automatic detaching of child stops and navigation to the result.
- Export change indicators (new, deleted, downgraded, detached), inline comparison with original values, highlighted changed fields, a parent station column and links back to the edited item.

### Changed

- The stops view shows only stops and stops of unknown type, excluding stations, platforms and entrances.
- Form inputs are disabled while a change is saving.
- Routing uses TanStack Router, the DuckDB hooks move to `src/lib/duckdb`, and the Vite and TypeScript configuration is updated.
- Comments are removed across the codebase, except IMPORTANT, WARNING and NOTE.
- The README describes the project, features and tech stack, and a short DEPLOYMENT.md explains the deploy.
- Railway deploys from one `railpack.json`, with a `/health` check (100 s timeout), restart on failure (up to 3 retries), long-term asset caching, security headers and gzip.

### Fixed

- GTFS imports handle CSV files missing optional columns (`parent_station`, `location_type`, `wheelchair_boarding`) and validate the CSV structure first.
- Edits validate coordinates first, so they no longer fail on NOT NULL constraints; a downgrade clears its children's parent station, and every edit records its status.

## 2024-01-15

### Added

- GitHub funding configuration and sponsorship options.

## 2023-12-01

### Added

- Browser-based GTFS processing with DuckDB-WASM.
- Interactive maps with deck.gl, and table and map views of stations and stops.
- Station parts (entrances, exits, platforms, pathways), pathway visualization and pathfinding.
- Station and stop editing with forms, and export of the edited data as GTFS.

### Changed

- The app is rewritten with React, TypeScript, DuckDB-WASM, deck.gl, TanStack Query and shadcn/ui.

## 2023-06-01

### Added

- First release of GTFS Viz, with basic GTFS visualization.
