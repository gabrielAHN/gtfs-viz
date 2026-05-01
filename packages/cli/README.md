# @gabrielahn/gtfs-viz-cli

Visualize, analyze, and edit GTFS transit data with a local DuckDB database and browser dashboard.

[![npm](https://img.shields.io/npm/v/@gabrielahn/gtfs-viz-cli)](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)
[![GitHub](https://img.shields.io/badge/GitHub-gabrielAHN%2Fgtfs--viz-181717?logo=github)](https://github.com/gabrielAHN/gtfs-viz)

**[GitHub](https://github.com/gabrielAHN/gtfs-viz)** | **[Web App](https://gtfs-viz-production-f1a4.up.railway.app)** | **[DuckDB Extension](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/procedures/gtfs)** | **[Agent Skills](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/cli/skills/gtfs-viz)**

## Features

- Import GTFS zips — all data stored locally in DuckDB, no backend required
- Browse stations, stops, and pathways with filters
- Edit stations, stops, and pathway connections with live preview
- Pathfinding between station parts with traversal times
- Export edited data back to GTFS CSV format
- Browser dashboard with interactive maps, tables, and flow editor
- DuckDB SQL extension loadable from any DuckDB instance
- AI agent skills for coding assistants

## Install

```bash
npm install -g @gabrielahn/gtfs-viz-cli
```

Requires [DuckDB CLI](https://duckdb.org/docs/installation) (`duckdb` on PATH or `DUCKDB_BIN`).

## Quick Start

```bash
gtfs-viz import /path/to/feed.zip     # Import GTFS zip
gtfs-viz stations --name "Park"       # Filter stations
gtfs-viz station "Park Street"        # Open dashboard
gtfs-viz station "Park Street" --data # Print data in terminal
gtfs-viz examples                     # See all commands
```

## Commands

| Command | Description |
| --- | --- |
| `import <feed.zip>` | Import GTFS zip into local DuckDB |
| `stations [--name --pathways --wheelchair]` | Browse stations with filters |
| `stops [--name --location-type --wheelchair]` | Browse stops with filters |
| `station <name\|id>` | Station info (dashboard or `--data`) |
| `stop-info <name\|id>` | Stop map with popup (dashboard or `--data`) |
| `station_connections <name\|id>` | Connection flow graph |
| `station_pathways <name\|id>` | Station parts and pathways |
| `station_routes <name\|id>` | Timed routes between parts |
| `station_shortest_route <name\|id>` | Fastest entrance-to-exit route |
| `add_connection / update_connection / delete_connection` | Edit pathways |
| `add_node / update_node / delete_node` | Edit stops |
| `export [--output --no-stops --no-pathways]` | Export edited GTFS as CSV |
| `query --sql <sql>` | Run SQL |
| `edit_table [pathways\|stops]` | View pending edits |
| `stop` | Stop dashboard session and clear session state |
| `restart` | Stop session and remove local DuckDB/feed import |
| `examples` | Show usage examples |
| `clean` | Remove all local data |

Add `--data` for terminal output, `--format json` for JSON, `--dashboard` for browser.

## DuckDB Extension

Load the same SQL procedures used by the CLI and web app into any DuckDB instance:

```sql
.read 'https://raw.githubusercontent.com/gabrielAHN/gtfs-viz/main/packages/procedures/gtfs/gtfs.sql'
```

## Agent Skills

Install reference docs for AI coding agents (Claude Code, Cursor, etc.):

```bash
gtfs-viz install-skill
```

Installs: [SKILL.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/SKILL.md) | [commands.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/commands.md) | [tables.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/tables.md) | [procedures.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/procedures.md) | [gtfs-schedule-reference.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/gtfs-schedule-reference.md) | [examples.sql](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/examples.sql)
