# @gtfs-viz/duckdb-client

Downloads and loads the [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) extension and moves GTFS files into DuckDB for the web app and CLI. All database functions, normalization and schema live in the extension; this package only calls them.

```sql
INSTALL gtfs FROM '<repository>';
LOAD gtfs;
PRAGMA gtfs_import('<feed directory>');
```

`gtfs_import` reads every GTFS file in the directory, builds the tables and keeps pending edits. The CLI passes its extract directory; the browser registers the files by name and passes `''`.

## Configuration

- CLI: `GTFS_EXTENSION_REPOSITORY=https://…`. Native imports persist the repository in `<database>.extension.json`, so reopened databases and the dashboard load the same extension.
- Web: set `VITE_GTFS_EXTENSION_REPOSITORY` before `dev`/`build`.
- Without configuration only `LOAD gtfs` is attempted from the local extension cache. A missing or incompatible artifact fails with configuration guidance; there is no fallback.
- Signature checks are never relaxed by the app. Unsigned loading is used only inside isolated integration tests.

Browser imports that would skip indexes are rejected until the extension supports selective initialization. Import routes, trips, stop times, shapes and at least one calendar file.

## Tests

```sh
yarn build && yarn run check && yarn test
```

Integration harnesses consume a staged extension repository produced by the extension's `scripts/stage-repository.py`:

```sh
export GTFS_STAGED_REPOSITORY=/path/to/staged-repository
DUCKDB_BIN=/path/to/duckdb-1.5.4 GTFS_DEPENDENCY_CACHE=/path/to/extension-cache \
  node packages/duckdb-client/tests/integration/consumer-native.mjs --cli-e2e
node packages/duckdb-client/tests/integration/consumer-wasm.mjs --unsigned-only
node packages/duckdb-client/tests/integration/consumer-wasm.mjs
node packages/duckdb-client/tests/integration/consumer-app.mjs --missing-config
node packages/duckdb-client/tests/integration/consumer-app.mjs
```

The strict browser run stays red on the known DuckDB-WASM MVP `_setThrew is not defined` error. `tests/architecture.test.mjs` fails if extension SQL, macros or build files reappear in sources or built output.
