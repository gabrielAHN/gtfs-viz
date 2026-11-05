# Changelog

All notable changes to GTFS Viz will be documented in this file.

## [1.6.0] - 2026-11-04

### Changed
- The CLI moves to [gabrielAHN/gtfs-tools](https://github.com/gabrielAHN/gtfs-tools) and is published from there as `@gabrielahn/gtfs-tools` (command `gtfs-tools`). `@gabrielahn/gtfs-viz-cli` (command `gtfs-viz`) still installs the same CLI, on the same `~/.gtfs-viz-cli` data. This repository keeps the web app, the docs and `@gtfs-viz/duckdb-client`, and no longer publishes to npm.
- The docs gain a GTFS Tools CLI part. The CLI page moves to `/docs/gtfs-tools/cli/` (the old `/docs/gtfs-viz/cli/` still opens it), and `/docs/agents/` describes the `gtfs-tools` agent skill (`npx skills add gabrielAHN/gtfs-tools`).
- The browser import limit prompt and import errors point to the gtfs-tools CLI for full imports. The app links to the public docs site, so the CLI page and Docs links also open the docs from the CLI dashboard.

### Added
- Each release attaches `gtfs-viz-dashboard.tar.gz` and `gtfs-viz-dashboard.tar.gz.sha256`: the CLI-mode web app as a reproducible gzip ustar archive under `dashboard/`, with `dashboard/dashboard-manifest.json` (`name`, `version`, `commit`, `cliApi: 1`). gtfs-tools bundles a pinned, checksum-verified copy, so its dashboard works offline. `yarn build:dashboard` builds it locally.
- A `dashboard-latest` pre-release is rebuilt from every push to `main`, for development.

### Moved to gtfs-tools
- The CLI work from PR #24 ships in [gtfs-tools 1.6.0](https://github.com/gabrielAHN/gtfs-tools/releases/tag/v1.6.0) instead: `import` from `http(s)://` URLs and `s3://`, `s3a://`, `s3n://` and `r2://` objects with bucket access through DuckDB secrets, the community repository as the default `gtfs` source, DuckDB run without `AI_AGENT`, and the credential, query-string and terminal-text hardening of displayed sources. See [gabrielAHN/gtfs-tools](https://github.com/gabrielAHN/gtfs-tools).

### Build notes
- The extension integration job in CI runs on the DuckDB v2.0.0 CLI. Its native harness now drives `@gtfs-viz/duckdb-client` with the DuckDB CLI directly.
- CI packages the dashboard on every pull request, checks that two runs give identical bytes and checks the `.sha256` line.
- The release workflow builds and packages the dashboard in read-only jobs whose checkout keeps no token, and uploads the two assets from separate `contents: write` jobs that install nothing.

## [1.5.4] - 2026-09-29

### Changed
- Load the separate [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) extension instead of bundling the SQL toolbox; `@gtfs-viz/duckdb-client` installs and loads it, and rendering lives in `@gtfs-viz/lib`.
- Import feeds in the web app and the CLI with the extension's `gtfs_import` pragma.
- Serve the app, the docs at `/docs/` and the GTFS DuckDB browser build at `/extensions/` from one deployment.

### Added
- GTFS Tools docs with project pages, the function reference, agent skill categories, releases and upcoming features, each page also as markdown.
- Share the light or dark theme between the app and the docs.

### Fixed
- Reopen a browser session by loading the extension instead of rebuilding the dataset.
- Opening the stations table before selecting a row no longer crashes.

### Build notes
- Use Node 22.
- `yarn install --frozen-lockfile --ignore-engines`, then `yarn build`, `yarn test` and `yarn run check`.
- `yarn preview:deploy` runs the deploy build locally.
- The CLI needs `GTFS_EXTENSION_REPOSITORY` pointing at a repository with a signed `gtfs` build.

## [1.5.3] - 2026-09-15

### Added
- Render overlapping routes as parallel bands, with stable lane assignment through shared corridors.
- Render compared trips in lanes using their GTFS shape geometry, with a stop-to-stop fallback.
- Build route bands on demand with the DuckDB corridor macros and the CLI `route-bands` command.
- Ship the reusable deck.gl route-shape layer from `@gtfs-viz/lib/deckgl`.

### Changed
- Reduce corridor-processing time and peak memory, shrink persisted band data, defer route cleanup from import, and improve large-feed loading with persistent storage and controlled in-memory fallback.

### Fixed
- Harden release behavior around CLI-hosted spatial SQL, atomic route-band rebuilds, and safe package installation.

### Build notes
- Use Node 22.
- Install dependencies with `yarn install --frozen-lockfile --ignore-engines`.
- Build all packages with `yarn build`.
- Run package checks with `yarn run check`.
- Run the focused CLI tests:

  ```sh
  node --test \
    packages/cli/tests/route-bands.test.mjs \
    packages/cli/tests/route-bands.integration.test.mjs \
    packages/cli/tests/postinstall.test.mjs \
    packages/cli/tests/runner.test.mjs \
    packages/cli/tests/spatial-http.integration.test.mjs
  ```

- Corridor and DuckDB profile tests live in the [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) repository.
- Run all route renderer and native bridge tests:

  ```sh
  node --test \
    packages/web/tests/route-fan.test.mjs \
    packages/web/tests/route-render.test.mjs \
    packages/web/tests/native-route-bands.test.mjs
  ```

- Native test harnesses require the DuckDB CLI with the spatial extension installed.
- Verify npm packaging with `npm publish ./packages/cli --dry-run --tag latest`; the explicit tag is required because npm contains an older untagged `2.0.0`, while `latest` remains on the supported `1.5.x` line.

## [2.2.0] - 2024-02-16

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

## [2.1.0] - 2024-01-15

### Added
- GitHub funding configuration
- Community support setup for open source contributions
- Sponsorship options enabled

## [2.0.0] - 2023-12-01

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

## [1.0.0] - 2023-06-01

### Added
- Initial release of GTFS Viz
- Basic GTFS visualization features
