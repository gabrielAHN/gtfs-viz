export const repos = {
  viz: "https://github.com/gabrielAHN/gtfs-viz",
  tools: "https://github.com/gabrielAHN/gtfs-tools",
  duckdb: "https://github.com/gabrielAHN/gtfs-duckdb",
  app: "/",
}

export const intro =
  "Open-source tools to explore, fix and publish GTFS transit feeds. GTFS Viz is the app you use, the GTFS Tools CLI does the same from a terminal or an AI agent, and GTFS DuckDB is the engine inside both that any DuckDB can load."

export const goals = [
  {
    title: "Easy for operators",
    body: "Open a GTFS zip in the browser, see stations, pathways, routes and trips on a map, fix what is wrong and export the feed. Nothing to install, and the data stays on your machine.",
  },
  {
    title: "Ready for AI",
    body: "Every action is also a GTFS Tools CLI command with JSON output. The agent skill lets an AI agent audit a feed, turn a service alert into edits and export the result.",
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
  id: "gtfs-viz" | "gtfs-tools" | "gtfs-duckdb"
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
    summary:
      "A web app to explore, fix and export GTFS feeds. It is also the dashboard of the GTFS Tools CLI.",
    does: [
      "Opens a GTFS zip in the browser",
      "Shows stations, pathways, routes and trips on maps and tables",
      "Edits stations, pathways, trips, stop times and calendars",
      "Exports the edited feed as GTFS files",
      "Is the GTFS Tools CLI's dashboard, built from this repository as a git submodule",
    ],
    pages: [
      {
        slug: "how-it-works",
        title: "How it works",
        summary: "One dataset, two ways in: the web app and the GTFS Tools CLI's dashboard.",
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
                    title: "CLI dashboard",
                    body: "The same app opened by the `gtfs-tools` CLI on a feed it imported into native DuckDB. Queries go to the CLI's local API instead of DuckDB-WASM.",
                    href: doc("gtfs-tools", "cli", "#dashboard"),
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
                    body: "`PRAGMA gtfs_import` reads every GTFS file in the feed. The web app registers the zip's files and passes `''`; the CLI passes its extract folder.",
                  },
                  {
                    title: "Build",
                    body: "The same call builds `StationsTable`, `RoutesTable`, `TripsTable` and the merged `*View` views.",
                  },
                  {
                    title: "Explore",
                    body: "Every page calls extension functions such as `get_station_info` or `find_shortest_path`.",
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
                    title: "packages/duckdb-client",
                    body: "Installs and loads the extension and imports feeds with `gtfs_import` for the web app. It has no SQL of its own.",
                    href: doc("gtfs-duckdb", "usage", "#install"),
                  },
                  {
                    title: "packages/lib",
                    body: "Rendering: route bands, compared-trip lanes and the deck.gl route-shape layer.",
                    href: doc("gtfs-viz", "web", "#pages"),
                  },
                  {
                    title: "packages/docs",
                    body: "This site, with the GTFS Viz, GTFS Tools CLI and GTFS DuckDB docs.",
                    href: "/docs/",
                  },
                  {
                    title: "gtfs-tools",
                    body: "The CLI and its agent skill live in their own repository, gabrielAHN/gtfs-tools.",
                    href: doc("gtfs-tools", "cli"),
                  },
                ],
              },
            ],
          },
          {
            id: "cli-dashboard",
            title: "CLI dashboard",
            blocks: [
              {
                type: "text",
                text: "The GTFS Tools CLI opens this web app as its dashboard. gtfs-tools includes gtfs-viz as a git submodule and builds the dashboard from it when it builds its npm package, so the dashboard works offline. `yarn build:dashboard` is the build it runs.",
              },
              {
                type: "code",
                lang: "bash",
                code: "yarn build:dashboard   # packages/web/dist with dashboard-manifest.json",
              },
              {
                type: "list",
                items: [
                  "The app is built for CLI mode: the extension repository comes from the CLI, and docs links go to the public docs site.",
                  "`dashboard-manifest.json` names the commit and the CLI API version; gtfs-tools only bundles a dashboard with `cliApi: 1`. GTFS Viz has no versions: the commit identifies the build.",
                  "gtfs-tools moves to a newer GTFS Viz by moving its submodule pin.",
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
    ],
  },
  {
    id: "gtfs-tools",
    name: "GTFS Tools CLI",
    tagline: "GTFS feeds from a terminal",
    repo: repos.tools,
    summary:
      "The `gtfs-tools` CLI imports a GTFS feed into native DuckDB, queries, edits and exports it, and opens the GTFS Viz dashboard on it.",
    does: [
      "Imports a GTFS zip from a path, an `https://` URL or an `s3://` or `r2://` object",
      "Lists and filters stations, stops, routes, trips and calendars, with JSON output",
      "Edits trips, stop times, calendars, stations and pathways, and exports the feed",
      "Opens the GTFS Viz dashboard on the imported feed, bundled for offline use",
      "Teaches AI agents the same commands through the `gtfs-tools` agent skill",
    ],
    pages: [
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
                text: "Needs Node 22 and the DuckDB CLI with the `spatial` extension. The CLI is developed in gabrielAHN/gtfs-tools and published as `@gabrielahn/gtfs-tools` (command `gtfs-tools`).",
              },
              {
                type: "code",
                lang: "bash",
                code: "npm install -g @gabrielahn/gtfs-tools\ngtfs-tools version\ngtfs-tools update --check",
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
                code: "gtfs-tools import /absolute/path/to/feed.zip\ngtfs-tools import https://example.com/gtfs/feed.zip\ngtfs-tools import s3://my-bucket/gtfs/feed.zip\ngtfs-tools status\ngtfs-tools tables",
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
                code: 'gtfs-tools stations --name "Park" --data\ngtfs-tools station "Park Street" --data\ngtfs-tools station_pathways "Park Street" --data\ngtfs-tools routes --type Subway --format json\ngtfs-tools trips --route Red --data\ngtfs-tools trip canonical-Red-C1-0 --data\ngtfs-tools calendar --data\ngtfs-tools query --sql "SELECT stop_name, exit_count FROM get_station_info(\'place-pktrm\')"',
              },
            ],
          },
          {
            id: "dashboard",
            title: "Dashboard",
            blocks: [
              {
                type: "text",
                text: "Start a local session and open the GTFS Viz dashboard on the imported feed. `--url-only` prints the link instead. The dashboard is the GTFS Viz web app, built from the gtfs-viz submodule and bundled in the package, so it works offline.",
              },
              {
                type: "code",
                lang: "bash",
                code: "gtfs-tools view --view stations/map\ngtfs-tools trip canonical-Red-C1-0 --compare canonical-Red-C1-1 --url-only\ngtfs-tools stop",
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
                code: 'gtfs-tools update_trip --trip-id canonical-Red-C1-0 --headsign "Alewife Express"\ngtfs-tools remove_stops --trip canonical-Red-C1-0 --stops "Davis,Porter"\ngtfs-tools reroute --trip <trip_id> --via <donor_trip_id> --from "<station>" --to "<station>"\ngtfs-tools apply changeset.json\ngtfs-tools edits --data',
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
                code: "gtfs-tools export --output ./edited-feed\ngtfs-tools export --output ./edited-feed --no-pathways",
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
                code: "gtfs-tools route-bands --data\ngtfs-tools route-bands --status --data",
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
                  ["`gtfs-tools stop`", "Stop the dashboard session"],
                  ["`gtfs-tools restart`", "Stop the session and remove the local import"],
                  ["`gtfs-tools clean`", "Stop the daemon and delete `~/.gtfs-viz-cli/`"],
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
                  ["Native", "2.0.0", "Linux amd64/arm64, macOS amd64/arm64, Windows amd64/MinGW"],
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
                text: "Native builds install from the DuckDB community repository and need DuckDB 2.0.0. The `spatial` extension is required. The browser build for DuckDB-WASM 1.4.3 installs from a repository URL, such as the `/extensions/` path GTFS Viz serves.",
              },
              {
                type: "code",
                lang: "sql",
                code: "INSTALL spatial;\nLOAD spatial;\nINSTALL gtfs FROM community;\nLOAD gtfs;",
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
    "The `gtfs-tools` agent skill teaches an AI agent to drive the GTFS Tools CLI. Here is what it covers, by category.",
  sections: [
    {
      id: "install",
      title: "Install",
      blocks: [
        { type: "code", lang: "bash", code: "npx skills add gabrielAHN/gtfs-tools" },
        {
          type: "text",
          text: "The skill now ships with gabrielAHN/gtfs-tools and replaces `npx skills add gabrielAHN/gtfs-viz`; GTFS Viz no longer contains a skill. Installing `@gabrielahn/gtfs-tools` also installs it, or install it for one agent:",
        },
        {
          type: "code",
          lang: "bash",
          code: "npm install -g @gabrielahn/gtfs-tools\ngtfs-tools install-skill anthropic\ngtfs-tools install-skill --list-providers",
        },
        {
          type: "table",
          head: ["Provider", "Agents", "Installs to"],
          rows: [
            ["`anthropic`", "Claude Code", "`~/.claude/skills/gtfs-tools`"],
            ["`openai`", "Codex", "`~/.codex/skills/gtfs-tools`"],
            ["`google`", "Gemini CLI", "`~/.gemini/skills/gtfs-tools`"],
            ["`generic`", "Agents that read the shared folder", "`~/.agents/skills/gtfs-tools`"],
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
                ["Import a feed", "`gtfs-tools import /abs/path/feed.zip`"],
                [
                  "Import from a URL or bucket",
                  "`gtfs-tools import https://example.com/gtfs/feed.zip` or `s3://my-bucket/gtfs/feed.zip`",
                ],
                ["Check the loaded feed", "`gtfs-tools status`"],
                ["Update the CLI", "`gtfs-tools update`"],
                ["Help for one command", "`gtfs-tools h <command>`"],
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
                ["Filter stations", "`gtfs-tools stations --pathways no --data`"],
                ["Look up a station", '`gtfs-tools station "Park Street" --data`'],
                ["Station pathways", '`gtfs-tools station_pathways "Park Street" --data`'],
                ["Routes and one route", "`gtfs-tools routes --type Subway --data`"],
                ["A trip's stop times", "`gtfs-tools trip canonical-Red-C1-0 --data`"],
                ["Calendars and shapes", "`gtfs-tools calendar --data`"],
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
                [
                  "Times between station parts",
                  '`gtfs-tools station_routes "South Station" --data`',
                ],
                [
                  "Fastest entrance to exit",
                  '`gtfs-tools station_shortest_route "South Station" --data`',
                ],
                ["Build route line bands", "`gtfs-tools route-bands`"],
                ["Run SQL", '`gtfs-tools query --sql "SELECT * FROM StationsTable"`'],
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
                [
                  "Add a pathway",
                  "`gtfs-tools add_connection --from A --to B --traversal-time 45`",
                ],
                [
                  "Add a station part",
                  "`gtfs-tools add_node --stop-id ID --lat .. --lon .. --parent-station ID`",
                ],
                [
                  "Change a trip",
                  '`gtfs-tools update_trip --trip-id canonical-Red-C1-0 --headsign "Express"`',
                ],
                ["Skip stops", '`gtfs-tools remove_stops --trip ID --stops "Park Street"`'],
                [
                  "Run a trip via another route",
                  "`gtfs-tools reroute --trip ID --via DONOR --from A --to B`",
                ],
                ["Many edits at once", "`gtfs-tools apply changeset.json`"],
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
                ["Dashboard link", "`gtfs-tools view --view stations/map --url-only`"],
                ["Review pending edits", "`gtfs-tools edits --url-only`"],
                ["Export GTFS files", "`gtfs-tools export --output ./out`"],
                ["Remove local data", "`gtfs-tools clean`"],
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
            "Check the loaded feed with `gtfs-tools status`; feeds expire after 7 days.",
          ],
        },
      ],
    },
  ],
}

export type Release = {
  repo: Exclude<Part["id"], "gtfs-viz">
  version: string
  title: string
  date: string
  status: "Released" | "In review"
  pr?: number
  // CLI releases made before the CLI moved to gtfs-tools: their pull request and GitHub release
  // are in gabrielAHN/gtfs-viz.
  releasedFrom?: "gtfs-viz"
  // false for a version that only went to npm, with no GitHub release.
  tagged?: boolean
  highlights: { area: string; text: string }[]
}

export const releases: Release[] = [
  {
    repo: "gtfs-duckdb",
    version: "1.0.2",
    title: "Community extension",
    date: "2026-11-02",
    status: "Released",
    pr: 7,
    highlights: [
      { area: "Install", text: "`INSTALL gtfs FROM community` installs the signed build" },
      {
        area: "Build",
        text: "Native DuckDB 2.0.0 binaries; browser builds stay on DuckDB-WASM 1.4.3",
      },
      { area: "Extension", text: "Same 96 functions as 1.0.1" },
    ],
  },
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
    repo: "gtfs-tools",
    version: "1.5.5",
    title: "One npm package",
    date: "2026-11-05",
    status: "Released",
    pr: 2,
    highlights: [
      {
        area: "Install",
        text: "`@gabrielahn/gtfs-tools` is the only package; the compatibility package is removed",
      },
      { area: "npm", text: "The CLI's former npm name is deprecated and points here" },
      {
        area: "Dashboard",
        text: "Accepts dashboard manifests without a version; messages show the commit",
      },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.5.4",
    title: "Moved from GTFS Viz",
    date: "2026-11-04",
    status: "Released",
    pr: 1,
    highlights: [
      {
        area: "Move",
        text: "The CLI moves from gabrielAHN/gtfs-viz to `@gabrielahn/gtfs-tools`, command `gtfs-tools`",
      },
      {
        area: "Import",
        text: "`import` takes an `https://` URL or an `s3://` or `r2://` object; buckets use DuckDB secrets",
      },
      {
        area: "Extension",
        text: "Calls GTFS DuckDB instead of bundled SQL, and imports feeds with `gtfs_import`",
      },
      {
        area: "Extension",
        text: "Installs `gtfs` from the DuckDB community repository by default",
      },
      {
        area: "Dashboard",
        text: "Bundles the GTFS Viz dashboard, built from the gtfs-viz submodule; it works offline",
      },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.5.3",
    title: "Route bands",
    date: "2026-09-16",
    status: "Released",
    pr: 19,
    releasedFrom: "gtfs-viz",
    highlights: [
      { area: "CLI", text: "`route-bands` builds parallel route-line bands for the dashboard" },
      { area: "CLI", text: "Updates keep imported feeds and sessions" },
      { area: "CLI", text: "Spatial SQL runs in one DuckDB process" },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.5.2",
    title: "Reroute deep links",
    date: "2026-08-24",
    status: "Released",
    pr: 18,
    releasedFrom: "gtfs-viz",
    highlights: [
      { area: "CLI", text: "`reroute --trip` opens a trip in the reroute form" },
      { area: "CLI", text: "Applying a reroute returns to the edited trip" },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.5.1",
    title: "Trip and calendar editing",
    date: "2026-08-24",
    status: "Released",
    pr: 17,
    releasedFrom: "gtfs-viz",
    highlights: [
      { area: "CLI", text: "Trip, stop-time and calendar edits with batch `apply`" },
      { area: "CLI", text: "`reroute`, `remove_stops`, `truncate_trip` and `split_trip`" },
      { area: "CLI", text: "`version`, `update` and `install-skill` for each AI provider" },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.5.0",
    title: "Trips, calendars and shapes",
    date: "2026-07-22",
    status: "Released",
    pr: 16,
    releasedFrom: "gtfs-viz",
    highlights: [
      { area: "CLI", text: "`trips`, `trip`, `calendar` and `shapes` commands" },
      { area: "CLI", text: "`import` starts a dashboard session" },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.4.0",
    title: "Routes commands",
    date: "2026-06-15",
    status: "Released",
    pr: 15,
    releasedFrom: "gtfs-viz",
    highlights: [
      {
        area: "CLI",
        text: "`routes` and `route` commands with `--service`, `--trip` and `--compare`",
      },
      { area: "CLI", text: "Commands open the dashboard by default; `--data` prints a table" },
      { area: "CLI", text: "Help for each command and view, such as `routes service -h`" },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.3.2",
    title: "Bundled extension SQL",
    date: "2026-05-04",
    status: "Released",
    releasedFrom: "gtfs-viz",
    tagged: false,
    highlights: [{ area: "CLI", text: "The extension SQL is embedded; nothing else to install" }],
  },
  {
    repo: "gtfs-tools",
    version: "1.3.1",
    title: "GTFS DuckDB extension",
    date: "2026-05-01",
    status: "Released",
    releasedFrom: "gtfs-viz",
    tagged: false,
    highlights: [
      { area: "CLI", text: "Loads the GTFS DuckDB extension package instead of SQL procedures" },
      { area: "Skills", text: "The skill's reference files move to `references/`" },
    ],
  },
  {
    repo: "gtfs-tools",
    version: "1.3.0",
    title: "First npm release",
    date: "2026-05-01",
    status: "Released",
    pr: 12,
    releasedFrom: "gtfs-viz",
    highlights: [
      { area: "Install", text: "Published to npm under the CLI's former npm name" },
      { area: "CLI", text: "Pathway and station-part editing, and `export` to GTFS files" },
      { area: "CLI", text: "Station and stop filters, `examples` and `clean`" },
      { area: "Skills", text: "Agent skill installed with `install-skill`" },
    ],
  },
]

const repoUrls: Record<Part["id"], string> = {
  "gtfs-viz": repos.viz,
  "gtfs-tools": repos.tools,
  "gtfs-duckdb": repos.duckdb,
}

export const repoUrl = (repo: Part["id"]) => repoUrls[repo]

export const releasesFor = (id: Part["id"]) => releases.filter((release) => release.repo === id)

// GTFS Viz has no versions, so its part has no releases page.
export const hasReleases = (id: Part["id"]) => releasesFor(id).length > 0

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

export const releasesPath = (id: Part["id"]) => `${docsBase}${id}/releases/`

export const releasePath = (release: Release) =>
  `${releasesPath(release.repo)}${releaseSlug(release)}/`

export const releaseFile = (release: Release) =>
  `${release.repo}/releases/${releaseSlug(release)}.md`

export type MovedPage = { from: string; to: string; title: string }

// GTFS Viz release pages that existed before GTFS Viz dropped its versions. Each opens the GTFS
// Tools CLI release of the same version, which holds the CLI changes it shipped, or else the GTFS
// Tools CLI release list.
const formerVizReleases = [
  "1.6.0",
  "1.5.4",
  "1.5.3",
  "1.5.2",
  "1.5.1",
  "1.5.0",
  "1.4.0",
  "1.3.0",
  "1.2.0",
  "1.1.0",
  "1.0.0",
]

const formerVizRelease = (version: string): MovedPage => {
  const release = releasesFor("gtfs-tools").find((item) => item.version === version)
  return {
    from: `gtfs-viz/releases/v${version}`,
    to: release ? releaseFile(release).replace(/\.md$/, "") : "gtfs-tools/releases",
    title: release ? `GTFS Tools CLI v${version}` : "GTFS Tools CLI releases",
  }
}

// Pages that moved. The old URL renders the new page and is replaced in the address bar; the old
// markdown file points to the new one. `from` and `to` are paths under the docs root.
export const movedPages: MovedPage[] = [
  { from: "gtfs-viz/cli", to: "gtfs-tools/cli", title: "GTFS Tools CLI: CLI" },
  { from: "gtfs-viz/releases", to: "gtfs-tools/releases", title: "GTFS Tools CLI releases" },
  ...formerVizReleases.map(formerVizRelease),
]

export const movedPagePath = (pathname: string) => {
  const moved = movedPages.find((page) => `${docsBase}${page.from}/` === pathname)
  return moved ? `${docsBase}${moved.to}/` : undefined
}

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

// The repository a release was made from: gtfs-viz for CLI releases from before the move.
const releaseRepo = (release: Release) => release.releasedFrom ?? release.repo

export const pullRequest = (release: Release) =>
  release.pr
    ? {
        href: `${repoUrl(releaseRepo(release))}/pull/${release.pr}`,
        label: release.releasedFrom
          ? `${release.releasedFrom} PR #${release.pr}`
          : `PR #${release.pr}`,
      }
    : undefined

export const githubRelease = (release: Release) =>
  release.status === "Released" && release.tagged !== false
    ? `${repoUrl(releaseRepo(release))}/releases/tag/v${release.version}`
    : undefined
