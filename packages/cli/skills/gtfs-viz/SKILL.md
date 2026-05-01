---
name: gtfs-viz
description: Use this skill when an agent needs to import a GTFS zip, query transit data, edit stations or pathways, export changes, or open the local GTFS Viz dashboard.
---

# GTFS Viz CLI

Use this skill when an agent needs to import a GTFS zip, query transit data, edit stations/pathways, export changes, or open the local dashboard.

## Reference Files

This skill folder contains detailed reference documents. Read these when you need exact column names, SQL syntax, or flag details:

- [commands.md](commands.md) — All CLI commands with flags and examples
- [tables.md](tables.md) — Table and view schemas with column types
- [procedures.md](procedures.md) — SQL macros, named queries, and pathfinding functions
- [gtfs-schedule-reference.md](gtfs-schedule-reference.md) — GTFS Schedule field reference focused on station parts, pathways, and missing-connection audits
- [examples.sql](examples.sql) — Practical SQL query examples

## Install

```bash
npm install -g @gabrielahn/gtfs-viz-cli
gtfs-viz install-skill
```

Or from the repo:

```bash
yarn build
npm install -g ./packages/cli
```

## Quick Start

```bash
gtfs-viz import /path/to/feed.zip
gtfs-viz status
gtfs-viz stations
gtfs-viz station "Park Street"
gtfs-viz station_pathways "Park Street" --data
```

## Import

```bash
gtfs-viz import /absolute/path/to/feed.zip
```

Use plain or quoted paths. Do not use backticks. Import is one-shot; a new import replaces the current dataset. Data is stored at `~/.gtfs-viz-cli/current`. Datasets auto-expire after 7 days.

## Browse & Filter

Filter stations or stops directly in the CLI:

```bash
gtfs-viz stations                                # All stations
gtfs-viz stations --name "Park"                  # Name contains "Park"
gtfs-viz stations --pathways "❌"                 # No pathways
gtfs-viz stations --wheelchair "🟢"               # Accessible
gtfs-viz stations --station-id place-pktrm       # Exact ID
gtfs-viz stations --name "Park" --pathways "✅"   # Combined

gtfs-viz stops                                   # All standalone stops
gtfs-viz stops --name "Albany"                    # Name contains "Albany"
gtfs-viz stops --location-type "Stop"             # By type
gtfs-viz stops --wheelchair "🔵"                  # By wheelchair status
```

Add `--format json` for JSON output.

## Dashboard

Commands open the dashboard by default. Add `--data` to print rows instead.

```bash
gtfs-viz station "Park Street"                    # Opens station info
gtfs-viz station "Park Street" --data             # Prints rows
gtfs-viz stop-info "Trade Center"                 # Opens stop map with popup + zoom
gtfs-viz station_connections "Park Street"         # Opens flow graph
gtfs-viz station_pathways place-pktrm --node-id node-pktrm-stair7-gl
gtfs-viz view --view stations/map --map-focus 42.355,-71.06,12
```

Return the printed dashboard URL to the user.

## Station Lookup

```bash
gtfs-viz station "Park Street"
gtfs-viz station --id place-pktrm --data
gtfs-viz station --id place-pktrm --format json
```

Use `--station-id` or `--station-name` when the value type is known. Use `--selected-station` or the positional argument when it could be either.

## Pathways & Connections

```bash
gtfs-viz station_connections "Park Street" --data
gtfs-viz station_pathways "Park Street" --data
gtfs-viz station_pathways place-pktrm --node-id node-pktrm-stair7-gl --data
```

`--node-id` targets platforms, exits/entrances, or pathway nodes within a station.

When checking for missing station pieces or broken internal connectivity, use station-part and network functions only. Start with `get_station_stops(station_id)`, then inspect `get_station_pathways(station_id)`, `get_station_routes(station_id)`, `find_shortest_path`, or `find_reachable_stops`. Do not audit station-internal connectivity from `StopsTable`, because that table is for standalone stops. See [gtfs-schedule-reference.md](gtfs-schedule-reference.md).

