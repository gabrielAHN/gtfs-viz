export const repos = {
  viz: "https://github.com/gabrielAHN/gtfs-viz",
  duckdb: "https://github.com/gabrielAHN/gtfs-duckdb",
  app: "/",
}

export const intro =
  "Open-source tools to explore, fix and publish GTFS transit feeds. GTFS Viz is the app you use; GTFS DuckDB is the engine inside it that any DuckDB can load."

export const goals = [
  {
    title: "Easy for operators",
    body: "Open a GTFS zip in the browser, see stations, pathways, routes and trips on a map, fix what is wrong and export the feed. Nothing to install, and the data stays on your machine.",
  },
  {
    title: "Ready for AI",
    body: "Every action is also a CLI command with JSON output. The agent skill lets an AI agent audit a feed, turn a service alert into edits and export the result.",
  },
  {
    title: "Scalable in the cloud",
    body: "The GTFS logic lives in one DuckDB extension, so the same functions run in a browser tab, on a laptop or in a cloud job, for a city feed or a national one.",
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

export type Section = { id: string; title: string; blocks: Block[]; sub?: Section[] }

export type DocPage = {
  slug: string
  title: string
  summary: string
  sections: Section[]
}

export type Part = {
  id: "gtfs-viz" | "gtfs-duckdb"
  name: string
  tagline: string
  repo: string
  summary: string
  does: string[]
  pages: DocPage[]
}

const doc = (part: string, slug: string, hash = "") => `/docs/${part}/${slug}/${hash}`

export const functionsPath = (group?: string) =>
  `/docs/gtfs-duckdb/functions/${group ? `${group}/` : ""}`

export const parts: Part[] = [
  {
    id: "gtfs-viz",
    name: "GTFS Viz",
    tagline: "Explore and edit GTFS feeds",
    repo: repos.viz,
    summary: "A web app and CLI to explore, fix and export GTFS feeds.",
    does: [
      "Opens a GTFS zip in the browser or from a terminal",
      "Shows stations, pathways, routes and trips on maps and tables",
      "Edits stations, pathways, trips, stop times and calendars",
      "Exports the edited feed as GTFS files",
      "Gives AI agents the same commands through the CLI and an agent skill",
    ],
    pages: [
      {
        slug: "how-it-works",
        title: "How it works",
        summary: "One dataset, two ways in: the web app and the CLI.",
        sections: [
          {
            id: "overview",
            title: "Overview",
            blocks: [
              {
                type: "text",
                text: "GTFS Viz loads a GTFS zip into DuckDB, calls GTFS DuckDB to build station, route and trip tables, and shows them as maps and tables. Edits are stored next to the original feed and merged back into GTFS CSV on export.",
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
                    body: "`PRAGMA gtfs_import` reads every GTFS file in the feed. The CLI passes its extract folder; the web app registers the zip's files and passes `''`.",
                  },
                  {
                    title: "Build",
                    body: "The same call builds `StationsTable`, `RoutesTable`, `TripsTable` and the merged `*View` views.",
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
                    href: doc("gtfs-viz", "web"),
                  },
                  {
                    title: "packages/cli",
                    body: "`@gabrielahn/gtfs-viz-cli` and the bundled `gtfs-viz` agent skill.",
                    href: doc("gtfs-viz", "cli"),
                  },
                  {
                    title: "packages/duckdb-client",
                    body: "Installs and loads the extension and imports feeds with `gtfs_import` for the web app and the CLI. It has no SQL of its own.",
                    href: doc("gtfs-duckdb", "usage", "#install"),
                  },
                  {
                    title: "packages/lib",
                    body: "Rendering: route bands, compared-trip lanes and the deck.gl route-shape layer.",
                    href: doc("gtfs-viz", "web", "#pages"),
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
                items: [
                  { title: "Open the web app", body: "Opens GTFS Viz at `/`.", href: repos.app },
                ],
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
    ],
  },
  {
    id: "gtfs-duckdb",
    name: "GTFS DuckDB",
    tagline: "GTFS functions for DuckDB",
    repo: repos.duckdb,
    summary: "A DuckDB extension that turns a GTFS feed into queryable tables and functions.",
    does: [
      "Imports a GTFS folder with one call",
      "Builds station, stop, route and trip tables",
      "Answers questions about stations, pathways, routes and trips in SQL",
      "Finds paths through a station's pathways",
      "Runs anywhere DuckDB runs: browser, laptop or cloud",
    ],
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
                text: "A DuckDB extension, `gtfs`, built from the DuckDB extension template. `LOAD gtfs` registers its functions; loading never creates or resets tables, the import and lifecycle pragmas do. These docs cover the 63 functions for working with GTFS data. The other 33 are internal: GTFS Viz's maps, such as route-band caches, map bounds and filter menus, and the colour helpers behind `gtfs_hex_to_hue`.",
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
                    title: "Import",
                    body: "Read a feed folder and build every table. `stops.txt` is required; missing optional files become empty tables. Run it again to replace the feed; pending edits are kept.",
                    code: "PRAGMA gtfs_import('feed');",
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
                    "Built by `gtfs_import`",
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
                    "`RouteShapeLanesTable`, `RouteShapeBandsTable`, `RouteShapeMacroVersion`, built by GTFS Viz for its route maps",
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
                code: "git clone --recurse-submodules https://github.com/gabrielAHN/gtfs-duckdb\ncd gtfs-duckdb\nGEN=ninja make\nmake test",
              },
              {
                type: "cards",
                items: [
                  {
                    title: "Functions",
                    body: "Every documented function, with a runnable example.",
                    href: doc("gtfs-duckdb", "functions"),
                  },
                  {
                    title: "Import",
                    body: "`gtfs_import`, `gtfs_refresh` and the steps they run.",
                    href: doc("gtfs-duckdb", "functions/import"),
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
          "Every function for working with GTFS data, in five groups, each with an example that runs on the MBTA subway feed.",
        sections: [],
      },
    ],
  },
]

export const agentPage: DocPage = {
  slug: "agents",
  title: "Agent skill",
  summary:
    "The `gtfs-viz` agent skill teaches an AI agent to drive the GTFS Viz CLI. Here is what it covers, by category.",
  sections: [
    {
      id: "install",
      title: "Install",
      blocks: [
        { type: "code", lang: "bash", code: "npx skills add gabrielAHN/gtfs-viz" },
        { type: "text", text: "Or install it from the CLI for one agent:" },
        {
          type: "code",
          lang: "bash",
          code: "npm install -g @gabrielahn/gtfs-viz-cli\ngtfs-viz install-skill anthropic\ngtfs-viz install-skill --list-providers",
        },
        {
          type: "table",
          head: ["Provider", "Agents", "Installs to"],
          rows: [
            ["`anthropic`", "Claude Code", "`~/.claude/skills/gtfs-viz`"],
            ["`openai`", "Codex", "`~/.codex/skills/gtfs-viz`"],
            ["`google`", "Gemini CLI", "`~/.gemini/skills/gtfs-viz`"],
            ["`generic`", "Agents that read the shared folder", "`~/.agents/skills/gtfs-viz`"],
          ],
        },
      ],
    },
    {
      id: "teaches",
      title: "What SKILL.md teaches",
      blocks: [
        {
          type: "text",
          text: "`SKILL.md` loads when a task mentions GTFS data. It groups the CLI into five categories.",
        },
      ],
      sub: [
        {
          id: "setup",
          title: "Setup",
          blocks: [
            { type: "text", text: "Load a feed and check what is loaded." },
            {
              type: "table",
              head: ["Task", "Command"],
              rows: [
                ["Import a feed", "`gtfs-viz import /abs/path/feed.zip`"],
                ["Check the loaded feed", "`gtfs-viz status`"],
                ["Update the CLI", "`gtfs-viz update`"],
                ["Help for one command", "`gtfs-viz h <command>`"],
              ],
            },
          ],
        },
        {
          id: "explore",
          title: "Explore",
          blocks: [
            { type: "text", text: "Browse stations, stops, routes, trips, calendars and shapes." },
            {
              type: "table",
              head: ["Task", "Command"],
              rows: [
                ["Filter stations", "`gtfs-viz stations --pathways no --data`"],
                ["Look up a station", '`gtfs-viz station "Park Street" --data`'],
                ["Station pathways", '`gtfs-viz station_pathways "Park Street" --data`'],
                ["Routes and one route", "`gtfs-viz routes --type Subway --data`"],
                ["A trip's stop times", "`gtfs-viz trip canonical-Red-C1-0 --data`"],
                ["Calendars and shapes", "`gtfs-viz calendar --data`"],
              ],
            },
          ],
        },
        {
          id: "analyze",
          title: "Analyze",
          blocks: [
            {
              type: "text",
              text: "Pathfinding inside stations, route line bands and SQL against the feed.",
            },
            {
              type: "table",
              head: ["Task", "Command"],
              rows: [
                ["Times between station parts", '`gtfs-viz station_routes "South Station" --data`'],
                [
                  "Fastest entrance to exit",
                  '`gtfs-viz station_shortest_route "South Station" --data`',
                ],
                ["Build route line bands", "`gtfs-viz route-bands`"],
                ["Run SQL", '`gtfs-viz query --sql "SELECT * FROM StationsTable"`'],
              ],
            },
          ],
        },
        {
          id: "edit",
          title: "Edit",
          blocks: [
            {
              type: "text",
              text: "Change pathways, station parts, trips, stop times and calendars. For a service alert the agent reads the alert, checks the affected trips, applies edits and reviews them.",
            },
            {
              type: "table",
              head: ["Task", "Command"],
              rows: [
                ["Add a pathway", "`gtfs-viz add_connection --from A --to B --traversal-time 45`"],
                [
                  "Add a station part",
                  "`gtfs-viz add_node --stop-id ID --lat .. --lon .. --parent-station ID`",
                ],
                [
                  "Change a trip",
                  '`gtfs-viz update_trip --trip-id canonical-Red-C1-0 --headsign "Express"`',
                ],
                ["Skip stops", '`gtfs-viz remove_stops --trip ID --stops "Park Street"`'],
                [
                  "Run a trip via another route",
                  "`gtfs-viz reroute --trip ID --via DONOR --from A --to B`",
                ],
                ["Many edits at once", "`gtfs-viz apply changeset.json`"],
              ],
            },
            {
              type: "code",
              lang: "json",
              code: '{\n  "ops": [\n    { "op": "trip.update", "trip_id": "canonical-Red-C1-0", "trip_headsign": "Alewife Express" }\n  ]\n}',
            },
          ],
        },
        {
          id: "share",
          title: "Share",
          blocks: [
            {
              type: "text",
              text: "Open results in the dashboard, review edits and export the feed.",
            },
            {
              type: "table",
              head: ["Task", "Command"],
              rows: [
                ["Dashboard link", "`gtfs-viz view --view stations/map --url-only`"],
                ["Review pending edits", "`gtfs-viz edits --url-only`"],
                ["Export GTFS files", "`gtfs-viz export --output ./out`"],
                ["Remove local data", "`gtfs-viz clean`"],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "rules",
      title: "Agent rules",
      blocks: [
        {
          type: "list",
          items: [
            "Use absolute paths and quote paths with spaces.",
            "Return the printed dashboard link unless the user asked for `--data`.",
            "Check the loaded feed with `gtfs-viz status`; feeds expire after 7 days.",
          ],
        },
      ],
    },
  ],
}

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
    repo: "gtfs-duckdb",
    version: "1.0.1",
    title: "Sonification",
    date: "2026-10-05",
    status: "Released",
    pr: 5,
    highlights: [
      { area: "Extension", text: "96 functions available after `LOAD gtfs`, up from 89" },
      {
        area: "For fun",
        text: "`gtfs_sonify_stops` gives every stop served on a day a note from its place in the network",
      },
      {
        area: "For fun",
        text: "`gtfs_sonify_events` turns every departure into its stop's note; a route filter returns its part of the whole",
      },
      {
        area: "For fun",
        text: "Both pick the day's services from `calendar` and `calendar_dates`",
      },
      {
        area: "For fun",
        text: "`gtfs_note_midi`, `gtfs_midi_to_hz` and `gtfs_hex_to_hue` helpers",
      },
    ],
  },
  {
    repo: "gtfs-duckdb",
    version: "1.0.0",
    title: "First release",
    date: "2026-09-29",
    status: "Released",
    pr: 4,
    highlights: [
      { area: "Extension", text: "89 GTFS functions available after `LOAD gtfs`" },
      { area: "Extension", text: "`gtfs_import` loads a whole feed folder in one call" },
      {
        area: "Extension",
        text: "Explicit `gtfs_prepare`, `gtfs_init` and `gtfs_refresh` lifecycle",
      },
      { area: "Build", text: "Native DuckDB 1.5.4 and DuckDB-WASM 1.4.3 binaries" },
    ],
  },
  {
    repo: "gtfs-viz",
    version: "1.5.4",
    title: "Consume GTFS DuckDB",
    date: "2026-09-29",
    status: "Released",
    pr: 20,
    highlights: [
      { area: "Architecture", text: "Web and CLI call the extension instead of bundling SQL" },
      { area: "Web", text: "Sessions reopen by loading the extension, without a rebuild" },
      { area: "Import", text: "Web and CLI import feeds through `gtfs_import`" },
      { area: "Docs", text: "Docs at `/docs/`, linked from the app header" },
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

export const repoUrl = (repo: Release["repo"]) => (repo === "gtfs-viz" ? repos.viz : repos.duckdb)

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

export const partFile = (id: Part["id"]) => `${id}.md`

export const groupFile = (group: string) => `gtfs-duckdb/functions/${group}.md`

export const agentPath = `${docsBase}agents/`

export const agentFile = "agent-skill.md"

export const upcomingPath = `${docsBase}upcoming/`

export const upcomingFile = "upcoming.md"

export type UpcomingFeature = { id: string; title: string; description: string; category: string }

export const upcoming = {
  title: "Upcoming features",
  summary:
    "Features planned for future releases. Help us prioritize by voting and discussing in our GitHub repository!",
  ideas: "Have ideas for new features? Join the discussion and help shape the future of GTFS Viz!",
  discussions: `${repos.viz}/discussions`,
  issues: `${repos.viz}/issues/new`,
  features: [
    {
      id: "trip-analysis",
      title: "Trip Analysis",
      description:
        "Compare trips side by side with service diagrams showing local vs express patterns, shared stops, and directional service",
      category: "Analysis",
    },
    {
      id: "data-editing",
      title: "Improved Data Editing",
      description:
        "Edit stations, pathways, trips, and calendars in bulk with inline validation, undo history, and before and after previews of every change",
      category: "Editing",
    },
    {
      id: "cloud-integration",
      title: "Cloud Integration",
      description:
        "Open and save GTFS feeds from cloud storage with scheduled imports, shared datasets, and GTFS DuckDB functions running in cloud pipelines",
      category: "Cloud",
    },
  ] as UpcomingFeature[],
}

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
