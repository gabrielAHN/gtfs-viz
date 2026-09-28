export const repos = {
  viz: "https://github.com/gabrielAHN/gtfs-viz",
  extension: "https://github.com/gabrielAHN/gtfs-duckdb-extension",
  app: "https://gtfs-viz-production-f1a4.up.railway.app",
  npm: "https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli",
}

export type Part = {
  id: string
  name: string
  tagline: string
  description: string
  features: string[]
  repo: string
  repoLabel: string
  path?: string
  install: string
}

export const parts: Part[] = [
  {
    id: "web",
    name: "Web App",
    tagline: "Browse, edit and export a feed in the browser",
    description:
      "A React app that loads a GTFS zip into DuckDB-WASM on the user's machine. Nothing is uploaded; maps, tables and editors query the feed locally.",
    features: [
      "Stations, stops, pathways, routes, trips, calendars and shapes on maps and tables",
      "Station pathway graphs and entrance-to-platform shortest paths",
      "Route shape editor, trip compare, stop-time editing and trip rerouting",
      "Edits & Export review that writes changes back to GTFS CSV",
    ],
    repo: repos.viz,
    repoLabel: "gabrielAHN/gtfs-viz",
    path: "packages/web",
    install: "yarn install --ignore-engines && yarn dev",
  },
  {
    id: "cli",
    name: "CLI and Agent Skill",
    tagline: "The same feed from a terminal or an AI agent",
    description:
      "`@gabrielahn/gtfs-viz-cli` imports a feed into a local DuckDB database, answers queries as tables or JSON, applies edits and opens the dashboard. The bundled `gtfs-viz` Agent Skill teaches coding agents the commands, tables and edit workflows.",
    features: [
      "Station, route, trip, calendar and shape queries with `--data` and `--format json`",
      "Pathway, node, trip, stop-time and calendar edits with batch `apply`",
      "GTFS export that merges pending edits with the original feed",
      "`install-skill` for Claude Code, Codex, Gemini CLI and generic Agent Skills",
    ],
    repo: repos.viz,
    repoLabel: "gabrielAHN/gtfs-viz",
    path: "packages/cli",
    install: "npm install -g @gabrielahn/gtfs-viz-cli",
  },
  {
    id: "extension",
    name: "GTFS DuckDB Extension",
    tagline: "The GTFS toolbox as a loadable DuckDB extension",
    description:
      "`gtfs` owns every GTFS database function: normalization, station and route analysis, pathway shortest paths, trip editing and route-shape lane geometry. It is built from the DuckDB extension template for native DuckDB and for DuckDB-WASM.",
    features: [
      "65 functions registered at `LOAD`, without creating or resetting tables",
      "Explicit dataset lifecycle: `gtfs_prepare`, `gtfs_init`, `gtfs_refresh`",
      "Native builds for Linux, macOS and Windows, and browser builds (EH, MVP)",
      "Parity tests against the original SQL and CI on every pull request",
    ],
    repo: repos.extension,
    repoLabel: "gabrielAHN/gtfs-duckdb-extension",
    install: "INSTALL gtfs FROM '<repository>';\nLOAD gtfs;",
  },
  {
    id: "client",
    name: "@gtfs-viz/duckdb-client",
    tagline: "Downloads, loads and calls the extension",
    description:
      "A thin client shared by the web app and CLI. It installs the extension from a configured repository, runs the lifecycle pragmas and moves raw GTFS files into DuckDB. It contains no SQL of its own and has no fallback.",
    features: [
      "`GTFS_EXTENSION_REPOSITORY` for the CLI, `VITE_GTFS_EXTENSION_REPOSITORY` for the web",
      "Repository persisted with native datasets for reopening and the dashboard",
      "Actionable error when no compatible extension is configured",
    ],
    repo: repos.viz,
    repoLabel: "gabrielAHN/gtfs-viz",
    path: "packages/duckdb-client",
    install: "yarn build:client",
  },
  {
    id: "lib",
    name: "@gtfs-viz/lib",
    tagline: "Rendering layers without a database",
    description:
      "Dependency-free route rendering: parallel route bands, compared-trip lanes and the deck.gl route-shape layer. It reads rows produced by the extension and can be reused by any map.",
    features: [
      "Root entry for geometry and colour helpers",
      "`@gtfs-viz/lib/deckgl` for the route-shape layer",
    ],
    repo: repos.viz,
    repoLabel: "gabrielAHN/gtfs-viz",
    path: "packages/lib",
    install: "yarn build:lib",
  },
]

export const goals = [
  {
    title: "Scalable in the cloud",
    body: "The GTFS logic lives in one DuckDB extension, not in the app. The same functions run in a browser tab, on a laptop, or in a server or scheduled cloud job running DuckDB 1.5, so a regional feed or a national one goes through the same code.",
  },
  {
    title: "Ready for AI",
    body: "Everything the dashboard does is available as CLI commands with JSON output and as SQL functions. The Agent Skill describes them, so an agent can audit stations, apply edits from a service alert and export a corrected feed, all through the same commands a person would use.",
  },
  {
    title: "Easy for operators",
    body: "Operators still get a no-install web app: drop in a GTFS zip, see stations and pathways on a map, fix what is wrong and export CSV files. Data stays on their machine.",
  },
]

