# GTFS Viz CLI — Command Reference

Install: `npm install -g @gabrielahn/gtfs-viz-cli`

## Import & Status

```bash
gtfs-viz import <feed.zip>          # Import GTFS zip into local DuckDB
gtfs-viz status                     # Show dataset info and session state
gtfs-viz tables                     # List available DuckDB tables
gtfs-viz stop                       # Stop background dashboard session
gtfs-viz restart                    # Stop session and remove local import
gtfs-viz clean                      # Stop daemon and remove all local data
```

## Browse Data

```bash
gtfs-viz stations                             # Print all stations
gtfs-viz stations --name "Park"               # Filter by name (partial match)
gtfs-viz stations --pathways "❌"              # Filter by pathways status
gtfs-viz stations --wheelchair "🟢"            # Filter by wheelchair status
gtfs-viz stations --station-id place-pktrm    # Filter by exact ID
gtfs-viz stations --name "Park" --pathways "✅" # Combined filters
gtfs-viz stations --format json               # JSON output
gtfs-viz stations --dashboard --route map     # Open stations map
gtfs-viz stations --dashboard --route table   # Open stations table
```

```bash
gtfs-viz stops                                # Print all standalone stops
gtfs-viz stops --name "Albany"                 # Filter by name (partial match)
gtfs-viz stops --location-type "Stop"          # Filter by location type
gtfs-viz stops --wheelchair "🔵"               # Filter by wheelchair status
gtfs-viz stops --stop-id 10011                 # Filter by exact ID
gtfs-viz stops --dashboard --route map         # Open stops map
```

## Station Lookup

```bash
gtfs-viz station "Park Street"                # Open station info
gtfs-viz station --id place-pktrm --data      # Print station data
gtfs-viz stop-info "Albany St"                 # Open stop map with popup + zoom
gtfs-viz stop-info --stop-id 10011 --data     # Print stop data
```

## Pathways & Connections

```bash
gtfs-viz station_connections "Park Street"              # Open flow graph
gtfs-viz station_connections --id place-pktrm --data    # Print connections
gtfs-viz station_pathways "Park Street"                 # Open pathways view
gtfs-viz station_pathways place-pktrm --node-id NODE_ID # Focus on a node
gtfs-viz station_pathways "Park Street" --data          # Print pathways
```

## Routes & Pathfinding

```bash
gtfs-viz station_routes "South Station" --data                        # All routes
gtfs-viz station_routes "South Station" --data --time-interval 60     # Max 60s
gtfs-viz station_routes "South Station" --data --time-interval 30,120 # Range
gtfs-viz station_routes "South Station" --data --connection-type "Exit/Entrance"
gtfs-viz station_routes "South Station" --data --node-id door-sstat-1
gtfs-viz station_shortest_route "South Station"                       # Fastest entrance-to-exit
gtfs-viz station_shortest_route "South Station" --data                # Print it
```

## Missing Connection Checks

Use station parts and network functions only for internal station connectivity checks. Do not use `StopsTable` for this task.

```bash
gtfs-viz query --name station-stops --args-json '{"stationId":"place-pktrm"}' --data
gtfs-viz query --name station-pathways --args-json '{"stationId":"place-pktrm"}' --data
gtfs-viz station_routes place-pktrm --data
gtfs-viz station_pathways place-pktrm --node-id NODE_ID --data
```

For SQL audit patterns, read `gtfs-schedule-reference.md` and `procedures.md`.

## Edit Dashboard Forms

```bash
gtfs-viz edit_pathway "Park Street"                          # Open pathway editor
gtfs-viz edit_pathway place-pktrm --node-id NODE_ID          # Focus on node
gtfs-viz edit_stop "Park Street"                             # Open stop editor
gtfs-viz edit_stop --stop-id 10011                           # Edit a stop
gtfs-viz edit_table                                          # Show all edits
gtfs-viz edit_table pathways                                 # Show pathway edits
gtfs-viz edit_table stops --format json                      # JSON output
```

## Data Editing (CLI)

### Connections

