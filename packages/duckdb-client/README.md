# @gtfs-viz/duckdb-client

Downloads and loads the [GTFS DuckDB](https://github.com/gabrielAHN/gtfs-duckdb) extension and moves GTFS files into DuckDB for the web app, including its CLI dashboard mode. All database functions, normalization and schema live in the extension; this package only calls them. The [gtfs-tools](https://github.com/gabrielAHN/gtfs-tools) CLI carries its own copy of the native parts.

```sql
INSTALL gtfs FROM '<repository>';  -- or: INSTALL gtfs FROM community
LOAD gtfs;
PRAGMA gtfs_import('<feed directory>');
```

`gtfs_import` reads every GTFS file in the directory, builds the tables and keeps pending edits. Native consumers pass their extract directory; the browser registers the files by name and passes `''`.

## Configuration

- Native (the gtfs-tools CLI): installs from the DuckDB community repository (`INSTALL gtfs FROM community`, signed; needs a DuckDB v2.0.0 CLI) unless `GTFS_EXTENSION_REPOSITORY=https://…` selects another repository. The CLI dashboard receives that repository from the CLI's `/dataset` response.
- Web: set `VITE_GTFS_EXTENSION_REPOSITORY` before `dev`/`build`.
- `createExtensionClient` accepts an HTTP(S) repository URL or exactly `'community'` (installed by keyword). Without a repository it only attempts `LOAD gtfs` from the local extension cache. A missing or incompatible artifact fails with configuration guidance; there is no fallback.
- Signature checks are never relaxed by the app. Unsigned loading is used only inside isolated integration tests.

Browser imports that would skip indexes are rejected until the extension supports selective initialization. Import routes, trips, stop times, shapes and at least one calendar file.

## Tests

```sh
yarn build && yarn run check && yarn test
```

Integration harnesses consume a staged extension repository produced by the extension's `scripts/stage-repository.py`:

```sh
export GTFS_STAGED_REPOSITORY=/path/to/staged-repository
DUCKDB_BIN=/path/to/duckdb-2.0.0 GTFS_DEPENDENCY_CACHE=/path/to/extension-cache \
  node packages/duckdb-client/tests/integration/consumer-native.mjs
node packages/duckdb-client/tests/integration/consumer-wasm.mjs --unsigned-only
node packages/duckdb-client/tests/integration/consumer-wasm.mjs
node packages/duckdb-client/tests/integration/consumer-app.mjs --missing-config
node packages/duckdb-client/tests/integration/consumer-app.mjs
```

The strict browser run stays red on the known DuckDB-WASM MVP `_setThrew is not defined` error. `tests/architecture.test.mjs` fails if extension SQL, macros or build files reappear in sources or built output.
