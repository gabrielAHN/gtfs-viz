# Consumer tests

`yarn test` runs client lifecycle, file-transport, native bridge, rendering and source/bundle ownership tests. `integration/` contains the native harness (the client driving the DuckDB CLI: install, import, reopen, edit, signature policy) and the EH/MVP browser consumer harnesses; see [the client README](../README.md). Database corridor fixtures and feed profiling utilities have moved to gtfs-duckdb `test/`.
