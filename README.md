# GTFS Viz

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)
[![npm](https://img.shields.io/npm/v/@gabrielahn/gtfs-viz-cli)](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)

Lightweight GTFS data visualizer and editor. Import, browse, edit, and export transit feeds — runs entirely client-side with DuckDB.

**Docs:** [gtfs-viz-production-f1a4.up.railway.app/docs](https://gtfs-viz-production-f1a4.up.railway.app/docs/) — web app, CLI, agent skill, the GTFS DuckDB function reference and [upcoming features](https://gtfs-viz-production-f1a4.up.railway.app/docs/upcoming/). Every page is also available as markdown ([llms.txt](https://gtfs-viz-production-f1a4.up.railway.app/docs/llms.txt)).

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

Database functions come from the separate [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) extension, which the web app and CLI download and load (`INSTALL gtfs FROM <repository>; LOAD gtfs;`). Configure `GTFS_EXTENSION_REPOSITORY` for the CLI or `VITE_GTFS_EXTENSION_REPOSITORY` for the web app. The web app links to the docs at `/docs/` (override with `VITE_GTFS_DOCS_URL`); the CLI dashboard never shows the link. Without configuration, an already-installed compatible extension is required. See [configuration](packages/duckdb-client/README.md).

## Project Structure

```
packages/
  duckdb-client/     Thin extension client and raw-file transport
  lib/              Rendering layers and visual adapters (no DuckDB dependency)
  web/              React web application (DuckDB WASM, Deck.gl, TanStack)
  cli/              CLI tool (npm: @gabrielahn/gtfs-viz-cli)
  docs/             Documentation site served at /docs/ (see packages/docs/README.md)
```

## Development

```bash
yarn install --ignore-engines
yarn build              # Build all (client -> lib -> web -> docs -> cli)
yarn dev                # Web app at localhost:5173, docs at localhost:5173/docs/
yarn dev:docs           # Docs alone at localhost:4391/docs/
yarn build:client       # Build the thin extension client
yarn build:lib          # Build standalone rendering library
yarn build:cli          # Build CLI only
yarn run check          # Check all packages
yarn test               # Consumer, rendering, and source/bundle boundary regressions
```

## Deploy

Railway runs `yarn build:deploy` ([railpack.json](railpack.json)) and serves `dist/` with the [Caddyfile](Caddyfile) as one service:

| Path | Content |
| --- | --- |
| `/` | Web app |
| `/docs/` | Docs |
| `/extensions/` | GTFS DuckDB browser build from the extension repo's `main` |

`build:deploy` downloads the `main-latest` release of [gtfs-duckdb](https://github.com/gabrielAHN/gtfs-duckdb/releases/tag/main-latest), which its CI republishes on every push to `main`, verifies the checksums and copies the WASM files into `dist/extensions/`. That build is unsigned, so the deploy build enables unsigned extension loading in the browser. Set `GTFS_EXTENSION_SOURCE` to a URL, an archive or an extension checkout to use another build. Redeploy after the extension's `main` changes.

Run the same build locally:

```bash
yarn preview:deploy                                   # app, docs and ../gtfs-duckdb at localhost:4000
yarn preview:deploy --port 4391                       # same build on another port
yarn preview:deploy --extension <url|archive|repo>    # another extension build
yarn preview:deploy --skip-build                      # only refresh the extension files after rebuilding it
```

Requires `caddy`. With a local checkout, build the extension's WASM first (`scripts/build-wasm.sh`).

## Links

- [Docs](https://gtfs-viz-production-f1a4.up.railway.app/docs/)
- [CLI on npm](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)
- [CLI docs](packages/cli#readme)
- [DuckDB extension](packages/duckdb-client#readme)
- [Agent skills](packages/cli/skills/gtfs-viz)
