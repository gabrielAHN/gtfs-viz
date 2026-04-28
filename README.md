# GTFS Viz

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/nJ-5yD?referralCode=r6T2Zn)
[![npm](https://img.shields.io/npm/v/@gabrielahn/gtfs-viz-cli)](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)

Browser-based GTFS visualization and editing tool. Process transit data entirely in your browser using DuckDB WASM.

![GTFS Viz Demo](images/gtfs-viz.gif)

## What is GTFS Viz?

GTFS Viz enables transit agencies, developers, and transit enthusiasts to visualize, analyze, and edit GTFS files without backend servers. All data processing happens client-side for privacy and speed.

### Key Features

**Data Management**

- Upload GTFS zip files or load example datasets
- Process large datasets entirely in-browser with DuckDB WASM
- Export edited stops and stations back to GTFS format

**Stations & Stops**

- View in both table and interactive map formats
- See station entrances, exits, platforms, and pathways
- Add, edit, and delete stations and their components
- Upgrade stops to stations or downgrade stations to stops

**Pathways & Navigation**

- Visualize pathway connections within stations
- Calculate routes between different points
- Identify accessible routes and barriers

## Project Structure

```
packages/
  procedures/   @gtfs-viz/procedures  — GTFS DuckDB extension (SQL macros, views, pathfinding)
  web/          @gtfs-viz/web         — React web application
  cli/          gtfs-viz-cli          — Local CLI tool (npm: gtfs-viz-cli)
```

Build order: `procedures -> web -> cli`

## Installation

### CLI (from npm)

```bash
npm install -g @gabrielahn/gtfs-viz-cli
```

Or install from source:

```bash
git clone https://github.com/gabrielAHN/gtfs-viz.git
cd gtfs-viz
yarn install --ignore-engines
yarn build
npm install -g ./packages/cli
```

Then:

```bash
gtfs-viz import /path/to/feed.zip
gtfs-viz status
gtfs-viz stations
gtfs-viz station "Park Street"
```

### Web App (Development)

```bash
yarn install --ignore-engines
yarn build:procedures
yarn dev
```

App runs at `http://localhost:5173`

### DuckDB Extension

The GTFS SQL extension can be loaded into any DuckDB instance:

```sql
-- From the public repo URL
.read 'https://raw.githubusercontent.com/gabrielAHN/gtfs-viz/main/packages/procedures/gtfs/gtfs.sql'
```

This installs all macros, views, tables, and pathfinding procedures. Requires `stops` and `pathways` tables to already exist from a GTFS CSV import.

## CLI Usage

### Import & Query

```bash
gtfs-viz import /path/to/feed.zip
gtfs-viz status
gtfs-viz tables
gtfs-viz stations
gtfs-viz query --sql "SELECT * FROM StationsTable"
gtfs-viz query --name station-info --args-json '{"stationId":"place-pktrm"}' --data
```

### Dashboard

```bash
gtfs-viz station "Park Street"
gtfs-viz station_connections "Park Street"
gtfs-viz station_pathways place-pktrm --node-id node-pktrm-stair7-gl
gtfs-viz station_shortest_route "South Station"
gtfs-viz view --view stations/map
```

### Data Editing

```bash
gtfs-viz add_connection --from node-a --to node-b --traversal-time 45
gtfs-viz update_connection --pathway-id pathway-123 --traversal-time 60
gtfs-viz delete_connection --pathway-id pathway-123
gtfs-viz add_node --stop-id new-door --lat 42.35 --lon -71.06 --location-type "Exit/Entrance" --parent-station place-pktrm
gtfs-viz update_node --stop-id new-door --stop-name "Main Entrance"
gtfs-viz delete_node --stop-id new-door
gtfs-viz edit_table
```

### CLI Commands

| Command                             | Description                                    |
| ----------------------------------- | ---------------------------------------------- |
| `import <feed.zip>`                 | Import GTFS zip into local DuckDB              |
| `status`                            | Show dataset info and session state             |
| `tables`                            | Show available DuckDB tables                    |
| `stations`                          | Show stations table                             |
| `stops`                             | Show standalone stops table                     |
| `station <name\|id>`                | Look up a station                               |
| `stop-info <name\|id>`              | Look up a standalone stop                       |
| `station_connections <name\|id>`    | Show station connection graph                   |
| `station_pathways <name\|id>`       | Show station parts and pathways                 |
| `station_routes <name\|id>`         | Show timed routes between station parts         |
| `station_shortest_route <name\|id>` | Fastest entrance-to-exit route by time          |
| `edit_pathway <name\|id>`           | Open pathway edit form in dashboard             |
| `edit_stop <name\|id>`              | Open stop/node edit form in dashboard           |
| `edit_table [pathways\|stops]`      | Show edit table contents                        |
| `add_connection`                    | Add a pathway connection                        |
| `update_connection`                 | Update a pathway connection                     |
| `delete_connection`                 | Delete a pathway connection                     |
| `add_node`                          | Add a stop/station part                         |
| `update_node`                       | Update a stop/station part                      |
| `delete_node`                       | Delete a stop/station part                      |
| `query --sql <sql>`                 | Run SQL against the dataset                     |
| `query --name <name>`               | Run a named query                               |
| `view`                              | Open dashboard view                             |
| `stop`                              | Stop background session                         |
| `install-skill`                     | Install AI agent skills                         |

Add `--data` to dashboard commands to print rows. Add `--format json` for JSON output.

### Agent Skills

Install skills for AI coding agents:

```bash
gtfs-viz install-skill                  # Interactive prompt
gtfs-viz install-skill --agent claude   # Claude Code
gtfs-viz install-skill --agent codex    # Codex
gtfs-viz install-skill --agent opencode # OpenCode
```

The skill folder includes reference files for table schemas, SQL procedures, and CLI commands.

## Build Scripts

```bash
yarn build              # Build all packages (procedures -> web -> cli)
yarn dev                # Start web dev server
yarn build:procedures   # Build DuckDB extension
yarn build:web          # Build web app
yarn build:cli          # Build CLI
yarn check              # Type-check all packages
yarn cli:install-local  # Build all + global install CLI
```

## Deployment

### Railway

1. Railway uses Railpack via [railway.json](railway.json) and [railpack.json](railpack.json)
2. `yarn install` installs dependencies
3. `yarn build` builds all packages; web output is copied to `dist/`
4. Railway serves the SPA from `dist/` via `RAILPACK_SPA_OUTPUT_DIR=dist`

For static deployment, run `yarn build` and deploy the `dist/` directory.

## Tech Stack

- **DuckDB WASM**: In-browser SQL database
- **Vite+**: Build tooling
- **TanStack Router/Query/Table**: Routing, data fetching, tables
- **Deck.gl**: WebGL map visualization
- **Shadcn UI**: Component library
