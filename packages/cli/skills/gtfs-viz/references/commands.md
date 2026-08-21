# GTFS Viz CLI — Command Reference

Install skill: `npx skills add gabrielAHN/gtfs-viz`
Install CLI: `npm install -g @gabrielahn/gtfs-viz-cli`

## Install the Skill by AI Provider

```bash
gtfs-viz install-skill openai
gtfs-viz install-skill anthropic
gtfs-viz install-skill google
gtfs-viz install-skill generic
gtfs-viz install-skill --provider openai
gtfs-viz install-skill --list-providers
gtfs-viz h install-skill
```

Use `--target-dir <dir>` to override the provider default and `--force` to replace an existing installation. Non-interactive use still requires a provider when `--target-dir` is set. The backward-compatible `--agent codex`, `--agent claude`, and `--agent opensource` forms are also accepted.

`gtfs-viz h` and `gtfs-viz help` show general help. Add a command, such as `gtfs-viz h reroute` or `gtfs-viz h edits`, for the same detailed output as `gtfs-viz reroute -h` or `gtfs-viz edits -h`.

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

Default opens dashboard. Use `--data` for terminal output.

```bash
gtfs-viz stations                             # Open stations map
gtfs-viz stations --data                      # Print all stations
gtfs-viz stations --name "Park"               # Filter by name (partial match)
gtfs-viz stations --pathways "❌"              # Filter by pathways status
gtfs-viz stations --wheelchair "🟢"            # Filter by wheelchair status
gtfs-viz stations --id place-pktrm --data     # Filter by exact ID
gtfs-viz stations --format json               # JSON output
gtfs-viz stations --view table                # Open stations table
gtfs-viz stations map                         # Positional view name
```

```bash
gtfs-viz stops                                # Open stops map
gtfs-viz stops --data                         # Print all stops
gtfs-viz stops --name "Albany"                 # Filter by name
gtfs-viz stops --location-type "Stop"          # Filter by location type
gtfs-viz stops --id 10011 --data              # Filter by exact ID
```

```bash
gtfs-viz routes                                    # Open routes map
gtfs-viz routes --data                             # Print all routes
gtfs-viz routes --name "Metro"                     # Filter by name
gtfs-viz routes --type Bus                         # Filter by type
gtfs-viz routes --id ROUTE_ID --data               # Filter by ID
gtfs-viz routes --format json                      # JSON output
```

## Station & Stop Lookup

```bash
gtfs-viz station "Park Street"                # Open station info
gtfs-viz station --id place-pktrm --data      # Print station data
gtfs-viz stop-info "Albany St"                 # Open stop map with popup
gtfs-viz stop-info --id 10011 --data          # Print stop data
```

## Route Lookup & Service

```bash
gtfs-viz route "Line 1"                            # Open route info
gtfs-viz route "Line 1" --data                     # Print route data
gtfs-viz route "Line 1" service                    # Open service view
gtfs-viz route "Line 1" service --data             # Print services table
gtfs-viz route "Line 1" --service weekday-1 --data # Print trips for service
gtfs-viz route "Line 1" --trip TRIP_ID --data      # Print stop_times for trip
gtfs-viz route "Line 1" --service svc-1 --compare "trip-1,trip-2" --data  # Compare trips
gtfs-viz route "Line 1" --view map                 # Open route on map
```

Flags: `--service`, `--service-id`, `--trip`, `--trip-id`, `--compare <t1,t2,...>`, `--view <view>`

`--compare` requires `--service` and accepts up to 5 comma-separated trip IDs.

## Trips & Stop Times

```bash
gtfs-viz trips --data                              # List all trips with stop counts
gtfs-viz trips --route R1 --data                   # Trips for a route
gtfs-viz trips --route R1 --service SAT --data     # Trips for route+service
gtfs-viz trips trip-123 --data                     # Stop times for a trip
gtfs-viz trips --compare t1,t2 --data              # Compare stop times side-by-side
gtfs-viz trips --compare t1,t2,t3                  # Compare trips in dashboard
gtfs-viz trips --compare t1,t2 --view map          # Compare on map
```

```bash
gtfs-viz trip trip-123                              # Open trip in dashboard
gtfs-viz trip trip-123 --data                      # Print stop times with stop names
gtfs-viz trip trip-123 --data --view info           # Print trip metadata
gtfs-viz trip trip-123 --compare trip-456 --data   # Compare two trips
gtfs-viz trip trip-123 --view timeline              # Open timeline view
gtfs-viz trip trip-123 --view map                  # Open map view
gtfs-viz trip trip-123 --compare trip-456 --view map # Compare on map
```

