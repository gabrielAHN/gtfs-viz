# gtfs-viz-cli

CLI for importing, querying, editing, and visualizing GTFS transit data with DuckDB.

**[Source code](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/cli)** | **[GTFS Extension (SQL)](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/procedures/gtfs)** | **[Web App](https://github.com/gabrielAHN/gtfs-viz)**

## Install

### From npm

```bash
npm install -g @gabrielahn/gtfs-viz-cli
```

### From source (local)

```bash
git clone https://github.com/gabrielAHN/gtfs-viz.git
cd gtfs-viz
yarn install --ignore-engines
yarn build
npm install -g ./packages/cli
```

During installation you'll be prompted to install agent skills for Claude Code or other AI coding tools.

**Requirements:** [DuckDB CLI](https://duckdb.org/docs/installation) installed as `duckdb` (or set `DUCKDB_BIN`).

## Quick Start

```bash
gtfs-viz import /path/to/feed.zip
gtfs-viz status
gtfs-viz stations
gtfs-viz station "Park Street"
gtfs-viz station_pathways "Park Street" --data
```

## Commands

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
| `edit_pathway <name\|id>`           | Open pathway edit form                          |
| `edit_stop <name\|id>`              | Open stop/node edit form                        |
| `edit_table [pathways\|stops]`      | Show edit table contents                        |
| `add_connection`                    | Add a pathway connection                        |
| `update_connection`                 | Update a pathway connection                     |
| `delete_connection`                 | Delete a pathway connection                     |
| `add_node`                          | Add a stop/station part                         |
| `update_node`                       | Update a stop/station part                      |
| `delete_node`                       | Delete a stop/station part                      |
| `query --sql <sql>`                 | Run SQL against the dataset                     |
| `query --name <name> --data`        | Run a named query                               |
| `view`                              | Open dashboard view                             |
| `stop`                              | Stop background session                         |
| `install-skill`                     | Install AI agent skills                         |

Add `--data` to print rows instead of opening the dashboard. Add `--format json` for JSON output.

## Data Editing

```bash
gtfs-viz add_connection --from node-a --to node-b --traversal-time 45 --bidirectional
gtfs-viz update_connection --pathway-id pathway-123 --traversal-time 60
gtfs-viz delete_connection --pathway-id pathway-123
gtfs-viz add_node --stop-id door-new --lat 42.35 --lon -71.06 --location-type "Exit/Entrance" --parent-station place-pktrm
gtfs-viz update_node --stop-id door-new --stop-name "Main Entrance"
gtfs-viz delete_node --stop-id door-new
gtfs-viz edit_table
```

## SQL Queries

```bash
gtfs-viz query --sql "SELECT * FROM StationsTable"
gtfs-viz query --sql "SELECT * FROM get_station_stops('place-pktrm')"
gtfs-viz query --name station-info --args-json '{"stationId":"place-pktrm"}' --data
```

See the [GTFS extension SQL reference](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/procedures/gtfs) for all available tables and macros.

## DuckDB Extension

The GTFS SQL extension can be loaded directly into any DuckDB instance:

```sql
.read 'https://raw.githubusercontent.com/gabrielAHN/gtfs-viz/main/packages/procedures/gtfs/gtfs.sql'
```

Extension source: [`packages/procedures/gtfs/`](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/procedures/gtfs)

## Agent Skills

Install skills for AI coding agents:

```bash
gtfs-viz install-skill                  # Interactive prompt
gtfs-viz install-skill --agent claude   # Claude Code
gtfs-viz install-skill --agent codex    # Codex
gtfs-viz install-skill --agent opencode # OpenCode
```

The skill folder includes reference docs that agents use to construct commands and SQL:

| File | Description | Source |
| --- | --- | --- |
| [SKILL.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/SKILL.md) | Main skill instructions | [View](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/SKILL.md) |
| [commands.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/commands.md) | CLI command reference | [View](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/commands.md) |
| [tables.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/tables.md) | Table & view schemas | [View](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/tables.md) |
| [procedures.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/procedures.md) | SQL macros & named queries | [View](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/procedures.md) |
| [examples.sql](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/examples.sql) | SQL query examples | [View](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/examples.sql) |

## Links

- [GTFS Viz Web App](https://github.com/gabrielAHN/gtfs-viz)
- [GTFS DuckDB Extension](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/procedures)
- [CLI Source](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/cli)
- [Skills Folder](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/cli/skills/gtfs-viz)
- [npm package](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)
