# @gtfs-viz/docs

Documentation site for GTFS Viz and the GTFS DuckDB Extension, served at `/docs/`.

It reuses the web app's theme, fonts and UI primitives from `packages/web` but imports none of its application code, and the web app does not import this package.

```bash
yarn dev:docs      # http://localhost:5173/docs/
yarn build:docs    # packages/docs/dist
yarn start:docs    # serves dist on $PORT (default 4173)
```

Page content lives in `src/content.ts`. The site has two parts, and the sidebar lists each part's pages:

| Part                  | Pages                                          |
| --------------------- | ---------------------------------------------- |
| GTFS Viz              | How it works, Web app, CLI, AI skill, Releases |
| GTFS DuckDB Extension | Usage, Functions, Releases                     |

Each page lives at `/docs/<part>/<page>/`, and `/docs/<part>/` opens the part's first page. Every page has Docs and Markdown tabs. The function reference comes from `src/functions.ts`, which lists all 88 functions the extension registers, each with an example and the columns it returns on the MBTA subway feed. Every release has its own page at `/docs/<part>/releases/<version>/`. `src/router.tsx` handles client-side navigation, and `server.mjs` serves `index.html` for every page route.

`src/markdown.ts` renders the same content as markdown for agents. The build writes `llms.txt`, `llms-full.txt`, `index.md`, `<part>.md`, `<part>/<page>.md`, `<part>/releases.md` and `<part>/releases/<version>.md` next to `index.html`, and the dev server serves them too.

## Railway

Deploy as its own service in the GTFS Viz project so the web service is untouched:

1. Add a service from the `gabrielAHN/gtfs-viz` repository.
2. Set **Config-as-code path** to `packages/docs/railway.json` and the variable `RAILPACK_CONFIG_FILE=packages/docs/railpack.json`.
3. Leave **Root directory** empty; the build needs the workspace root.
4. Generate a domain. `/` redirects to `/docs/`, and `/healthz` is the health check.

The web service ignores changes under `packages/docs/**`.
