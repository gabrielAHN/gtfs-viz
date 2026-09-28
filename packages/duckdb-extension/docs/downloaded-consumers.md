# Opt-in downloaded-extension consumers

The web app and CLI retain embedded SQL **only when no extension repository is configured**. This is a temporary transition path, not completion of the repository split or a signed release. The configured path uses `@gtfs-viz/duckdb-extension/client`; a download, ABI, signature, preparation, initialization, or refresh failure is not retried with embedded macro definitions. Neither production consumer enables unsigned extensions.

## Configuration

For the native CLI, set `GTFS_EXTENSION_REPOSITORY` to the HTTP(S) repository root before importing a dataset. Set `DUCKDB_BIN` to a compatible executable when the default DuckDB is not compatible. The tested development native artifact targets DuckDB **1.5.4**, not the previously installed 1.2.0.

For the standalone browser app, set `VITE_GTFS_EXTENSION_REPOSITORY` before starting Vite or building the app. It is a build-time public URL, not a secret. The existing EH and MVP bundles remain supported by the consumer selection logic; their tested engine is **1.4.3**. The repository must serve matching WASM artifacts and permit the application's origin through CORS.

Example configuration (replace the placeholder repository with a real signed distribution):

```sh
GTFS_EXTENSION_REPOSITORY=https://your-repository.example/extensions gtfs-viz import feed.zip
VITE_GTFS_EXTENSION_REPOSITORY=https://your-repository.example/extensions yarn dev
```

Do not use those placeholder URLs as a published distribution. No signed/community artifact is available from this work. An empty or invalid configured URL is an error, not a request for legacy mode.

Native successful imports save the repository beside the database as `<database>.extension.json`. Subsequent CLI commands and daemon SQL subprocesses read that sidecar even when the shell no longer exports the variable. The stored repository takes precedence for that dataset. Dataset API responses carry the repository into the dashboard's native connection, so browser edit helpers choose the same lifecycle rather than the browser build's WASM configuration. Reimporting through the CLI replaces the dataset and captures the new environment configuration.

## Lifecycle and limitations

- Native subprocesses each execute separate INSTALL and LOAD startup commands before the query or pragma. Import preparation, source ingestion, initialization, and spatial geometry additions are separate execution stages. Combining repeated import and pragmas in one native SQL batch produced a dependency-commit error; the staged path is tested instead.
- Browser connections await INSTALL/LOAD, prepare edit tables, run the existing CSV normalization, and initialize explicitly. Reopened connections load before refreshing. Editing and rerouting use the downloaded lifecycle without executing embedded macro definitions. Startup failure is displayed in an alert rather than silently entering a half-initialized application.
- Raw file registration, ZIP handling, normalized ingestion SQL, and spatial loading still belong to the consumers. This step does not remove the legacy SQL package.
- **Selective browser imports are not yet compatible with the prototype extension's index API.** The legacy importer skips certain indexes when optional files are absent/deselected. The prototype's parameterless `gtfs_init` cannot honor that contract. Configured browser imports requiring skipped indexes therefore fail before any SQL is executed, with an explicit explanation; they do not silently build all indexes or fall back. Full related-file imports work. CLI imports historically build all indexes and do not have this restriction. Supporting the browser's selective-index contract requires an extension API change, outside this task's no-core-modifications scope.
- Native imports and browser in-place imports retain their existing edit-table behavior. Refresh preserves pending edits. The CLI's top-level fresh import still replaces its current dataset directory.

## Reproduce verification

Run from the repository root after building:

```sh
yarn test
yarn build
yarn run check
DUCKDB_BIN=/path/to/duckdb-1.5.4 GTFS_DEPENDENCY_CACHE=/path/to/isolated/signed-dependency-cache node packages/duckdb-extension/tests/integration/consumer-native.mjs
node packages/duckdb-extension/tests/integration/consumer-wasm.mjs --unsigned-only
node packages/duckdb-extension/tests/integration/consumer-wasm.mjs
node packages/duckdb-extension/tests/integration/consumer-app.mjs
node packages/duckdb-extension/tests/integration/consumer-app.mjs --legacy
```

The native dependency cache, if supplied, is copied into a temporary test-owned cache. The tests read existing sibling artifacts and never build or change extension sources/artifacts. Native positive tests use a temporary executable wrapper with `-unsigned`; browser positive tests use a test-only DuckDB configuration. Default-policy negative cases use separate fresh caches/engines with signatures enforced. Neither setting is exposed in application configuration.

### Observed results

- **46 unit/regression tests pass**, including recorded RED→GREEN ingestion, browser edit/reroute, error propagation, native startup, and persisted configuration tests.
- **Build passes.** Project checks pass with the baseline **141 warnings, zero errors**.
- Native actual import builder/subprocess adapter passes CSV import, persisted configuration, fresh-process reads, pending edits, repeated refresh and import, absence of persisted embedded macros after reroute setup, and default unsigned-artifact rejection.
- Chromium **EH and MVP unsigned-development cases pass** through the actual `runIngestion` and web extension adapters: all eight CSV sources, initialization, shortest path, edits/refresh, and a new connection. No embedded macro definitions are executed.
- The strict browser matrix remains **red**: EH rejects the artifact's signature correctly; MVP reports the pre-existing `_setThrew is not defined` runtime defect. Its original cause is asserted, not the wrapper's signature-related guidance. No bundle was removed or patched.
- The **live Vite app's configured production-policy failure path passes**: it downloads the artifact, rejects its signature, displays the error, and produces no unhandled page error. A fully signed positive standalone-app UI run is unavailable.
- The **live unconfigured Vite app passes actual ZIP upload and station-table rendering**, with no downloaded-extension request.
- `consumer-native.mjs --cli-e2e` now **passes the built CLI dashboard end-to-end test**: ZIP import, a subsequent command without the repository environment variable, daemon repository propagation, HTTP edit/refresh, station-table display and reload, station-row selection, and unselected stops-table display and reload. The earlier router failure was an eager `ClickInfo.stop_id` read in both station/stop selection headers when no row was selected. Both headers now guard route-chip rendering on an existing selection. This is a real browser UI test with an isolated unsigned native test process, not a signed release proof. Servers/daemon are cleaned up after the run.

Logs and screenshots from the local run are under `.hermes/plans/consumer-*`. Browser OPFS close/reopen across a new engine, the full edit-form matrix, large feeds, cross-platform native artifacts, signed positive application runs, and publication have not been verified here.
