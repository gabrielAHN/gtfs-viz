# @gtfs-viz/docs

Documentation site for GTFS Viz and the GTFS DuckDB Extension, served at `/docs/`.

It reuses the web app's theme, fonts and UI primitives from `packages/web` but imports none of its application code, and the web app does not import this package.

```bash
yarn dev:docs      # http://localhost:5173/docs/
yarn build:docs    # packages/docs/dist
yarn start:docs    # serves dist on $PORT (default 4173)
```

Page content lives in `src/content.ts`: project parts, goals and the release list.

## Railway

Deploy as its own service in the GTFS Viz project so the web service is untouched:

1. Add a service from the `gabrielAHN/gtfs-viz` repository.
2. Set **Config-as-code path** to `packages/docs/railway.json` and the variable `RAILPACK_CONFIG_FILE=packages/docs/railpack.json`.
3. Leave **Root directory** empty; the build needs the workspace root.
4. Generate a domain. `/` redirects to `/docs/`, and `/healthz` is the health check.

The web service ignores changes under `packages/docs/**`.
