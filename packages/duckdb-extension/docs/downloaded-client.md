# Downloaded client: verified transport, not release readiness

## Scope

The opt-in `@gtfs-viz/duckdb-extension/client` export supplies `createExtensionClient(executor, { repository })` with explicit `install`, `load`, `prepare`, `init`, and `refresh` methods. Its only executor requirement is `query(sql: string): Promise<unknown>`. It has no imports, embedded SQL, rendering dependencies, import-time queries, unsigned configuration, retry, or fallback. The root SQL API and `lib/installer.ts` retain the legacy implementation. Subsequent opt-in app/CLI wiring is documented in [downloaded consumers](downloaded-consumers.md). No extension SQL/C++ or dependencies were changed.

The repository is mandatory, HTTP(S), validated, captured before caller mutation, and SQL-literal escaped. No community repository or public artifact is invented. Callers must await each operation; LOAD is always issued separately from pragmas. The executor must reject engine failures. Error `cause` retains the original failure while the message adds operational guidance. INSTALL retains DuckDB's normal cache behavior, not forced reinstallation.

## Executed results

| Gate | Actual result |
|---|---|
| Initial test before client implementation | Failed: missing client module (`client-red.log`) |
| Validation/escaping/error/export tests before implementing those boundaries | Failed on missing validation, mutable/unescaped repository, missing error cause, and missing public export (`client-boundaries-red.log`) |
| `yarn test` | 36 passed, 0 failed, including 7 client tests |
| `yarn build` | Exit 0: extension wrapper, rendering library, web, CLI |
| `yarn run check` | Exit 0; existing web lint: 0 errors, 141 warnings |
| Native downloaded client | PASS: standalone DuckDB v1.5.4, osx_arm64 |
| Chromium unsigned-development client | PASS: Chromium 147.0.7727.15, DuckDB v1.4.3, EH and MVP |
| Chromium strict signature gate | Exit 1: EH rejects correctly; MVP still returns `ReferenceError: _setThrew is not defined` |
| Chromium baseline errors | Exit 1: same MVP error before installing/loading an extension |

Native tests serve the real gzipped artifact over loopback to fresh, test-owned home/cache directories. They run all client lifecycle methods, verify no tables on LOAD, initialize the normalized fixture, query a recursive shortest path, refresh twice while preserving pending edits, verify the installed cache file, and confirm default signature rejection. Native v1.5.4 rejects the unsigned download at INSTALL. A separate 404 repository verifies transparent download failure with original cause. The test adapter runs a CLI process per query against one database file; after the explicit load it reloads the extension through a separate `-cmd` in subsequent processes, before executing lifecycle pragmas with `-c`.

The Chromium harness adapts the sibling extension's existing loopback/CORS harness and imports the built client in the page. Both EH and MVP exercise actual artifact downloads from a separate origin, all 65 macros, no tables on LOAD, preserved user data, prepare/init, fixture availability, recursive pathfinding, after-midnight times, two refreshes preserving edits, and another connection. Only isolated positive-test database configuration enables unsigned extensions. Negative cases call `db.open({})` with the default policy.

Strict tests assert against the original error cause, not the wrapper's guidance mentioning signatures. This prevents the MVP JavaScript error from falsely passing a signature assertion. The strict suite remains red, not skipped or treated as an expected passing result. No browser support policy was narrowed and no vendor dependencies were patched.

## Reproduction

From the GTFS Viz repository, with the sibling `gtfs-duck-tools` native and WASM artifacts already built and Playwright Chromium installed:

```sh
export TMPDIR=/Users/gh/.hermes/cache/scratch
yarn test > .hermes/plans/client-tests.log 2>&1
yarn build > .hermes/plans/client-build.log 2>&1
yarn run check > .hermes/plans/client-check.log 2>&1

DUCKDB_BIN=/Users/gh/.hermes/cache/scratch/gtfs-duckdb-v1.5.4/duckdb \
  node packages/duckdb-extension/tests/integration/client-native.mjs \
  > .hermes/plans/client-native.log 2>&1

node packages/duckdb-extension/tests/integration/client-wasm.mjs --unsigned-only \
  > .hermes/plans/client-wasm-unsigned.log 2>&1
node packages/duckdb-extension/tests/integration/client-wasm.mjs \
  > .hermes/plans/client-wasm-strict.log 2>&1
node packages/duckdb-extension/tests/integration/client-wasm.mjs --baseline-errors \
  > .hermes/plans/client-wasm-baseline.log 2>&1
```

The final two commands currently must exit nonzero for the unresolved MVP error. Integration tests are intentionally separate from `yarn test`: they require locally built sibling artifacts and a matching native engine. `GTFS_DUCK_TOOLS_ROOT` overrides the sibling location; native `GTFS_EXTENSION` overrides the artifact path. The browser uses installed GTFS Viz dependencies. Both HTTP harnesses close active connections during teardown; browser evaluation and native subprocesses are bounded.

## Next integration gates

1. Resolve MVP exception handling without weakening signature checks, or make a separately reviewed browser-support decision. Re-run the full strict matrix.
2. Obtain and verify signed artifacts for the supported native/WASM engine and platform matrix. Native prototype is 1.5.4, browser engine 1.4.3, while the existing application's native CLI baseline is 1.2.0; these are not interchangeable.
3. Exercise cross-platform distribution CI and real signed downloads. An unsigned loopback smoke is not release qualification. Publish/community submission requires separate approval and acceptance.
4. Wire explicit consumer adapters only after distribution is viable. Keep normalized-file ingestion in consumers for now; ensure install/load precedes prepare, source import precedes init, edits precede refresh, and spatial setup remains explicit. Do not silently fall back to embedded SQL.
5. Run application import/edit/export and route-geometry parity tests after wiring. This step did not migrate ingestion, change default app behavior, or certify end-to-end consumer migration.

All changes remain uncommitted; no push or publication was performed.
