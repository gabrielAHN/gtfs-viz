import { getFlagString } from "../args.js";

const TRUNCATE_AT = 50;
const ESC = String.fromCharCode(27);
const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "\u2026" : s);
const stripAnsi = (s: string) =>
  s.replaceAll(`${ESC}[0m`, "").replaceAll(`${ESC}[1m`, "").replaceAll(`${ESC}[2m`, "");

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "\x1b[2m-\x1b[0m";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

export const printTable = (result: { columns?: string[]; rows: Record<string, unknown>[] }) => {
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const columns =
    Array.isArray(result.columns) && result.columns.length > 0
      ? result.columns
      : rows.length > 0
        ? Object.keys(rows[0])
        : [];

  if (columns.length === 0 || rows.length === 0) {
    console.log("\x1b[2mNo rows\x1b[0m");
    return;
  }

  const widths = columns.map((col) => {
    const dataMax = Math.max(...rows.map((row) => stripAnsi(formatValue(row[col])).length));
    return Math.min(Math.max(col.length, dataMax), TRUNCATE_AT);
  });

  const sep = "  ";
  const renderRow = (values: string[]) =>
    values
      .map((v, i) => {
        const plain = stripAnsi(v);
        const pad = Math.max(0, widths[i] - plain.length);
        return v + " ".repeat(pad);
      })
      .join(sep);

  console.log(`\x1b[1m${renderRow(columns)}\x1b[0m`);
  console.log(widths.map((w) => "\u2500".repeat(w)).join(sep));

  for (const row of rows) {
    const vals = columns.map((col, i) => {
      const raw = formatValue(row[col]);
      const plain = stripAnsi(raw);
      return plain.length > widths[i] ? truncate(plain, widths[i]) : raw;
    });
    console.log(renderRow(vals));
  }

  console.log(`\x1b[2m${rows.length} row${rows.length === 1 ? "" : "s"}\x1b[0m`);
};

export const printResult = (
  result: {
    sourcePath?: string;
    importedAt?: string;
    columns?: string[];
    rows: Record<string, unknown>[];
    stationId?: string;
    stationName?: string;
    nodeId?: string;
    nodeName?: string;
    stopId?: string;
    stopName?: string;
  },
  flags: Record<string, string | boolean>,
) => {
  const format = getFlagString(flags, "format", "table");
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTable(result);
  }
};

