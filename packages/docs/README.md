# @gtfs-viz/docs

Documentation site for GTFS Tools (GTFS Viz and GTFS DuckDB), served at `/docs/` by the web app's deployment.

It reuses the web app's theme, fonts and UI primitives from `packages/web` but imports none of its application code, and the web app only links to it. Both read the same saved theme, so light or dark mode carries between the app and the docs.

```bash
yarn dev           # web app on http://localhost:5173/ with the docs at /docs/
yarn dev:docs      # docs alone on http://localhost:4391/docs/
yarn build:docs    # packages/docs/dist
yarn start:docs    # serves dist on $PORT (default 4173)
```

Page content lives in `src/content.ts`. The home page explains the goal and links to the web app and both repositories. Each project has an overview page (`/docs/<part>/`) that says what it does, then its pages and releases:

| Section     | Pages                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| GTFS Viz    | Overview, How it works, Web app, CLI, Releases                                          |
| GTFS DuckDB | Overview, Usage, Functions (Import, Table functions, GTFS functions, Helpers), Releases |
| AI agents   | Agent skill                                                                             |
| Roadmap     | Upcoming features                                                                       |

The sidebar nests every page's sections, the function groups and their categories, and each release. Selecting a page opens its sub-menu, and the releases list scrolls in place. On small screens the same menu opens from the menu button. Pages live at `/docs/<part>/<page>/` and function groups at `/docs/gtfs-duckdb/functions/<group>/`, where `#category-<id>` and `#<function>` open a category or a function. `src/functions.ts` lists the documented functions with an example and the columns each returns on the MBTA subway feed; functions that only serve GTFS Viz's maps (caches, map bounds, filter menus) are left out. `src/router.tsx` handles client-side navigation.

`src/markdown.ts` renders the same content as markdown for agents. The build writes `llms.txt`, `llms-full.txt`, `index.md`, `agent-skill.md`, `upcoming.md`, `<part>.md`, `<part>/<page>.md`, `gtfs-duckdb/functions/<group>.md`, `<part>/releases.md` and `<part>/releases/<version>.md` next to `index.html`, and the dev server serves them too.

## Deployment

The web service builds the docs and serves them from `dist/docs` (root `railpack.json` and `Caddyfile`), so the app is at `/` and the docs at `/docs/` on the same domain. The app's Docs button opens `/docs/` in a new tab unless `VITE_GTFS_DOCS_URL` points elsewhere; CLI dashboards never show it.
