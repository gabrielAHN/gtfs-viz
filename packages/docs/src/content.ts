export const repos = {
  viz: "https://github.com/gabrielAHN/gtfs-viz",
  extension: "https://github.com/gabrielAHN/gtfs-duckdb-extension",
  app: "https://gtfs-viz-production-f1a4.up.railway.app",
  npm: "https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli",
  functions: "https://github.com/gabrielAHN/gtfs-duckdb-extension/blob/main/docs/functions.md",
}

export const intro =
  "GTFS Viz is an open-source toolkit for looking at, fixing and publishing GTFS transit feeds. It has two parts: GTFS Viz, a web app, CLI and AI skill for people and agents, and the GTFS DuckDB Extension, the toolbox of GTFS functions they all call. The same station, pathway, route and trip logic runs from one operator's laptop up to a cloud pipeline."

export const goals = [
  {
    title: "Scalable in the cloud",
    body: "One DuckDB extension holds the GTFS logic, so the same functions run in a browser tab, on a laptop or in a cloud job, for a city feed or a national one.",
  },
  {
    title: "Ready for AI",
    body: "Every dashboard action is also a CLI command with JSON output and a SQL function. The Agent Skill lets an agent audit a feed, apply edits from a service alert and export the result.",
  },
  {
    title: "Easy for operators",
    body: "A no-install web app: upload a GTFS zip, see stations and pathways on a map, fix what is wrong and export CSV. Data stays on the operator's machine.",
  },
]

export type Block =
  | { type: "text"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string; lang: "bash" | "sql" | "json" | "text" }
  | {
      type: "steps"
      items: { title: string; body: string; code?: string; lang?: "bash" | "sql" }[]
    }
  | { type: "cards"; items: { title: string; body: string; href?: string }[] }
  | { type: "table"; head: string[]; rows: string[][] }

export type Section = { id: string; title: string; blocks: Block[] }

export type DocPage = {
  slug: string
  title: string
  summary: string
  sections: Section[]
}

export type Part = {
  id: "gtfs-viz" | "gtfs-duckdb-extension"
  name: string
  tagline: string
  repo: string
  summary: string
  pages: DocPage[]
}

const tree = (path: string) => `${repos.viz}/tree/main/${path}`
const extTree = (path: string) => `${repos.extension}/tree/main/${path}`