const commandHelp: Record<string, string> = {
  import: `gtfs-viz import <feed.zip>

  Import a GTFS zip file into the local DuckDB database.

  Arguments:
    <feed.zip>        Path to the GTFS zip file (required)`,

  export: `gtfs-viz export [flags]

  Export edited GTFS data as CSV files. Merges edits with original data.

  Flags:
    --output <dir>        Output directory (default: current directory)
    --no-stops            Skip stops.txt export
    --no-pathways         Skip pathways.txt export
    --force               Export even if there are no pending edits`,

  station: `gtfs-viz station <name|id> [flags]

  Show station info in the dashboard, or print station data.

  Arguments:
    <name|id>               Station name or ID (positional)

  Flags:
    --station-id <id>       Select by exact ID
    --station-name <name>   Select by exact name
    --id <id>               Alias for --station-id
    --name <name>           Alias for --station-name
    --data                  Print rows instead of opening dashboard
    --format json           Output as JSON
    --route <route>         Dashboard route: info (default), map, table`,

  "stop-info": `gtfs-viz stop-info <name|id> [flags]

  Show stop in the dashboard map with popup, or print stop data.

  Arguments:
    <name|id>             Stop name or ID (positional)

  Flags:
    --stop-id <id>        Select by exact ID
    --stop-name <name>    Select by exact name
    --id <id>             Alias for --stop-id
    --name <name>         Alias for --stop-name
    --data                Print rows instead of opening dashboard
    --format json         Output as JSON
    --route <route>       Dashboard route: map (default), table`,

  station_connections: `gtfs-viz station_connections <name|id> [flags]

  Show station connection graph.

  Flags:
    --station-id <id>       Select by exact ID
    --id <id>               Alias for --station-id
    --data                  Print rows instead of opening dashboard
    --format json           Output as JSON
    --route <route>         Pathway view: flow (default), map, table, end`,

  station_pathways: `gtfs-viz station_pathways <name|id> [flags]

  Show station parts and pathways.

  Flags:
    --station-id <id>       Select station by exact ID
    --node-id <id>          Focus on a station part
    --stop-id <id>          Resolve a standalone stop
    --data                  Print rows instead of opening dashboard
    --format json           Output as JSON
    --route <route>         Pathway view: flow (default), map, table, end`,

  station_routes: `gtfs-viz station_routes <name|id> [flags]

  Show shortest-path routes between station parts.

  Flags:
    --station-id <id>          Select by exact ID
    --node-id <id>             Filter routes from/to a station part
    --time-interval <v>        Filter by time: <max> or <min,max> (seconds)
    --connection-type <type>   Filter by location type
    --data                     Print rows instead of opening dashboard
    --format json              Output as JSON`,

  station_shortest_route: `gtfs-viz station_shortest_route <name|id> [flags]

  Find the fastest entrance-to-exit route by time.

  Flags:
    --station-id <id>          Select by exact ID
    --data                     Print the route instead of opening dashboard
    --format json              Output as JSON`,

  edit_pathway: `gtfs-viz edit_pathway <name|id> [flags]

  Open the pathway edit form in the dashboard.

  Flags:
    --station-id <id>       Select station by exact ID
    --node-id <id>          Focus on a station part
    --data                  Print pathway data instead
    --route <route>         Pathway view: flow (default), map, table, end`,

  edit_stop: `gtfs-viz edit_stop <name|id> [flags]

  Open the stop/station-part edit form in the dashboard.

  Flags:
    --station-id <id>       Select station by exact ID
    --node-id <id>          Focus on a station part
    --stop-id <id>          Resolve a standalone stop
    --data                  Print stop data instead`,

  edit_table: `gtfs-viz edit_table [pathways|stops] [flags]

  Show edit tracking tables.

  Arguments:
    pathways              Show EditPathwayTable
    stops                 Show EditStopTable
    (none)                Show both

  Flags:
    --format json         Output as JSON`,

  add_connection: `gtfs-viz add_connection [flags]

  Add a new pathway connection between two station parts.

  Flags:
    --from <stop_id>                 Source station part (required)
    --to <stop_id>                   Target station part (required)
    --pathway-mode <1-7>             Mode (default: 1 = walkway)
    --bidirectional                  Mark as bidirectional
    --traversal-time <seconds>       Traversal time
    --length <meters>                Length
    --stair-count <n>                Number of stairs
    --max-slope <ratio>              Max slope
    --min-width <meters>             Min width
    --signposted-as <text>           Signposted name
    --reversed-signposted-as <text>  Reversed signposted name
    --pathway-id <id>                Custom ID (auto-generated if omitted)`,

  update_connection: `gtfs-viz update_connection [flags]

  Update an existing pathway connection. Only provided flags change.

  Flags:
    --pathway-id <id>                Connection to update (required)
    --from <stop_id>                 New source
    --to <stop_id>                   New target
    --pathway-mode <1-7>             New mode
    --bidirectional                  Set bidirectional
    --traversal-time <seconds>       New traversal time
    --length <meters>                New length
    --stair-count <n>                New stair count
    --max-slope <ratio>              New max slope
    --min-width <meters>             New min width
    --signposted-as <text>           New signposted name
    --reversed-signposted-as <text>  New reversed signposted name`,

  delete_connection: `gtfs-viz delete_connection [flags]

  Delete a pathway connection.

  Flags:
    --pathway-id <id>    Connection to delete (required)`,

  add_node: `gtfs-viz add_node [flags]

  Add a new stop or station part.

  Flags:
    --stop-id <id>              Node ID (required)
    --stop-name <name>          Node name (defaults to stop-id)
    --lat <latitude>            Latitude (required)
    --lon <longitude>           Longitude (required)
    --location-type <type>      Type: Station, Stop, Exit/Entrance, Generic Node, Boarding Area
    --parent-station <id>       Parent station ID
    --level-id <id>             Level ID
    --wheelchair <status>       Wheelchair boarding status`,

  update_node: `gtfs-viz update_node [flags]

  Update an existing stop or station part. Only provided flags change.

  Flags:
    --stop-id <id>              Node to update (required)
    --stop-name <name>          New name
    --lat <latitude>            New latitude
    --lon <longitude>           New longitude
    --location-type <type>      New location type
    --parent-station <id>       New parent station
    --level-id <id>             New level ID
    --wheelchair <status>       New wheelchair status`,

  delete_node: `gtfs-viz delete_node [flags]

  Delete a stop or station part.

  Flags:
    --stop-id <id>    Node to delete (required)`,

  stations: `gtfs-viz stations [flags]

  Show stations table with optional filters.

  Filter flags:
    --station-id <id>       Filter by exact station ID
    --name <name>           Filter by name (partial match, case-insensitive)
    --wheelchair <status>   Filter by wheelchair status emoji
    --pathways <status>     Filter by pathways status emoji

  Output flags:
    --dashboard             Open dashboard instead of printing
    --route <route>         Dashboard route: map (default), table
    --format json           Output as JSON`,

  stops: `gtfs-viz stops [flags]

  Show standalone stops table with optional filters.

  Filter flags:
    --stop-id <id>          Filter by exact stop ID
    --name <name>           Filter by name (partial match, case-insensitive)
    --wheelchair <status>   Filter by wheelchair status emoji
    --location-type <type>  Filter by location type

  Output flags:
    --dashboard             Open dashboard instead of printing
    --route <route>         Dashboard route: map (default), table
    --format json           Output as JSON`,

  query: `gtfs-viz query [flags]

  Run SQL or a named query against the local DuckDB database.

  Flags:
    --sql <sql>             Raw SQL to execute
    --name <name>           Named query to execute
    --args-json <json>      JSON arguments for named queries
    --data                  Print rows (for named queries with dashboard routes)
    --format json           Output as JSON

  Named queries: stations, stops, station-info, station-stops,
    station-pathways, station-connections, pathway-aggregates,
    station-routes, edit-pathways, edit-stops`,

  view: `gtfs-viz view [flags]

  Open a dashboard view in the browser.

  Flags:
    --view <route>          Dashboard view (default: auto)
    --station-id <id>       Select a station
    --stop-id <id>          Select a stop
    --map-focus <v>         Map center: lat,lon,zoom
    --node-id <id>          Focus on a station part

  Views: auto, stations/info, stations/map, stations/table,
    stations/pathways/flow/radial, stations/pathways/map/directional,
    stations/pathways/table/start, stations/pathways/table/end,
    stops/map, stops/table`,

  stop: `gtfs-viz stop

  Stop the dashboard daemon and clear session metadata. Imported data remains available.`,

  restart: `gtfs-viz restart

  Stop the dashboard daemon and remove the local DuckDB/feed import.
  Run gtfs-viz import <feed.zip> again before opening dashboard views.`,

  clean: `gtfs-viz clean

  Stop the dashboard daemon and remove all imported data and session metadata.`,
};

