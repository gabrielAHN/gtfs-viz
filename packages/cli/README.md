# @gabrielahn/gtfs-viz-cli

Lightweight GTFS data visualizer and editor. Browse, edit, and export transit feeds from the terminal with a local DuckDB database and browser dashboard.

[![npm](https://img.shields.io/npm/v/@gabrielahn/gtfs-viz-cli)](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)
[![GitHub](https://img.shields.io/badge/GitHub-gabrielAHN%2Fgtfs--viz-181717?logo=github)](https://github.com/gabrielAHN/gtfs-viz)

**[GitHub](https://github.com/gabrielAHN/gtfs-viz)** | **[Web App](https://gtfs-viz-production-f1a4.up.railway.app)** | **[DuckDB Extension](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/duckdb-extension)** | **[Agent Skills](https://github.com/gabrielAHN/gtfs-viz/tree/main/packages/cli/skills/gtfs-viz)**

## Features

- Import GTFS zips — data stored locally in DuckDB
- Browse stations, stops, routes, and pathways with filters
- Edit stations, stops, routes, and pathway connections
- Compare trip schedules and route shapes
- Export edited data back to GTFS CSV
- Browser dashboard with maps, tables, and flow editor
- AI agent skills for coding assistants

## Install

```bash
npm install -g @gabrielahn/gtfs-viz-cli
```

Requires [DuckDB CLI](https://duckdb.org/docs/installation) (`duckdb` on PATH or `DUCKDB_BIN`).

DuckDB sessions use a reduced worker count, a host-aware memory limit capped at 4 GB, disabled
insertion-order preservation, and a persistent spill directory beside the imported database. The
defaults can be overridden with `GTFS_VIZ_DUCKDB_THREADS`, `GTFS_VIZ_DUCKDB_MEMORY_LIMIT`, and
`GTFS_VIZ_DUCKDB_TEMP_DIRECTORY`.

## Quick Start

```bash
gtfs-viz import /path/to/feed.zip     # Import GTFS zip
gtfs-viz stations --name "Park"       # Filter stations
gtfs-viz routes --type Bus            # Filter routes
gtfs-viz station "Park Street"        # Open dashboard
gtfs-viz route "Red Line"             # Route info dashboard
gtfs-viz station "Park Street" --data # Print data in terminal
gtfs-viz examples                     # See all commands
```

## Commands

| Command | Description |
| --- | --- |
| `import <feed.zip>` | Import GTFS zip into local DuckDB |
| `stations [--name --pathways --wheelchair]` | Browse stations with filters |
| `stops [--name --location-type --wheelchair]` | Browse stops with filters |
| `routes [--route-id --route-name --type]` | Browse routes with filters |
| `station <name\|id>` | Station info (dashboard or `--data`) |
| `stop-info <name\|id>` | Stop map with popup (dashboard or `--data`) |
| `route <name\|id>` | Route info (dashboard or `--data`) |
| `station_connections <name\|id>` | Connection flow graph |
| `station_pathways <name\|id>` | Station parts and pathways |
| `station_routes <name\|id>` | Timed routes between parts |
| `station_shortest_route <name\|id>` | Fastest entrance-to-exit route |
| `add_connection / update_connection / delete_connection` | Edit pathways |
| `add_node / update_node / delete_node` | Edit stops |
| `export [--output --no-stops --no-pathways --no-routes]` | Export edited GTFS as CSV |
| `query --sql <sql>` | Run SQL |
| `edit_table [pathways\|stops\|routes]` | View pending edits |
| `edits [--trip --view --url-only]` | Review categories or open Edits & Export |
| `reroute --trip --via --from --to` | Replace a trip section using donor stops |
| `stop` | Stop dashboard session and clear session state |
| `restart` | Stop session and remove local DuckDB/feed import |
| `examples` | Show usage examples |
| `clean` | Remove all local data |
| `install-skill [provider]` | Install the bundled skill for an AI provider |
| `version`, `-v`, `--version` | Show the installed CLI version |
| `update [--check]` | Update the CLI to the latest npm release |

Output modes: no flags opens the dashboard. `--data` for terminal table, `--format json` for JSON, `--url` to open dashboard and print URL, `--url-only` to print URL without opening, `--view <view>` to pick a specific page (e.g. `--view map`).

Direct review links:

```bash
gtfs-viz edits --url-only
gtfs-viz edits --trip TRIP_ID --compare-view map --url-only
gtfs-viz edits --view table --trips-page 3 --trips-page-size 20 --url-only
```

## Local Development

To test the CLI from the monorepo without publishing:

```bash
# From the repo root:
yarn install --ignore-engines
yarn cli:install-local          # Build all packages, install CLI globally
gtfs-viz --help

# Or symlink instead of install:
yarn cli:link
gtfs-viz --help

# Or run without installing:
yarn build
yarn cli import /path/to/feed.zip
yarn cli stations
```

## DuckDB Extension

The CLI uses the same GTFS DuckDB extension as the web app. See the [extension docs](../duckdb-extension#readme) for the full macro reference.

## Version and Updates

```bash
gtfs-viz --version
gtfs-viz update --check
gtfs-viz update
gtfs-viz update --provider openai
```

`update` checks npm and installs the latest global `@gabrielahn/gtfs-viz-cli` release. It preserves the imported GTFS dataset and session files. Add `--provider` to refresh that provider skill after updating.

## Agent Skills

Install the bundled skill using the AI provider name:

```bash
gtfs-viz install-skill openai
gtfs-viz install-skill anthropic
gtfs-viz install-skill google
gtfs-viz install-skill generic
gtfs-viz h install-skill
```

The equivalent flag form is `gtfs-viz install-skill --provider openai`. Existing `--agent codex`, `--agent claude`, and `--agent opensource` commands remain supported. Use `--list-providers` to see resolved paths, `--target-dir` to override one, and `--force` to replace an existing installation. Non-interactive use always requires a provider, including with `--target-dir`.

`gtfs-viz h` is the short form of `gtfs-viz help`. Both accept a command, so `gtfs-viz h install-skill`, `gtfs-viz h reroute`, and `gtfs-viz h edits` show the same detailed help as `<command> -h`.

Default locations:

| Provider | Default skill directory |
| --- | --- |
| OpenAI / Codex | `$CODEX_HOME/skills` or `~/.codex/skills` |
| Anthropic / Claude Code | `$CLAUDE_HOME/skills` or `~/.claude/skills` |
| Google / Gemini CLI | `$GEMINI_HOME/skills` or `~/.gemini/skills` |
| Generic Agent Skills | `~/.agents/skills` |

Installs: [SKILL.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/SKILL.md) | [commands.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/references/commands.md) | [tables.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/references/tables.md) | [procedures.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/references/procedures.md) | [gtfs-schedule-reference.md](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/references/gtfs-schedule-reference.md) | [examples.sql](https://github.com/gabrielAHN/gtfs-viz/blob/main/packages/cli/skills/gtfs-viz/references/examples.sql)