export const parts: Part[] = [
  {
    id: "gtfs-viz",
    name: "GTFS Viz",
    tagline: "Web app, CLI and AI skill for GTFS feeds",
    repo: repos.viz,
    summary:
      "Look at, fix and export GTFS feeds in the browser, from a terminal or through an AI agent. All three run the same GTFS DuckDB Extension on the same data.",
    pages: [
      {
        slug: "how-it-works",
        title: "How it works",
        summary: "One dataset, three ways in: the web app, the CLI and the AI skill.",
        sections: [
          {
            id: "overview",
            title: "Overview",
            blocks: [
              {
                type: "text",
                text: "GTFS Viz loads a GTFS zip into DuckDB, calls the GTFS DuckDB Extension to build station, route and trip tables, and shows them as maps and tables. Edits are stored next to the original feed and merged back into GTFS CSV on export.",
              },
              {
                type: "cards",
                items: [
                  {
                    title: "Web app",
                    body: "DuckDB-WASM in the browser. Upload a zip and work on maps and tables. Nothing is uploaded to a server.",
                  },
                  {
                    title: "CLI",
                    body: "Native DuckDB on your machine. Import once, then query, edit, export or open the web dashboard on the same database.",
                  },
                  {
                    title: "AI skill",
                    body: "An Agent Skill that teaches AI agents the CLI, so they can audit a feed, apply service changes and hand back a dashboard link.",
                  },
                ],
              },
            ],
          },
          {
            id: "data-flow",
            title: "Data flow",
            blocks: [
              {
                type: "steps",
                items: [
                  {
                    title: "Import",
                    body: "Each GTFS file is read into a raw table and normalized by the extension's `gtfs_normalize_<table>` pragmas.",
                  },
                  {
                    title: "Build",
                    body: "`PRAGMA gtfs_init` builds `StationsTable`, `RoutesTable`, `TripsTable` and the merged `*View` views.",
                  },
                  {
                    title: "Explore",
                    body: "Every page and command calls extension functions such as `get_station_info` or `find_shortest_path`.",
                  },
                  {
                    title: "Edit",
                    body: "Changes go to `Edit*Table` tables. `PRAGMA gtfs_refresh` rebuilds the views with the edits applied; the imported feed is not changed.",
                  },
                  {
                    title: "Export",
                    body: "Export merges pending edits with the original feed and writes GTFS CSV files.",
                  },
                ],
              },
            ],
          },
          {
            id: "packages",
            title: "Packages",
            blocks: [
              {
                type: "cards",
                items: [
                  {
                    title: "packages/web",
                    body: "The web app: maps, tables, editors and export.",
                    href: tree("packages/web"),
                  },
                  {
                    title: "packages/cli",
                    body: "`@gabrielahn/gtfs-viz-cli` and the bundled `gtfs-viz` Agent Skill.",
                    href: tree("packages/cli"),
                  },
                  {
                    title: "packages/duckdb-client",
                    body: "Installs and loads the extension and runs its lifecycle for the web app and the CLI. It has no SQL of its own.",
                    href: tree("packages/duckdb-client"),
                  },
                  {
                    title: "packages/lib",
                    body: "Rendering: route bands, compared-trip lanes and the deck.gl route-shape layer.",
                    href: tree("packages/lib"),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "web",
        title: "Web app",
        summary:
          "Open a feed in the browser and review stations, routes and trips on maps and tables.",
        sections: [
          {
            id: "open-a-feed",
            title: "Open a feed",
            blocks: [
              {
                type: "text",
                text: "Open the web app and choose **Upload GTFS Zip File**, or pick one from **Example Datasets**. The feed is loaded into DuckDB-WASM and saved in the browser's private storage when it is available, so a reload reopens it.",
              },
              {
                type: "cards",
                items: [{ title: "Open the web app", body: repos.app, href: repos.app }],
              },
            ],
          },
          {
            id: "pages",
            title: "Pages",
            blocks: [
              {
                type: "table",
                head: ["Page", "Views", "What you can do"],
                rows: [
                  [
                    "Routes",
                    "Map, Table",
                    "Route lines, parallel bands for shared track, route info, services and trips; edit routes and shapes",
                  ],
                  [
                    "Trips",
                    "Table",
                    "Timetables, compare a trip with up to 5 others, edit stop times, reroute a trip through another route's stops",
                  ],
                  [
                    "Stations",
                    "Map, Table",
                    "Station info, station parts, pathways as map, table or Flow (column and radial); edit parts and pathways",
                  ],
                  [
                    "Stops",
                    "Map, Table",
                    "Standalone stops with the routes that serve them; edit stops",
                  ],
                  [
                    "Export",
                    "By category",
                    "**Edits & Export**: review every pending change and download the edited GTFS files",
                  ],
                ],
              },
            ],
          },
          {
            id: "edit-and-export",
            title: "Edit and export",
            blocks: [
              {
                type: "list",
                items: [
                  "Edits are validated as you type and marked as new, edited or deleted.",
                  "**Edits & Export** groups changes by file, compares original and edited trips, and shows reroutes on a map.",
                  "**Export** writes the merged GTFS files; untouched files are kept as they were.",
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "cli",
        title: "CLI",
        summary:
          "Import a feed once, then query, edit and export from a terminal or open the dashboard on it.",
        sections: [
          {
            id: "install",
            title: "Install",
            blocks: [
              {
                type: "text",
                text: "Needs Node 22 and the DuckDB CLI with the `spatial` extension.",
              },
              {
                type: "code",
                lang: "bash",
                code: "npm install -g @gabrielahn/gtfs-viz-cli\ngtfs-viz version\ngtfs-viz update --check",
              },
            ],
          },
          {
            id: "import",
            title: "Import and status",
            blocks: [
              {
                type: "code",
                lang: "bash",
                code: "gtfs-viz import /absolute/path/to/feed.zip\ngtfs-viz status\ngtfs-viz tables",
              },
              {
                type: "text",
                text: "A new import replaces the current dataset. Data lives in `~/.gtfs-viz-cli/current` and expires after 7 days.",
              },
            ],
          },
          {
            id: "query",
            title: "Browse and query",
            blocks: [
              {
                type: "text",
                text: "Commands open the dashboard by default. Add `--data` to print a table, or `--format json` for scripts and agents.",
              },
              {
                type: "code",
                lang: "bash",
                code: 'gtfs-viz stations --name "Park" --data\ngtfs-viz station "Park Street" --data\ngtfs-viz station_pathways "Park Street" --data\ngtfs-viz routes --type Subway --format json\ngtfs-viz trips --route Red --data\ngtfs-viz trip canonical-Red-C1-0 --data\ngtfs-viz calendar --data\ngtfs-viz query --sql "SELECT stop_name, exit_count FROM get_station_info(\'place-pktrm\')"',
              },
            ],
          },
          {
            id: "dashboard",
            title: "Dashboard",
            blocks: [
              {
                type: "text",
                text: "Start a local session and open the web app on the imported feed. `--url-only` prints the link instead.",
              },
              {
                type: "code",
                lang: "bash",
                code: "gtfs-viz view --view stations/map\ngtfs-viz trip canonical-Red-C1-0 --compare canonical-Red-C1-1 --url-only\ngtfs-viz stop",
              },
            ],
          },
          {
            id: "edit",
            title: "Edit",
            blocks: [
              {
                type: "text",
                text: "Edit trips, stop times, calendars, stations and pathways one command at a time, or apply a JSON changeset.",
              },
              {
                type: "code",
                lang: "bash",
                code: 'gtfs-viz update_trip --trip-id canonical-Red-C1-0 --headsign "Alewife Express"\ngtfs-viz remove_stops --trip canonical-Red-C1-0 --stops "Davis,Porter"\ngtfs-viz reroute --trip <trip_id> --via <donor_trip_id> --from "<station>" --to "<station>"\ngtfs-viz apply changeset.json\ngtfs-viz edits --data',
              },
            ],
          },
          {
            id: "export",
            title: "Export",
            blocks: [
              {
                type: "code",
                lang: "bash",
                code: "gtfs-viz export --output ./edited-feed\ngtfs-viz export --output ./edited-feed --no-pathways",
              },
              {
                type: "text",
                text: "Export merges pending edits with the original feed, the same as the web app's export.",
              },
            ],
          },
          {
            id: "route-bands",
            title: "Route bands",
            blocks: [
              {
                type: "text",
                text: "Build parallel route-line bands for routes that share track. The dashboard's Routes map reads them.",
              },
              {
                type: "code",
                lang: "bash",
                code: "gtfs-viz route-bands --data\ngtfs-viz route-bands --status --data",
              },
            ],
          },
          {
            id: "cleanup",
            title: "Cleanup",
            blocks: [
              {
                type: "table",
                head: ["Command", "Effect"],
                rows: [
                  ["`gtfs-viz stop`", "Stop the dashboard session"],
                  ["`gtfs-viz restart`", "Stop the session and remove the local import"],
                  ["`gtfs-viz clean`", "Stop the daemon and delete `~/.gtfs-viz-cli/`"],
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "ai-skill",
        title: "AI skill",
        summary:
          "The `gtfs-viz` Agent Skill teaches AI agents to work with GTFS feeds through the CLI.",
        sections: [
          {
            id: "install",
            title: "Install",
            blocks: [
              { type: "code", lang: "bash", code: "npx skills add gabrielAHN/gtfs-viz" },
              { type: "text", text: "Or register it from an installed CLI:" },
              {
                type: "code",
                lang: "bash",
                code: "gtfs-viz install-skill anthropic\ngtfs-viz install-skill --list-providers\ngtfs-viz skill-path",
              },
              {
                type: "table",
                head: ["Provider", "Installs to"],
                rows: [
                  ["`anthropic`", "`~/.claude/skills`"],
                  ["`openai`", "`~/.codex/skills`"],
                  ["`google`", "`~/.gemini/skills`"],
                  ["`generic`", "`~/.agents/skills`"],
                ],
              },
            ],
          },
          {
            id: "what-agents-can-do",
            title: "What agents can do",
            blocks: [
              {
                type: "list",
                items: [
                  "Import a feed and report what it contains",
                  "Audit stations for missing pathways or platforms that cannot reach an exit",
                  "Turn a service alert into trip, stop-time and calendar edits",
                  "Reroute a trip through another route's stops",
                  "Review edits, export GTFS and return a dashboard link to check the result",
                ],
              },
            ],
          },
          {
            id: "workflow",
            title: "Service-change workflow",
            blocks: [
              {
                type: "steps",
                items: [
                  {
                    title: "Import the feed",
                    body: "",
                    code: "gtfs-viz import /abs/path/feed.zip",
                    lang: "bash",
                  },
                  {
                    title: "Read the change",
                    body: "The agent reads the alert or notice itself; the CLI does not fetch alerts.",
                  },
                  {
                    title: "Check the data",
                    body: "Query through the merged `*View` tables so pending edits are included.",
                    code: "gtfs-viz trip <trip_id> --data\ngtfs-viz calendar <service_id> --data",
                    lang: "bash",
                  },
                  {
                    title: "Apply edits",
                    body: "Use individual commands or one changeset.",
                    code: "gtfs-viz apply changeset.json",
                    lang: "bash",
                  },
                  {
                    title: "Review and export",
                    body: "",
                    code: "gtfs-viz edits --url-only\ngtfs-viz export --output ./out",
                    lang: "bash",
                  },
                ],
              },
            ],
          },
          {
            id: "changeset",
            title: "Changeset format",
            blocks: [
              {
                type: "text",
                text: "Op types: `trip.add`, `trip.update`, `trip.delete`, `stop_times.set`, `calendar.add`, `calendar.update`, `calendar.delete`, `calendar_date.add` and `calendar_date.delete`.",
              },
              {
                type: "code",
                lang: "json",
                code: '{\n  "ops": [\n    { "op": "trip.update", "trip_id": "canonical-Red-C1-0", "trip_headsign": "Alewife Express" }\n  ]\n}',
              },
            ],
          },
          {
            id: "reference",
            title: "Skill files",
            blocks: [
              {
                type: "cards",
                items: [
                  {
                    title: "SKILL.md",
                    body: "Commands, dashboard links and agent rules.",
                    href: `${repos.viz}/blob/main/packages/cli/skills/gtfs-viz/SKILL.md`,
                  },
                  {
                    title: "references/commands.md",
                    body: "Every command with flags.",
                    href: `${repos.viz}/blob/main/packages/cli/skills/gtfs-viz/references/commands.md`,
                  },
                  {
                    title: "references/edits.md",
                    body: "Changesets and the alert-validation workflow.",
                    href: `${repos.viz}/blob/main/packages/cli/skills/gtfs-viz/references/edits.md`,
                  },
                  {
                    title: "references/tables.md",
                    body: "Table and view columns for SQL.",
                    href: `${repos.viz}/blob/main/packages/cli/skills/gtfs-viz/references/tables.md`,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "gtfs-duckdb-extension",
    name: "GTFS DuckDB Extension",
    tagline: "The GTFS toolbox as a loadable DuckDB extension",
    repo: repos.extension,
    summary:
      "`gtfs` holds every GTFS database function GTFS Viz uses: import, station and route analysis, pathway pathfinding, trip rerouting and route-band geometry. Any DuckDB client can load it.",
    pages: [
      {
        slug: "usage",
        title: "Usage",
        summary: "What the extension does, how to load it and the dataset lifecycle.",
        sections: [
          {
            id: "what-it-is",
            title: "What it is",
            blocks: [
              {
                type: "text",
                text: "A DuckDB extension built from the DuckDB extension template. `LOAD gtfs` registers 88 functions: 23 pragmas, 10 scalar macros and 55 table macros. Loading never creates or resets tables; the lifecycle pragmas do.",
              },
              {
                type: "table",
                head: ["Build", "DuckDB", "Platforms"],
                rows: [
                  ["Native", "1.5.4", "Linux amd64/arm64, macOS amd64/arm64, Windows amd64/MinGW"],
                  ["WASM", "1.4.3", "`wasm_eh`, `wasm_mvp`"],
                ],
              },
            ],
          },
          {
            id: "install",
            title: "Install and load",
            blocks: [
              {
                type: "text",
                text: "Until it is in the DuckDB community repository, install from a repository URL. The `spatial` extension is required.",
              },
              {
                type: "code",
                lang: "sql",
                code: "INSTALL spatial;\nLOAD spatial;\nINSTALL gtfs FROM '<repository>';\nLOAD gtfs;",
              },
            ],
          },
          {
            id: "lifecycle",
            title: "Dataset lifecycle",
            blocks: [
              {
                type: "steps",
                items: [
                  {
                    title: "Prepare",
                    body: "Create the edit tables.",
                    code: "PRAGMA gtfs_prepare;",
                    lang: "sql",
                  },
                  {
                    title: "Import",
                    body: "Load each GTFS file into `<table>_raw` and normalize it. Use `PRAGMA gtfs_empty_<table>` for optional files the feed does not have.",
                    code: "CREATE TEMP TABLE stops_raw AS\n  SELECT * FROM read_csv_auto('feed/stops.txt', all_varchar=true);\nPRAGMA gtfs_normalize_stops;\n-- repeat for pathways, routes, trips, stop_times, shapes, calendar, calendar_dates",
                    lang: "sql",
                  },
                  {
                    title: "Initialize",
                    body: "Build the tables and views.",
                    code: "PRAGMA gtfs_init;",
                    lang: "sql",
                  },
                  {
                    title: "Query",
                    body: "Call any table macro.",
                    code: "SELECT stop_name, exit_count, pathways_status\n  FROM get_station_info('place-pktrm');",
                    lang: "sql",
                  },
                  {
                    title: "Edit and refresh",
                    body: "Write to the `Edit*Table` tables, then refresh. The imported tables are not changed.",
                    code: "INSERT INTO EditStopTable BY NAME\n  SELECT row_id, stop_id, 'Park Street Station' AS stop_name, stop_lat, stop_lon,\n    location_type_name, parent_station, '' AS level_id, wheelchair_status, 'edit' AS status\n  FROM StationsTable WHERE stop_id = 'place-pktrm';\nPRAGMA gtfs_refresh;",
                    lang: "sql",
                  },
                ],
              },
            ],
          },
          {
            id: "tables",
            title: "Tables it builds",
            blocks: [
              {
                type: "table",
                head: ["Group", "Tables and views"],
                rows: [
                  [
                    "Imported",
                    "`stops`, `pathways`, `routes`, `trips`, `stop_times`, `shapes`, `calendar`, `calendar_dates`",
                  ],
                  [
                    "Built by `gtfs_init`",
                    "`StationsTable`, `StopsTable`, `RoutesTable`, `TripsTable`, `RouteStopsTable`, `CalendarTable`",
                  ],
                  [
                    "Merged with edits",
                    "`StopsView`, `PathwaysView`, `RoutesView`, `TripsView`, `StopTimesView`, `CalendarView`, `CalendarDatesView`, `RouteShapesView`, `RouteStopsView`, `pathway_network`",
                  ],
                  [
                    "Edits",
                    "`EditStopTable`, `EditPathwayTable`, `EditRouteTable`, `EditTripsTable`, `EditStopTimesTable`, `EditCalendarTable`, `EditCalendarDatesTable`",
                  ],
                  [
                    "Route bands",
                    "`RouteShapeLanesTable`, `RouteShapeBandsTable`, `RouteShapeMacroVersion` (from `gtfs_prepare_route_cache`)",
                  ],
                ],
              },
            ],
          },
          {
            id: "build",
            title: "Build from source",
            blocks: [
              {
                type: "code",
                lang: "bash",
                code: "git clone --recurse-submodules https://github.com/gabrielAHN/gtfs-duckdb-extension\ncd gtfs-duckdb-extension\nGEN=ninja make\nmake test",
              },
              {
                type: "cards",
                items: [
                  { title: "sql/", body: "The SQL behind every function.", href: extTree("sql") },
                  {
                    title: "src/",
                    body: "Registration and the lifecycle pragmas.",
                    href: extTree("src"),
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "functions",
        title: "Functions",
        summary:
          "All 88 functions by category, each with an example that runs on the MBTA subway feed.",
        sections: [],
      },
    ],
  },
]

export type Release = {
  repo: Part["id"]
  version: string
  title: string
  date: string
  status: "Released" | "In review"
  pr?: number
  highlights: { area: string; text: string }[]
}

export const releases: Release[] = [
  {
    repo: "gtfs-duckdb-extension",
    version: "1.0.0",
    title: "GTFS DuckDB Extension",
    date: "2026-09-28",
    status: "In review",
    pr: 4,
    highlights: [
      { area: "Extension", text: "65 GTFS functions available after `LOAD gtfs`" },
      {
        area: "Extension",
        text: "Explicit `gtfs_prepare`, `gtfs_init` and `gtfs_refresh` lifecycle",
      },
      { area: "Build", text: "Native DuckDB 1.5.4 and DuckDB-WASM 1.4.3 binaries" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "Unreleased",
    title: "Consume the GTFS DuckDB Extension",
    date: "2026-09-28",
    status: "In review",
    pr: 20,
    highlights: [
      { area: "Architecture", text: "Web and CLI call the extension instead of bundling SQL" },
      { area: "Web", text: "Sessions reopen by loading the extension, without a rebuild" },
      { area: "Docs", text: "Separately deployed docs site" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.5.3",
    title: "Parallel route bands",
    date: "2026-09-16",
    status: "Released",
    pr: 19,
    highlights: [
      { area: "Web", text: "Overlapping routes drawn as parallel bands" },
      { area: "CLI", text: "`route-bands` command" },
      { area: "CLI", text: "Updates keep imported feeds and sessions" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.5.2",
    title: "Reroute deep links",
    date: "2026-08-24",
    status: "Released",
    pr: 18,
    highlights: [
      { area: "CLI", text: "`reroute --trip` opens a trip in the reroute form" },
      { area: "Web", text: "Reroute form state kept in the URL" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.5.1",
    title: "Alert editing and trip rerouting",
    date: "2026-08-24",
    status: "Released",
    pr: 17,
    highlights: [
      { area: "Web", text: "Trip rerouting with timetable and map previews" },
      { area: "Web", text: "Edits & Export review of every change" },
      { area: "CLI", text: "Trip, stop-time and calendar edits with batch `apply`" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.5.0",
    title: "Trip compare and trip editing",
    date: "2026-07-22",
    status: "Released",
    pr: 16,
    highlights: [
      { area: "Web", text: "Compare up to 5 trips in timetable, timeline and map" },
      { area: "Web", text: "Stop-time editing with reorder and undo" },
      { area: "CLI", text: "`trips`, `calendar` and `shapes` commands" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.4.0",
    title: "Routes and CLI overhaul",
    date: "2026-06-15",
    status: "Released",
    pr: 15,
    highlights: [
      { area: "Web", text: "Route map and table with editing" },
      { area: "Web", text: "Route shape editor" },
      { area: "CLI", text: "`routes` and `route` commands" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.3.0",
    title: "Monorepo with CLI and DuckDB extension",
    date: "2026-05-01",
    status: "Released",
    pr: 12,
    highlights: [
      { area: "Architecture", text: "Web, CLI and DuckDB extension packages" },
      { area: "CLI", text: "Published to npm with pathway editing and export" },
      { area: "Web", text: "Stop popups and a code-split build" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.2.0",
    title: "Pathways editing",
    date: "2026-04-03",
    status: "Released",
    pr: 8,
    highlights: [
      { area: "Web", text: "Pathways Flow with column and radial views" },
      { area: "Web", text: "Rebuilt pathways editor with inline connection forms" },
      { area: "Web", text: "Export of new pathway connections" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.1.0",
    title: "Editing and export",
    date: "2026-02-19",
    status: "Released",
    pr: 7,
    highlights: [
      { area: "Web", text: "Editing with form validation" },
      { area: "Web", text: "Pathfinding between station parts" },
      { area: "Deploy", text: "Railway deployment" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.0.0",
    title: "First release",
    date: "2026-02-19",
    status: "Released",
    highlights: [
      { area: "Web", text: "Station and stop maps on DuckDB-WASM" },
      { area: "Web", text: "Pathway visualization and station editing" },
      { area: "Web", text: "Export of edited GTFS files" },
    ],
  },
]

export const repoUrl = (repo: Release["repo"]) =>
  repo === "gtfs-viz" ? repos.viz : repos.extension

export const releasesFor = (id: Part["id"]) => releases.filter((release) => release.repo === id)

export const docsBase = "/docs/"

export const releaseSlug = (release: Release) =>
  release.version === "Unreleased" ? "unreleased" : `v${release.version}`

export const versionLabel = (release: Release) =>
  release.version === "Unreleased" ? "Unreleased" : `v${release.version}`

export const partById = (id: string) => parts.find((part) => part.id === id)

export const partPath = (id: Part["id"]) => `${docsBase}${id}/`

export const pagePath = (id: Part["id"], slug: string) => `${docsBase}${id}/${slug}/`

export const pageFile = (id: Part["id"], slug: string) => `${id}/${slug}.md`

export const releasesPath = (id: Part["id"]) => `${docsBase}${id}/releases/`

export const releasePath = (release: Release) =>
  `${releasesPath(release.repo)}${releaseSlug(release)}/`

export const releaseFile = (release: Release) =>
  `${release.repo}/releases/${releaseSlug(release)}.md`

export const pullRequest = (release: Release) =>
  release.pr
    ? { href: `${repoUrl(release.repo)}/pull/${release.pr}`, label: `PR #${release.pr}` }
    : undefined

export const githubRelease = (release: Release) =>
  release.status === "Released"
    ? `${repoUrl(release.repo)}/releases/tag/v${release.version}`
    : undefined