export type Release = {
  version: string
  repo: "gtfs-viz" | "gtfs-duckdb-extension"
  title: string
  date: string
  status: "Released" | "In review"
  pr: number
  sections: { heading: string; items: string[] }[]
}

export const releases: Release[] = [
  {
    version: "1.0.0",
    repo: "gtfs-duckdb-extension",
    title: "GTFS DuckDB Extension",
    date: "2026-09-28",
    status: "In review",
    pr: 4,
    sections: [
      {
        heading: "Extension",
        items: [
          "65 GTFS functions registered at LOAD, with gtfs_prepare, gtfs_init and gtfs_refresh lifecycle pragmas",
          "Raw-file normalization, geometry, route-cache schema and version functions",
          "Pathway shortest paths, trip editing and route-shape lane geometry used by GTFS Viz",
        ],
      },
      {
        heading: "Build",
        items: [
          "Native binaries against DuckDB v1.5.4: Linux amd64/arm64, macOS amd64/arm64, Windows amd64/MinGW",
          "Browser binaries against DuckDB-WASM v1.4.3: wasm_eh and wasm_mvp",
          "GitHub Actions build, format, test and unsigned development repository staging",
        ],
      },
    ],
  },
  {
    version: "Unreleased",
    repo: "gtfs-viz",
    title: "Consume the GTFS DuckDB Extension",
    date: "2026-09-28",
    status: "In review",
    pr: 20,
    sections: [
      {
        heading: "Architecture",
        items: [
          "Web and CLI download and call the GTFS DuckDB Extension instead of bundling SQL",
          "New @gtfs-viz/duckdb-client and dependency-free @gtfs-viz/lib packages",
          "Architecture test that fails if database code returns to GTFS Viz",
        ],
      },
      {
        heading: "Web",
        items: [
          "Browser sessions reopen by loading the extension without rebuilding",
          "Station and stop tables no longer crash before a row is selected",
        ],
      },
      {
        heading: "Build",
        items: ["GitHub Actions build, check, test and extension integration"],
      },
    ],
  },
  {
    version: "1.5.3",
    repo: "gtfs-viz",
    title: "Parallel route bands",
    date: "2026-09-16",
    status: "Released",
    pr: 19,
    sections: [
      {
        heading: "Web",
        items: [
          "Overlapping routes render as stable parallel bands at close zoom",
          "Compared trips use the same banding, with a stop-to-stop fallback",
          "Separate Route(s) map toggle",
        ],
      },
      {
        heading: "CLI",
        items: [
          "route-bands command",
          "Spatial SQL in one DuckDB process; real DuckDB errors are preserved",
          "Installs and updates keep imported feeds and sessions",
        ],
      },
    ],
  },
  {
    version: "1.5.2",
    repo: "gtfs-viz",
    title: "Reroute deep links",
    date: "2026-08-24",
    status: "Released",
    pr: 18,
    sections: [
      {
        heading: "CLI",
        items: [
          "gtfs-viz reroute --trip opens the selected trip in the reroute form",
          "--url-only and --data for browser-free agent workflows",
        ],
      },
      {
        heading: "Web",
        items: ["URL-backed reroute form state", "Completed reroutes open the edited trip"],
      },
    ],
  },
  {
    version: "1.5.1",
    repo: "gtfs-viz",
    title: "Alert editing, trip rerouting, and Edits & Export",
    date: "2026-08-24",
    status: "Released",
    pr: 17,
    sections: [
      {
        heading: "Web",
        items: [
          "Trip reroute workflow with timetable and map previews",
          "Edits & Export view for reroutes, skipped stops, schedule and service changes",
          "URL-backed pagination across tables",
        ],
      },
      {
        heading: "CLI",
        items: [
          "Trip, stop-time, calendar and calendar-date editing with batch apply",
          "Provider-aware install-skill, version and self-update commands",
        ],
      },
      {
        heading: "Skills",
        items: ["Alert-to-GTFS editing workflow with CLI verification steps"],
      },
    ],
  },
  {
    version: "1.5.0",
    repo: "gtfs-viz",
    title: "Trip compare and trip editing",
    date: "2026-07-22",
    status: "Released",
    pr: 16,
    sections: [
      {
        heading: "Web",
        items: [
          "Compare up to 5 trips across timetable, timeline and map views",
          "Stop-time editing with drag-and-drop reorder and undo/redo",
          "Stop-times export grouped by service",
        ],
      },
      {
        heading: "CLI",
        items: ["trips, calendar and shapes commands", "import starts a dashboard session"],
      },
    ],
  },
  {
    version: "1.4.0",
    repo: "gtfs-viz",
    title: "Routes, CLI overhaul, forms refactor",
    date: "2026-06-15",
    status: "Released",
    pr: 15,
    sections: [
      {
        heading: "Web",
        items: [
          "Route map and table with filters and editing",
          "Route shape editor with undo/reset",
          "Route export with shape change detection",
        ],
      },
      {
        heading: "CLI",
        items: ["routes and route commands with --service, --trip and --compare"],
      },
    ],
  },
]

export const repoUrl = (repo: Release["repo"]) =>
  repo === "gtfs-viz" ? repos.viz : repos.extension