```bash
gtfs-viz add_connection --from NODE_A --to NODE_B --traversal-time 45
gtfs-viz add_connection --from NODE_A --to NODE_B --bidirectional --pathway-mode 2 --stair-count 12
gtfs-viz update_connection --pathway-id PATHWAY_ID --traversal-time 60
gtfs-viz delete_connection --pathway-id PATHWAY_ID
```

Flags: `--from`, `--to`, `--pathway-id`, `--pathway-mode <1-7>`, `--bidirectional`, `--traversal-time`, `--length`, `--stair-count`, `--max-slope`, `--min-width`, `--signposted-as`, `--reversed-signposted-as`

### Nodes

```bash
gtfs-viz add_node --stop-id NEW_ID --lat 42.35 --lon -71.06 --parent-station STATION_ID
gtfs-viz add_node --stop-id NEW_ID --stop-name "Name" --lat 42.35 --lon -71.06 --location-type "Exit/Entrance" --parent-station STATION_ID
gtfs-viz update_node --stop-id STOP_ID --stop-name "New Name"
gtfs-viz delete_node --stop-id STOP_ID
```

Flags: `--stop-id`, `--stop-name`, `--lat`, `--lon`, `--location-type`, `--parent-station`, `--level-id`, `--wheelchair`

## Export

```bash
gtfs-viz export                                # Export edited GTFS as CSV
gtfs-viz export --output ./exported            # Export to specific directory
gtfs-viz export --no-pathways                  # Skip pathways.txt
gtfs-viz export --no-stops                     # Skip stops.txt
gtfs-viz export --force                        # Export even with no pending edits
```

Flags: `--output <dir>`, `--no-stops`, `--no-pathways`, `--force`

## SQL Queries

```bash
gtfs-viz query --sql "SELECT * FROM StationsTable"
gtfs-viz query --sql "SELECT * FROM StopsView WHERE parent_station = 'place-pktrm'"
gtfs-viz query --name station-info --args-json '{"stationId":"place-pktrm"}' --data
gtfs-viz query --name stations --data
gtfs-viz query --name edit-pathways --data
```

## Dashboard Views

```bash
gtfs-viz view --view stations/map
gtfs-viz view --view stations/info --station-id place-pktrm
gtfs-viz view --view stops/map --map-focus 42.355,-71.06,12
```

Available views: `auto`, `stations/info`, `stations/map`, `stations/table`, `stations/pathways/flow/radial`, `stations/pathways/map/directional`, `stations/pathways/table/start`, `stations/pathways/table/end`, `stations/parts/map`, `stations/parts/table`, `stops/map`, `stops/table`

## Selection Flags

| Flag                 | Description                     |
| -------------------- | ------------------------------- |
| `--station-id`       | Select station by exact ID      |
| `--station-name`     | Select station by exact name    |
| `--selected-station` | Select station by ID or name    |
| `--stop-id`          | Select stop by exact ID         |
| `--stop-name`        | Select stop by exact name       |
| `--selected-stop`    | Select stop by ID or name       |
| `--node-id`          | Focus on a station part by ID   |

## Filter Flags (stations/stops)

| Flag                | Command    | Description                        |
| ------------------- | ---------- | ---------------------------------- |
| `--name <text>`     | both       | Partial name match (case-insensitive) |
| `--station-id <id>` | stations  | Exact station ID                   |
| `--stop-id <id>`    | stops     | Exact stop ID                      |
| `--wheelchair <v>`  | both       | Wheelchair status emoji            |
| `--pathways <v>`    | stations  | Pathways status emoji              |
| `--location-type <v>` | stops   | Location type name                 |

## Output Flags

| Flag             | Description                              |
| ---------------- | ---------------------------------------- |
| `--data`         | Print rows instead of opening dashboard  |
| `--format json`  | Output as JSON                           |
| `--dashboard`    | Open dashboard for list commands         |
| `--route <view>` | Choose dashboard route                   |

## Install Skills

```bash
gtfs-viz install-skill                  # Interactive prompt
gtfs-viz install-skill --agent claude   # Claude Code
gtfs-viz install-skill --agent codex    # Codex
gtfs-viz install-skill --agent opencode # OpenCode
gtfs-viz install-skill --force          # Overwrite existing
```