## Routes

```bash
gtfs-viz station_routes "South Station" --data
gtfs-viz station_routes "South Station" --data --time-interval 60
gtfs-viz station_routes "South Station" --data --connection-type "Exit/Entrance"
gtfs-viz station_routes "South Station" --data --node-id door-sstat-dewey
gtfs-viz station_shortest_route "South Station" --data
```

`station_shortest_route` finds the fastest entrance-to-exit route by time.

## Data Editing (Connections)

```bash
gtfs-viz add_connection --from NODE_A --to NODE_B --traversal-time 45
gtfs-viz add_connection --from NODE_A --to NODE_B --bidirectional --pathway-mode 2 --stair-count 12
gtfs-viz update_connection --pathway-id PATHWAY_ID --traversal-time 60
gtfs-viz delete_connection --pathway-id PATHWAY_ID
```

Pathway modes: 1=walkway, 2=stairs, 3=moving sidewalk, 4=escalator, 5=elevator, 6=fare gate, 7=exit gate.

Find pathway IDs first:

```bash
gtfs-viz station_pathways "Park Street" --data
gtfs-viz query --sql "SELECT pathway_id, from_stop_id, to_stop_id, traversal_time FROM PathwaysView WHERE from_stop_id LIKE '%pktrm%'"
```

## Data Editing (Nodes)

```bash
gtfs-viz add_node --stop-id NEW_ID --lat 42.35 --lon -71.06 --parent-station place-pktrm
gtfs-viz add_node --stop-id door-new --stop-name "New Entrance" --lat 42.35 --lon -71.06 --location-type "Exit/Entrance" --parent-station place-pktrm
gtfs-viz update_node --stop-id NODE_ID --stop-name "Main Lobby"
gtfs-viz delete_node --stop-id NODE_ID
```

Location types: Station, Stop, Exit/Entrance, Generic Node, Boarding Area.

Find stop IDs first:

```bash
gtfs-viz query --name station-stops --args-json '{"stationId":"place-pktrm"}' --data
```

Review pending edits:

```bash
gtfs-viz edit_table
```

## Export

Export edited GTFS data as CSV files. Merges edits with original data (same as the dashboard export).

```bash
gtfs-viz export                           # Export stops.txt + pathways.txt
gtfs-viz export --output ./exported       # Export to specific directory
gtfs-viz export --no-pathways             # Stops only
gtfs-viz export --no-stops                # Pathways only
gtfs-viz export --force                   # Export even with no pending edits
```

## Cleanup

```bash
gtfs-viz stop                             # Stop the dashboard session
gtfs-viz restart                          # Stop session and remove local import
gtfs-viz clean                            # Stop daemon + delete all local data
```

`clean` removes `~/.gtfs-viz-cli/` (DuckDB database, feed zip, session state). The dashboard daemon also auto-exits after 30 minutes of inactivity.

## SQL Queries

```bash
gtfs-viz query --sql "SELECT * FROM StationsTable"
gtfs-viz query --sql "SELECT stop_id, stop_name FROM get_station_stops('place-pktrm')"
gtfs-viz query --name station-info --args-json '{"stationId":"place-pktrm"}' --data
gtfs-viz query --name stations --data
```

See [procedures.md](procedures.md) for all available macros and [examples.sql](examples.sql) for practical queries.

## DuckDB Extension

The GTFS extension can be loaded directly into any DuckDB instance:

```sql
.read 'https://raw.githubusercontent.com/gabrielAHN/gtfs-viz/main/packages/procedures/gtfs/gtfs.sql'
```

This installs all macros, views, and tables. Requires `stops` and `pathways` tables to already exist.

## Agent Rules

- Use absolute paths for files outside the repo. Quote paths with spaces.
- Return the printed dashboard URL unless the user asked for `--data`.
- Use `gtfs-viz status` to verify which dataset is loaded.
- Datasets auto-expire after 7 days; reimport if expired.
- Read [commands.md](commands.md) for exact flag names when constructing commands.
- Read [tables.md](tables.md) for column names when writing SQL.