Flags: `--route`, `--route-id`, `--service`, `--service-id`, `--trip`, `--trip-id`, `--compare <t1,t2,...>`, `--view <timetable|timeline|map|info>`

Views: `timetable` (default, table of stops), `timeline` (time-based chart), `map` (stops on map), `info` (trip metadata, --data only).

**Compare pattern**: `--compare` lists all trip IDs to compare. Example: to compare trips A, B, C use `--compare A,B,C`. With `trip` command, the positional trip ID is automatically included: `gtfs-viz trip A --compare B,C` compares A, B, C.

## Calendar & Services

```bash
gtfs-viz calendar --data                           # List all services with trip counts
gtfs-viz calendar --route R1 --data                # Services for a route
gtfs-viz calendar SAT-1 --data                     # Calendar + dates for a service
gtfs-viz calendar SAT-1                            # Open service view in dashboard
```

Flags: `--service-id`, `--service`, `--route-id`, `--route`

## Shapes

```bash
gtfs-viz shapes --data                             # List all shapes with stats
gtfs-viz shapes --route R1 --data                  # Shapes for a route
gtfs-viz shapes shape-123 --data                   # Points for a shape
gtfs-viz shapes                                    # Open route map in dashboard
```

Flags: `--shape-id`, `--shape`, `--route-id`, `--route`

## Pathways & Connections

```bash
gtfs-viz station_connections "Park Street"              # Open flow graph
gtfs-viz station_connections --id place-pktrm --data    # Print connections
gtfs-viz station_pathways "Park Street"                 # Open pathways view
gtfs-viz station_pathways place-pktrm --node-id NODE_ID # Focus on a node
gtfs-viz station_pathways "Park Street" --data          # Print pathways
```

## Station Routes & Pathfinding

```bash
gtfs-viz station_routes "South Station" --data                        # All routes
gtfs-viz station_routes "South Station" --data --time-interval 60     # Max 60s
gtfs-viz station_routes "South Station" --data --time-interval 30,120 # Range
gtfs-viz station_routes "South Station" --data --connection-type "Exit/Entrance"
gtfs-viz station_routes "South Station" --data --node-id door-sstat-1
gtfs-viz station_shortest_route "South Station"                       # Fastest entrance-to-exit
gtfs-viz station_shortest_route "South Station" --data                # Print it
```

## Edit Dashboard Forms

```bash
gtfs-viz edit_pathway "Park Street"                          # Open pathway editor
gtfs-viz edit_pathway place-pktrm --node-id NODE_ID          # Focus on node
gtfs-viz edit_stop "Park Street"                             # Open stop editor
gtfs-viz edit_stop --stop-id 10011                           # Edit a stop
gtfs-viz edit_table                                          # Show all edits
gtfs-viz edit_table pathways                                 # Show pathway edits
gtfs-viz edit_table routes                                   # Show route edits
gtfs-viz edit_table stops --format json                      # JSON output
gtfs-viz edit_table stop_times                               # Show stop time edits
gtfs-viz edit_table calendar                                 # Show calendar edits
gtfs-viz edit_table calendar_dates                           # Show calendar exception-date edits
gtfs-viz edit_table trips                                    # Show trip edits
gtfs-viz edits                                               # Categorized summary of all edits
gtfs-viz edits --trip TRIP_ID                                # Original vs edited stop_times for a trip
gtfs-viz edits --url-only                                    # Edits & Export, by category
gtfs-viz edits --trip TRIP_ID --compare-view map --url-only  # Expanded reroute map comparison
gtfs-viz edits --view table --trips-page 3 --trips-page-size 20 --url-only
gtfs-viz edit_table --url-only                               # Edits & Export, by table
```

## Data Editing (CLI)

### Connections

```bash
gtfs-viz add_connection --from NODE_A --to NODE_B --traversal-time 45
gtfs-viz add_connection --from NODE_A --to NODE_B --bidirectional --pathway-mode 2
gtfs-viz update_connection --pathway-id PATHWAY_ID --traversal-time 60
gtfs-viz delete_connection --pathway-id PATHWAY_ID
```

### Nodes

```bash
gtfs-viz add_node --stop-id NEW_ID --lat 42.35 --lon -71.06 --parent-station STATION_ID
gtfs-viz update_node --stop-id STOP_ID --stop-name "New Name"
gtfs-viz delete_node --stop-id STOP_ID
```

