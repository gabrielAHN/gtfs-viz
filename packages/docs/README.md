# @gtfs-viz/docs

Documentation site for GTFS Tools (GTFS Viz, the GTFS Tools CLI and GTFS DuckDB), served at `/docs/` by the web app's deployment. The CLI's code lives in [gabrielAHN/gtfs-tools](https://github.com/gabrielAHN/gtfs-tools); its docs stay here.

It reuses the web app's theme, fonts and UI primitives from `packages/web` but imports none of its application code, and the web app only links to it. Both read the same saved theme, so light or dark mode carries between the app and the docs.

```bash
yarn dev           # web app on http://localhost:5173/ with the docs at /docs/
yarn dev:docs      # docs alone on http://localhost:4391/docs/
yarn build:docs    # packages/docs/dist
yarn start:docs    # serves dist on $PORT (default 4173)
```

Page content lives in `src/content.ts`. The home page explains the goal and links to the web app and the three repositories. Each project has an overview page (`/docs/<part>/`) that says what it does, then its pages and, for the versioned projects, its releases. GTFS Viz has no versions, so it has no releases page:

| Section        | Pages                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| GTFS Viz       | Overview, How it works, Web app                                                         |
| GTFS Tools CLI | Overview, CLI, Releases                                                                 |
| GTFS DuckDB    | Overview, Usage, Functions (Import, Table functions, GTFS functions, Helpers), Releases |
| AI agents      | Agent skill (`gtfs-tools`)                                                              |
| Roadmap        | Upcoming features                                                                       |

The sidebar nests every page's sections, the function groups and their categories, and each release. Selecting a page opens its sub-menu, and the releases list scrolls in place. On small screens the same menu opens from the menu button. Pages live at `/docs/<part>/<page>/` and function groups at `/docs/gtfs-duckdb/functions/<group>/`, where `#category-<id>` and `#<function>` open a category or a function. `src/functions.ts` lists the documented functions with an example and the columns each returns on the MBTA subway feed; functions that only serve GTFS Viz's maps (caches, map bounds, filter menus) are left out. `src/router.tsx` handles client-side navigation. `movedPages` in `src/content.ts` keeps old URLs working: `/docs/gtfs-viz/cli/` renders the CLI page and replaces the address with `/docs/gtfs-tools/cli/`, and `gtfs-viz/cli.md` points to `gtfs-tools/cli.md`. The former GTFS Viz releases page `/docs/gtfs-viz/releases/` opens `/docs/gtfs-tools/releases/`, and each former GTFS Viz release page opens the GTFS Tools CLI release of the same version (its CLI changes) or else that list. CLI releases made before the move set `releasedFrom: "gtfs-viz"`, so their pull request and GitHub release links point to gabrielAHN/gtfs-viz.

`src/markdown.ts` renders the same content as markdown for agents. The build writes `llms.txt`, `llms-full.txt`, `index.md`, `agent-skill.md`, `upcoming.md`, `<part>.md`, `<part>/<page>.md`, `gtfs-duckdb/functions/<group>.md`, `<part>/releases.md` and `<part>/releases/<version>.md` for the versioned parts, and a pointer file for each moved page, next to `index.html`, and the dev server serves them too.

## Deployment

The web service builds the docs and serves them from `dist/docs` (root `railpack.json` and `Caddyfile`), so the app is at `/` and the docs at `/docs/` on the same domain. `yarn build:deploy` builds the app with `VITE_GTFS_DOCS_URL=/docs/` (unless it is already set), so the app's Docs button opens `/docs/` in a new tab. Other builds, including `yarn build:dashboard` (the CLI dashboard that gtfs-tools builds from its gtfs-viz submodule), link to the public docs site; CLI dashboards never show the Docs button.
