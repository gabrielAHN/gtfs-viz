# @gabrielahn/gtfs-viz-cli

Lightweight GTFS data visualizer and editor. Browse, edit, and export transit feeds from the terminal with a local DuckDB database and browser dashboard.

[![npm](https://img.shields.io/npm/v/@gabrielahn/gtfs-viz-cli)](https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli)
[![GitHub](https://img.shields.io/badge/GitHub-gabrielAHN%2Fgtfs--viz-181717?logo=github)](https://github.com/gabrielAHN/gtfs-viz)
[![Docs](https://img.shields.io/badge/docs-gtfs--viz-blue)](https://gtfs-viz-production-f1a4.up.railway.app/docs/)

**[CLI docs](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-viz/cli/)** | **[Web App](https://gtfs-viz-production-f1a4.up.railway.app)** | **[GTFS DuckDB](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-duckdb/)** | **[Function reference](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-duckdb/functions/)** | **[Agent skill](https://gtfs-viz-production-f1a4.up.railway.app/docs/agents/)** | **[Releases](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-viz/releases/)**

## Features

- Import GTFS zips from a local path, an HTTP(S) URL or an S3/R2 bucket — data stored locally in DuckDB
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

Requires the [DuckDB CLI](https://duckdb.org/docs/installation) v2.0.0 (`duckdb` on PATH or `DUCKDB_BIN`); see [Extension prerequisite](#extension-prerequisite).

Installing or updating the CLI preserves imported feeds, the current session database, and other
local data by default. To intentionally clear that data during installation, explicitly opt in:

```bash
GTFS_VIZ_RESET_DATA=1 npm install -g @gabrielahn/gtfs-viz-cli
```

Only the exact value `1` enables this destructive reset.

DuckDB sessions use a reduced worker count, a host-aware memory limit capped at 4 GB, disabled
insertion-order preservation, and a persistent spill directory beside the imported database. The
defaults can be overridden with `GTFS_VIZ_DUCKDB_THREADS`, `GTFS_VIZ_DUCKDB_MEMORY_LIMIT`, and
`GTFS_VIZ_DUCKDB_TEMP_DIRECTORY`.

## Quick Start

```bash
gtfs-viz import /path/to/feed.zip     # Import GTFS zip
gtfs-viz import https://example.com/gtfs/feed.zip  # ...or download one
gtfs-viz import s3://my-bucket/gtfs/feed.zip       # ...or read one from a bucket
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
| `import <feed.zip\|https://…\|s3://…\|r2://…>` | Import a GTFS zip (local path, URL or bucket object) into local DuckDB |
| `stations [--name --pathways --wheelchair]` | Browse stations with filters |
| `stops [--name --location-type --wheelchair]` | Browse stops with filters |
| `routes [--route-id --route-name --type]` | Browse routes with filters |
| `station <name\|id>` | Station info (dashboard or `--data`) |
| `stop-info <name\|id>` | Stop map with popup (dashboard or `--data`) |
| `route <name\|id>` | Route info (dashboard or `--data`) |
| `route-bands [--status]` | Build parallel route-line bands (Separate Route(s)) |
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
| `reroute --trip [--via --from --to]` | Open the reroute form or replace a trip section using donor stops |
| `stop` | Stop dashboard session and clear session state |
| `restart` | Stop session and remove local DuckDB/feed import |
| `examples` | Show usage examples |
| `clean` | Remove all local data |
| `install-skill [provider]` | Install the bundled skill for an AI provider |
| `version`, `-v`, `--version` | Show the installed CLI version |
| `update [--check]` | Update the CLI to the latest npm release |

Output modes: no flags opens the dashboard. `--data` for terminal table, `--format json` for JSON, `--url` to open dashboard and print URL, `--url-only` to print URL without opening, `--view <view>` to pick a specific page (e.g. `--view map`).

## Importing feeds

| Source | Example | How it is read |
| --- | --- | --- |
| Local zip | `gtfs-viz import /path/to/feed.zip` | Copied into the local dataset |
| HTTP(S) URL | `gtfs-viz import https://example.com/gtfs/feed.zip` | Downloaded with Node's `fetch`, following redirects |
| S3 object | `gtfs-viz import s3://my-bucket/gtfs/feed.zip` (also `s3a://`, `s3n://`) | Read by the DuckDB CLI (`httpfs`) |
| R2 object | `gtfs-viz import r2://my-bucket/gtfs/feed.zip` | Read by the DuckDB CLI with an R2 secret |

Remote feeds are downloaded to `~/.gtfs-viz-cli/downloads/` first, must be a zip archive, and are
deleted after the import. Download and validation failures (not a zip, no `stops.txt`) leave the
current dataset untouched; a failure during the DuckDB import itself still clears it, as for local files. The dataset records the source without its query string, fragment or credentials, so a
pre-signed URL's signature is used for the download but never stored or printed. URLs with an
embedded user name or password are refused. Other schemes (`gs://`, `az://`, `hf://`, `ftp://`, …)
are not supported.

### Authentication

`s3://` and `r2://` objects authenticate through [DuckDB secrets](https://duckdb.org/docs/stable/configuration/secrets_manager),
tried in this order:

1. Any DuckDB secret whose scope matches the URL, including persistent secrets you already have:

   ```bash
   duckdb -c "CREATE PERSISTENT SECRET (TYPE s3, KEY_ID 'AKIA…', SECRET '…', REGION 'us-east-1')"
   ```

2. For `s3://`: AWS credentials from environment variables (`AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`), an AWS profile (`AWS_PROFILE`) or
   an SSO login (`aws sso login`), through a temporary `credential_chain` secret:

   ```bash
   AWS_PROFILE=transit gtfs-viz import s3://my-bucket/gtfs/feed.zip
   ```

3. For `s3://`: an anonymous request, for public buckets.

R2 and S3-compatible stores such as MinIO need a secret:

```bash
# Cloudflare R2
duckdb -c "CREATE PERSISTENT SECRET (TYPE r2, KEY_ID '…', SECRET '…', ACCOUNT_ID 'your-account-id')"
gtfs-viz import r2://my-bucket/gtfs/feed.zip

# MinIO or another S3-compatible endpoint
duckdb -c "CREATE PERSISTENT SECRET (TYPE s3, KEY_ID '…', SECRET '…', ENDPOINT 'minio.example.com:9000', URL_STYLE 'path', USE_SSL true)"
gtfs-viz import s3://my-bucket/gtfs/feed.zip
```

Persistent secrets live in `~/.duckdb/stored_secrets`. gtfs-viz never prints or stores secret values.

Direct review links:

```bash
gtfs-viz edits --url-only
gtfs-viz edits --trip TRIP_ID --compare-view map --url-only
gtfs-viz edits --view table --trips-page 3 --trips-page-size 20 --url-only
gtfs-viz reroute --trip TRIP_ID --url-only
```

`reroute --trip TRIP_ID` opens the selected trip's reroute form. Providing `--via`, `--from`, and
`--to` applies the splice and opens the edited trip. Add `--url-only` for the deep link without
browser navigation or `--data` for terminal-only operation.

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

The CLI loads the [GTFS DuckDB](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-duckdb/usage/) extension like the web app and imports feeds with its `gtfs_import` pragma. See the [function reference](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-duckdb/functions/).

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

Installs `SKILL.md` with its references: `commands.md`, `tables.md`, `edits.md`, `gtfs-schedule-reference.md` and `examples.sql`. The [agent skill docs](https://gtfs-viz-production-f1a4.up.railway.app/docs/agents/) cover what it teaches.

## Extension prerequisite

By default the CLI installs the signed [GTFS DuckDB](https://gtfs-viz-production-f1a4.up.railway.app/docs/gtfs-duckdb/usage/#install)
extension from the DuckDB community repository (`INSTALL gtfs FROM community`). Community builds
exist only for the latest DuckDB, so use a DuckDB **v2.0.0** CLI (`duckdb --version`).

Set `GTFS_EXTENSION_REPOSITORY` to an `https://…` repository serving a compatible signed artifact to
use another source. Each imported dataset remembers the repository it was built with.

If gtfs is already installed from another repository, DuckDB refuses to switch origins. Either run
`duckdb -c "FORCE INSTALL gtfs FROM community"` or set `GTFS_EXTENSION_REPOSITORY` to the original
repository; the CLI never forces a reinstall itself.