### Trips, Stop Times & Calendar

See [edits.md](edits.md) for the full changeset format and the alert → edit workflow.

```bash
gtfs-viz add_trip --trip-id T2 --route-id R1 --service-id WKD --headsign "Express" --direction-id 0
gtfs-viz update_trip --trip-id T2 --headsign "Express"       # only given fields change
gtfs-viz delete_trip --trip-id T2                            # cascades to stop_times
gtfs-viz set_stop_times --trip-id T2 --stops-json '[{"stop_sequence":1,"stop_id":"S1","arrival_time":"09:00:00","departure_time":"09:00:00"}]'
gtfs-viz set_stop_times --trip-id T2 --stops-file ./stops.json
gtfs-viz reroute --trip A_TRIP --via F_TRIP --from "W 4 St-Wash Sq" --to "Jay St-MetroTech"   # splice a donor route's stops in (scaled timing)
gtfs-viz remove_stops --trip T2 --stops "Spring St,Canal St"          # skip/express, station bypass
gtfs-viz truncate_trip --trip T2 --to "14 St"                          # short-turn / ends early (also --from)
gtfs-viz run_local --trip T2 --via LOCAL_TRIP --from "W 4 St-Wash Sq" --to "Jay St-MetroTech"  # run local (add stops back)
gtfs-viz split_trip --trip T2 --gap-from "Crescent St" --gap-to "Broadway Junction" --new-trip-id T2_SEC2  # two-section split
gtfs-viz add_calendar --service-id WKND --days sat,sun --start-date 20260101 --end-date 20261231
gtfs-viz update_calendar --service-id WKD --days mon,tue,wed,thu,fri,sat
gtfs-viz delete_calendar --service-id WKND
gtfs-viz add_calendar_date --service-id WKD --date 20260906 --exception-type 1   # 1=add, 2=remove
gtfs-viz delete_calendar_date --service-id WKD --date 20260906
```

### Batch Changeset

```bash
gtfs-viz apply changeset.json                  # Apply many typed ops at once
gtfs-viz apply --json '{"ops":[...]}'          # Inline JSON
cat changeset.json | gtfs-viz apply --stdin    # From stdin
```

Ops: `trip.add|update|delete`, `stop_times.set`, `calendar.add|update|delete`, `calendar_date.add|delete`. Schema + examples in [edits.md](edits.md).

## Export

```bash
gtfs-viz export                                # Export merged GTFS (stops, pathways, routes, trips, stop_times, calendar, calendar_dates)
gtfs-viz export --output ./exported            # Export to specific directory
gtfs-viz export --no-pathways                  # Skip pathways.txt
gtfs-viz export --no-trips                     # Skip trips.txt
gtfs-viz export --no-stop-times                # Skip stop_times.txt
gtfs-viz export --no-calendar                  # Skip calendar.txt + calendar_dates.txt
gtfs-viz export --force                        # Export even with no pending edits
```

## SQL Queries

```bash
gtfs-viz query --sql "SELECT * FROM StationsTable"
gtfs-viz query --name station-info --args-json '{"stationId":"place-pktrm"}' --data
gtfs-viz query --name routes --data
```

## Output Flags

| Flag             | Description                              |
| ---------------- | ---------------------------------------- |
| (default)        | Open dashboard                           |
| `--data`         | Print rows in terminal                   |
| `--format json`  | JSON output                              |
| `--url`          | Open dashboard and print URL             |
| `--url-only`     | Print URL without opening                |
| `--view <view>`  | Choose dashboard view                    |
| `--page <n>`     | Open an ordinary dashboard table at page n |
| `--page-size <n>` | Table page size: 10, 20, 30, or 50      |

Edits & Export accepts file-specific pagination flags:
`--stops-page`, `--pathways-page`, `--routes-page`, `--trips-page`, `--calendar-page`, and
`--calendar-dates-page`, each with a matching `-page-size` flag. Route service accepts
`--services-page`, `--services-page-size`, `--service-trips-page`, and
`--service-trips-page-size`.

Dashboard views include `trips/table` and `export`. `gtfs-viz view --view export --url-only` opens
Edits & Export by category; add `--view table` through `gtfs-viz edits --view table --url-only` for
the per-file tables.

## Context-Aware Help

```bash
gtfs-viz routes -h                     # Routes command help
gtfs-viz routes service -h             # Service-specific flags
gtfs-viz route --view service -h       # Same as above
```