const commandAliases: Record<string, string> = {
  "station-connections": "station_connections",
  "station-pathways": "station_pathways",
  "station-routes": "station_routes",
  "station-shortest-route": "station_shortest_route",
  pathways: "station_pathways",
  routes: "station_routes",
  "shortest-route": "station_shortest_route",
  "edit-pathway": "edit_pathway",
  "edit-stop": "edit_stop",
  "edit-table": "edit_table",
  "add-connection": "add_connection",
  "update-connection": "update_connection",
  "delete-connection": "delete_connection",
  "add-node": "add_node",
  "update-node": "update_node",
  "delete-node": "delete_node",
  stop_info: "stop-info",
  open: "view",
  dashboard: "view",
};

export const printCommandHelp = (command: string): boolean => {
  const canonical = commandAliases[command] ?? command;
  const help = commandHelp[canonical];
  if (help) {
    console.log(help);
    return true;
  }
  return false;
};

export const printHelp = () => {
  console.log(`Usage: gtfs-viz <command> [flags]

Import & Status:
  import <feed.zip>                  Import a GTFS zip into local DuckDB
  status                             Show dataset info and session state
  tables                             List available DuckDB tables

Browse:
  stations [--name --wheelchair --pathways --station-id]
  stops    [--name --wheelchair --location-type --stop-id]

Lookup:
  station <name|id>                  Open station info
  stop-info <name|id>                Open stop map with popup

Pathways:
  station_connections <name|id>      Connection flow graph
  station_pathways <name|id>         Station parts and pathways
  station_routes <name|id>           Timed routes between parts
  station_shortest_route <name|id>   Fastest entrance-to-exit route

Edit (CLI):
  add_connection [flags]             Add a pathway connection
  update_connection [flags]          Update a pathway connection
  delete_connection [flags]          Delete a pathway connection
  add_node [flags]                   Add a stop/station part
  update_node [flags]                Update a stop/station part
  delete_node [flags]                Delete a stop/station part

Edit (Dashboard):
  edit_pathway <name|id>             Open pathway edit form
  edit_stop <name|id>                Open stop/node edit form
  edit_table [pathways|stops]        Show edit tracking tables

Export & Query:
  export [--output --no-stops --no-pathways --force]
  query --sql <sql>                  Run SQL
  query --name <name> [--data]       Named query

Session:
  view [--view <route>]              Open dashboard view
  stop                               Stop dashboard session and clear session state
  restart                            Stop session + remove local import
  clean                              Stop daemon + remove all data
  install-skill                      Install agent skills
  examples                           Show usage examples

Global flags: --data, --format json, --dashboard, --route <view>
Run gtfs-viz help <command> for details on any command.`);
};

