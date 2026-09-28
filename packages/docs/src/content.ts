export const repos = {
  viz: "https://github.com/gabrielAHN/gtfs-viz",
  extension: "https://github.com/gabrielAHN/gtfs-duckdb-extension",
  app: "https://gtfs-viz-production-f1a4.up.railway.app",
  npm: "https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli",
  functions: "https://github.com/gabrielAHN/gtfs-duckdb-extension/blob/main/docs/functions.md",
}

export const intro =
  "GTFS Viz is an open-source toolkit for looking at, fixing and publishing GTFS transit feeds. It has two parts: GTFS Viz, a web app and CLI for people and AI agents, and the GTFS DuckDB Extension, the toolbox of GTFS functions both of them call. The same station, pathway, route and trip logic runs from one operator's laptop up to a cloud pipeline."

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

export type Step = { title: string; body: string; code?: string; lang?: string }

export type Part = {
  id: "gtfs-viz" | "gtfs-duckdb-extension"
  name: string
  tagline: string
  repo: string
  summary: string
  components: { name: string; path: string; body: string }[]
  features: string[]
  howTo: Step[]
}

export const parts: Part[] = [
  {
    id: "gtfs-viz",
    name: "GTFS Viz",
    tagline: "Web app and CLI for operators and AI agents",
    repo: repos.viz,
    summary:
      "The web app and the CLI are two views of the same dataset. The CLI imports a feed into a local DuckDB database and can open the web dashboard on it; the hosted web app loads a feed into DuckDB-WASM in the browser. Both download the GTFS DuckDB Extension and call its functions.",
    components: [
      {
        name: "Web app",
        path: "packages/web",
        body: "Maps and tables for stations, pathways, routes and trips, with editors and GTFS export. Runs in the browser; nothing is uploaded.",
      },
      {
        name: "CLI and Agent Skill",
        path: "packages/cli",
        body: "`@gabrielahn/gtfs-viz-cli`: queries, edits, export and the local dashboard. The bundled `gtfs-viz` skill teaches AI agents the commands.",
      },
      {
        name: "Extension client",
        path: "packages/duckdb-client",
        body: "Installs and loads the extension and runs its lifecycle for both the web app and the CLI. No SQL of its own.",
      },
      {
        name: "Rendering library",
        path: "packages/lib",
        body: "Route bands, compared-trip lanes and the deck.gl route-shape layer.",
      },
    ],
    features: [
      "Stations, stops, pathways, routes and trips on maps and tables",
      "Shape editor, trip compare, stop-time editing and rerouting",
      "Edits & Export review that writes changes back to GTFS CSV",
      "Every view available as a CLI command with `--format json`",
    ],
    howTo: [
      {
        title: "Open a feed in the browser",
        body: "Open the web app and choose **Upload GTFS Zip File**, or pick one from **Example Datasets**. Everything stays on your machine.",
      },
      {
        title: "Install the CLI and import a feed",
        body: "Needs Node 22 and the DuckDB CLI with the `spatial` extension.",
        code: "npm install -g @gabrielahn/gtfs-viz-cli\ngtfs-viz import ./feed.zip\ngtfs-viz status",
        lang: "bash",
      },
      {
        title: "Query stations, routes and trips",
        body: "`--data` prints a table instead of opening the dashboard; `--format json` is for scripts and agents.",
        code: 'gtfs-viz stations --name "Park" --data\ngtfs-viz station "Park Street" --data\ngtfs-viz routes --type Subway --format json',
        lang: "bash",
      },
      {
        title: "Open the dashboard on the same data",
        body: "Starts a local session and opens the web app on the imported feed.",
        code: "gtfs-viz view --view stations/map\ngtfs-viz stop",
        lang: "bash",
      },
      {
        title: "Review edits and export GTFS",
        body: "Export merges pending edits with the original feed and writes GTFS CSV files.",
        code: "gtfs-viz edits\ngtfs-viz export --output ./edited-feed",
        lang: "bash",
      },
      {
        title: "Give an AI agent the skill",
        body: "Installs the `gtfs-viz` Agent Skill for `anthropic`, `openai`, `google` or `generic` agents.",
        code: "gtfs-viz install-skill anthropic\ngtfs-viz install-skill --list-providers",
        lang: "bash",
      },
    ],
  },
  {
    id: "gtfs-duckdb-extension",
    name: "GTFS DuckDB Extension",
    tagline: "The GTFS toolbox as a loadable DuckDB extension",
    repo: repos.extension,
    summary:
      "`gtfs` holds every GTFS database function: normalization, station and route analysis, pathway shortest paths, trip editing and route-shape lane geometry. It is built from the DuckDB extension template for native DuckDB and DuckDB-WASM, so any DuckDB client can use it without GTFS Viz.",
    components: [
      {
        name: "Functions",
        path: "sql",
        body: "65 functions registered at `LOAD`, from `get_station_info` to `find_shortest_path`. See the function reference.",
      },
      {
        name: "Lifecycle",
        path: "src/gtfs_extension.cpp",
        body: "`LOAD` never creates or resets tables. Datasets use `gtfs_prepare`, `gtfs_init` and `gtfs_refresh`.",
      },
      {
        name: "Builds",
        path: ".github/workflows",
        body: "Native DuckDB 1.5.4 for Linux, macOS and Windows; DuckDB-WASM 1.4.3 `wasm_eh` and `wasm_mvp`.",
      },
    ],
    features: [
      "Raw GTFS CSV normalization with `gtfs_normalize_<table>`",
      "Station, pathway, route and trip query functions",
      "Pathway shortest paths and reachable stops",
      "Route-shape lane geometry for parallel route bands",
    ],
    howTo: [
      {
        title: "Install and load",
        body: "Until it is in the DuckDB community repository, install from a repository URL. The `spatial` extension is required.",
        code: "INSTALL spatial;\nLOAD spatial;\nINSTALL gtfs FROM '<repository>';\nLOAD gtfs;",
        lang: "sql",
      },
      {
        title: "Import a feed",
        body: "Load each GTFS file into a `<table>_raw` table and normalize it. Use `PRAGMA gtfs_empty_<table>` for missing optional files.",
        code: "PRAGMA gtfs_prepare;\nCREATE TEMP TABLE stops_raw AS\n  SELECT * FROM read_csv_auto('feed/stops.txt', all_varchar=true);\nPRAGMA gtfs_normalize_stops;\n-- repeat for pathways, routes, trips, stop_times, shapes, calendar, calendar_dates\nPRAGMA gtfs_init;",
        lang: "sql",
      },
      {
        title: "Query stations and pathways",
        body: "Station summaries and reachable pathway nodes, shown with the MBTA feed.",
        code: "SELECT * FROM get_gtfs_data_availability();\nSELECT stop_name, exit_count, pathways_status\n  FROM get_station_info('place-pktrm');\nSELECT reachable_stop, min_time, min_hops\n  FROM find_reachable_stops('place-pktrm', 'door-pktrm-elevatorwb', 120, 3);",
        lang: "sql",
      },
      {
        title: "Edit and refresh",
        body: "Write edits to the `Edit*Table` tables, then refresh. Pending edits are kept and the originals stay untouched.",
        code: "INSERT INTO EditStopTable BY NAME\n  SELECT row_id, stop_id, 'Park Street Station' AS stop_name, stop_lat, stop_lon,\n    location_type_name, parent_station, '' AS level_id, wheelchair_status, 'edit' AS status\n  FROM StationsTable WHERE stop_id = 'place-pktrm';\nPRAGMA gtfs_refresh;\nSELECT stop_name FROM StationsTable WHERE stop_id = 'place-pktrm';",
        lang: "sql",
      },
      {
        title: "Build from source",
        body: "Uses the DuckDB extension template Makefile.",
        code: "git clone --recurse-submodules https://github.com/gabrielAHN/gtfs-duckdb-extension\ncd gtfs-duckdb-extension\nGEN=ninja make\nmake test",
        lang: "bash",
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

export const buildLink = (release: Release) =>
  release.pr
    ? { href: `${repoUrl(release.repo)}/pull/${release.pr}`, label: `PR #${release.pr}` }
    : {
        href: `${repoUrl(release.repo)}/releases/tag/v${release.version}`,
        label: `v${release.version}`,
      }

export const releasesFor = (id: Part["id"]) => releases.filter((release) => release.repo === id)
