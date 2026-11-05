# GTFS Viz

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)

Lightweight GTFS data visualizer and editor. Import, browse, edit, and export transit feeds — runs entirely client-side with DuckDB.

This repository holds the web app, the docs site and `@gtfs-viz/duckdb-client`. The CLI lives in [gabrielAHN/gtfs-tools](https://github.com/gabrielAHN/gtfs-tools) (`npm install -g @gabrielahn/gtfs-tools`) and opens this web app as its dashboard.

**Docs:** [gtfs-viz-production-f1a4.up.railway.app/docs](https://gtfs-viz-production-f1a4.up.railway.app/docs/) — web app, the [gtfs-tools CLI](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-tools/cli/), the [agent skill](https://gtfs-viz-production-f1a4.up.railway.app/docs/agents/), the GTFS DuckDB function reference and [upcoming features](https://gtfs-viz-production-f1a4.up.railway.app/docs/upcoming/). Every page is also available as markdown ([llms.txt](https://gtfs-viz-production-f1a4.up.railway.app/docs/llms.txt)).

![GTFS Viz Demo](images/gtfs-viz.gif)

## Features

- Import GTFS zips or load example datasets — no backend, no uploads
- Browse stations, stops, routes, and pathways on interactive maps and tables
- Edit stations, stops, routes, and pathway connections with live preview
- Draw and edit route shapes with drag-to-move points
- Compare trip schedules side-by-side across services
- Pathfinding between station parts with traversal times
- Export edited data back to GTFS CSV format
- Dashboard for the [gtfs-tools](https://github.com/gabrielAHN/gtfs-tools) CLI, published with every release

## Quick Start

### Web App

Visit [gtfs-viz-production-f1a4.up.railway.app](https://gtfs-viz-production-f1a4.up.railway.app) or run locally:

```bash
yarn install --ignore-engines && yarn dev
```

### CLI

The CLI moved to [gabrielAHN/gtfs-tools](https://github.com/gabrielAHN/gtfs-tools). It imports a feed into native DuckDB, queries, edits and exports it, and opens this web app on it as a dashboard. See the [CLI docs](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-tools/cli/).

```bash
npm install -g @gabrielahn/gtfs-tools
gtfs-tools import /path/to/feed.zip
gtfs-tools stations --name "Park"
```

### Dashboard release asset

Each GTFS Viz release `v<version>` attaches `gtfs-viz-dashboard.tar.gz` and `gtfs-viz-dashboard.tar.gz.sha256`: the web app built for CLI mode, with `dashboard/dashboard-manifest.json` (`name`, `version`, `commit`, `cliApi: 1`). gtfs-tools bundles a pinned, checksum-verified copy so its dashboard works offline. The `dashboard-latest` pre-release is rebuilt from every push to `main` for development. Build it locally with:

```bash
yarn build:dashboard     # dist-dashboard/gtfs-viz-dashboard.tar.gz and .sha256
```

The archive is reproducible: the same build gives the same bytes ([scripts/package-dashboard.mjs](scripts/package-dashboard.mjs)).

### DuckDB Extension

Database functions come from the separate [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) extension, which the web app downloads and loads (`INSTALL gtfs FROM <repository>; LOAD gtfs;`). The web app installs from `VITE_GTFS_EXTENSION_REPOSITORY`; without it, the browser needs an already-loaded compatible extension. In CLI mode the dashboard takes the repository from the CLI's `/dataset` response (`community` or an HTTP(S) URL). The web app links to the docs at `/docs/` (override with `VITE_GTFS_DOCS_URL`); the CLI dashboard never shows the link. See [configuration](packages/duckdb-client/README.md).

## Project Structure

```
packages/
  duckdb-client/     Thin extension client and raw-file transport
  lib/              Rendering layers and visual adapters (no DuckDB dependency)
  web/              React web application (DuckDB WASM, Deck.gl, TanStack); also the CLI dashboard
  docs/             Documentation site served at /docs/ (see packages/docs/README.md)
scripts/
  package-dashboard.mjs   Packs packages/web/dist into the dashboard release asset
```

## Development

```bash
yarn install --ignore-engines
yarn build              # Build all (client -> lib -> web -> docs)
yarn dev                # Web app at localhost:5173, docs at localhost:5173/docs/
yarn dev:docs           # Docs alone at localhost:4391/docs/
yarn build:client       # Build the thin extension client
yarn build:lib          # Build standalone rendering library
yarn build:dashboard    # CLI-mode web build packed into dist-dashboard/ (release asset)
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
- [gtfs-tools CLI](https://github.com/gabrielAHN/gtfs-tools) ([npm](https://www.npmjs.com/package/@gabrielahn/gtfs-tools), [docs](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-tools/cli/))
- [Agent skill](https://gtfs-viz-production-f1a4.up.railway.app/docs/agents/) (`npx skills add gabrielAHN/gtfs-tools`)
- [DuckDB extension client](packages/duckdb-client#readme)
