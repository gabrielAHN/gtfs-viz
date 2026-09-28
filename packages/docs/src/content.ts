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
      "Stations, stops, pathways, routes and trips on maps and tables",
      "Shape editor, trip compare, stop-time editing and rerouting",
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
      "Queries as tables or `--format json` for scripts and agents",
      "Pathway, trip, stop-time and calendar edits with batch `apply`",
      "`install-skill` for Claude Code, Codex, Gemini CLI and Agent Skills",
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
      "65 functions registered at `LOAD`, without touching tables",
      "Explicit lifecycle: `gtfs_prepare`, `gtfs_init`, `gtfs_refresh`",
      "Native DuckDB 1.5.4 and DuckDB-WASM 1.4.3 builds",
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
      "Repository saved with native datasets for reopening",
      "Clear error when no compatible extension is configured",
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
      "Parallel route bands and compared-trip lanes",
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
    body: "One DuckDB extension holds the GTFS logic, so the same functions run in a browser tab, on a laptop or in a cloud job, for a city feed or a national one.",
  },
  {
    title: "Ready for AI",
    body: "Every dashboard action is also a CLI command with JSON output and a SQL function. The Agent Skill lets an agent audit a feed, apply edits from a service alert and export the result.",
  },
  {
    title: "Easy for operators",
    body: "A no-install web app: drop in a GTFS zip, see stations and pathways on a map, fix what is wrong and export CSV. Data stays on the operator's machine.",
  },
]

export type Release = {
  repo: "gtfs-viz" | "gtfs-duckdb-extension"
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