export const printExamples = () => {
  console.log(`Import & browse:
  gtfs-viz import /path/to/feed.zip
  gtfs-viz status
  gtfs-viz stations
  gtfs-viz stations --name "Park" --pathways "✅"
  gtfs-viz stations --format json
  gtfs-viz stops --name "Albany"

Lookup & dashboard:
  gtfs-viz station "Park Street"
  gtfs-viz station --id place-pktrm --data
  gtfs-viz stop-info --stop-id 10011
  gtfs-viz stations --dashboard --route map
  gtfs-viz view --view stops/map --map-focus 42.355,-71.06,12

Pathways & routes:
  gtfs-viz station_connections "Park Street" --data
  gtfs-viz station_pathways place-pktrm --node-id node-pktrm-stair7-gl --data
  gtfs-viz station_routes "South Station" --data --time-interval 60
  gtfs-viz station_routes "South Station" --data --connection-type "Exit/Entrance"
  gtfs-viz station_shortest_route "South Station" --data

Edit connections:
  gtfs-viz add_connection --from node-lobby --to node-platform --traversal-time 45
  gtfs-viz add_connection --from door-1 --to node-lobby --bidirectional --pathway-mode 2
  gtfs-viz update_connection --pathway-id pw-123 --traversal-time 60
  gtfs-viz delete_connection --pathway-id pw-123

Edit nodes:
  gtfs-viz add_node --stop-id door-new --stop-name "New Entrance" --lat 42.35 --lon -71.06 --location-type "Exit/Entrance" --parent-station place-pktrm
  gtfs-viz update_node --stop-id door-new --stop-name "Main Entrance"
  gtfs-viz delete_node --stop-id door-new
  gtfs-viz edit_table

Export:
  gtfs-viz export
  gtfs-viz export --output ./exported --no-pathways
  gtfs-viz export --force

SQL:
  gtfs-viz query --sql "SELECT * FROM StationsTable"
  gtfs-viz query --sql "SELECT * FROM get_station_stops('place-pktrm')"
  gtfs-viz query --name station-info --args-json '{"stationId":"place-pktrm"}' --data

Cleanup:
  gtfs-viz stop
  gtfs-viz restart
  gtfs-viz clean`);
};
