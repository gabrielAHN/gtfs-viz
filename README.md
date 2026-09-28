# GTFS Viz

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)
[![npm](https://img.shields.io/npm/v/@gabrielahn/gtfs-viz-cli)](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)

Lightweight GTFS data visualizer and editor. Import, browse, edit, and export transit feeds — runs entirely client-side with DuckDB.

![GTFS Viz Demo](images/gtfs-viz.gif)

## Features

- Import GTFS zips or load example datasets — no backend, no uploads
- Browse stations, stops, routes, and pathways on interactive maps and tables
- Edit stations, stops, routes, and pathway connections with live preview
- Draw and edit route shapes with drag-to-move points
- Compare trip schedules side-by-side across services
- Pathfinding between station parts with traversal times
- Export edited data back to GTFS CSV format
- CLI with local DuckDB database and browser dashboard

## Quick Start

### Web App

Visit [gtfs-viz-production-f1a4.up.railway.app](https://gtfs-viz-production-f1a4.up.railway.app) or run locally:

```bash
yarn install --ignore-engines && yarn dev
```

### CLI

![GTFS Viz CLI Demo](images/cli.gif)

```bash
npm install -g @gabrielahn/gtfs-viz-cli
gtfs-viz import /path/to/feed.zip
gtfs-viz stations --name "Park"
gtfs-viz routes --type Bus
gtfs-viz station "Park Street"
gtfs-viz examples                    # See all commands
```

#### Test the CLI locally (development)

```bash
yarn install --ignore-engines
yarn cli:install-local               # Build all packages and install CLI globally
gtfs-viz --help
```

Or use `yarn cli:link` to symlink instead of install. To run without installing:

```bash
yarn build
yarn cli import /path/to/feed.zip    # Uses node packages/cli/dist/index.js
```

### DuckDB Extension

The CLI and web app use the GTFS DuckDB extension for all station analysis, pathway queries, and pathfinding. See the [extension docs](packages/duckdb-extension#readme) for standalone usage.

Downloaded-extension migration is opt-in: configure `GTFS_EXTENSION_REPOSITORY` for native CLI imports or `VITE_GTFS_EXTENSION_REPOSITORY` before serving/building the browser app. Unconfigured consumers temporarily retain embedded SQL; configured failures never fall back. Signed distribution is not available from this work. See [configuration, lifecycle, selective-import limitations, and verification](packages/duckdb-extension/docs/downloaded-consumers.md).

## Project Structure

```
packages/
  duckdb-extension/ DuckDB extension (C++ native + TypeScript API + SQL)
  lib/              Rendering layers and visual adapters (no DuckDB dependency)
  web/              React web application (DuckDB WASM, Deck.gl, TanStack)
  cli/              CLI tool (npm: @gabrielahn/gtfs-viz-cli)
```

## Development

```bash
yarn install --ignore-engines
yarn build              # Build all (extension -> lib -> web -> cli)
yarn dev                # Web dev server at localhost:5173
yarn build:extension    # Build DuckDB extension TS layer
yarn build:lib          # Build standalone rendering library
yarn build:cli          # Build CLI only
yarn run check          # Check all packages
yarn test               # SQL corridor, rendering, and import-boundary regressions
```

## Deploy

Railway via [railpack.json](railpack.json): `yarn build` outputs to `dist/`, served by Caddy as SPA.

## Links

- [CLI on npm](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)
- [CLI docs](packages/cli#readme)
- [DuckDB extension](packages/duckdb-extension#readme)
- [Agent skills](packages/cli/skills/gtfs-viz)
