import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const routeShapeMacroVersion = "v2-test'version"

const loadRouteBands = ({ executeRows, queryRows }) => {
  const exports = {}
  const source = readFileSync(
    new URL("../src/duckdb/route-bands.ts", import.meta.url),
    "utf8",
  )
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (id) => {
        if (id === "./runner.js") return { executeRows, queryRows }
        if (id === "@gtfs-viz/duckdb-extension") {
          return { ROUTE_SHAPE_MACRO_VERSION: routeShapeMacroVersion }
        }
        assert.fail(`unexpected import: ${id}`)
      },
    },
  )
  return exports
}

test("a failed route-band rebuild preserves the existing derived rows", async () => {
  const existing = { lanes: 72, bands: 48, version: "v2-existing" }
  const rows = { ...existing }
  const executeRows = async (_dbPath, sql) => {
    const transactional = /\bBEGIN(?: TRANSACTION)?\s*;/i.test(sql)
    const snapshot = { ...rows }
    try {
      for (const statement of sql.split(";")) {
        if (/DELETE FROM RouteShapeLanesTable/i.test(statement)) rows.lanes = 0
        if (/DELETE FROM RouteShapeBandsTable/i.test(statement)) rows.bands = 0
        if (/DELETE FROM RouteShapeMacroVersion/i.test(statement)) rows.version = ""
        if (/INSERT INTO RouteShapeMacroVersion/i.test(statement)) {
          rows.version = routeShapeMacroVersion
        }
        if (/prepare_route_shape_lanes_rail/i.test(statement)) {
          throw new Error("simulated DuckDB build failure")
        }
      }
    } catch (error) {
      if (transactional) Object.assign(rows, snapshot)
      throw error
    }
  }
  const routeBands = loadRouteBands({
    executeRows,
    queryRows: async () => {
      throw new Error("summary query must not run after a build failure")
    },
  })

  await assert.rejects(
    routeBands.buildRouteShapeBands("feed.duckdb"),
    /simulated DuckDB build failure/,
  )
  assert.deepEqual(rows, existing)
})

test("a successful route-band rebuild uses one transaction and returns its summary", async () => {
  const calls = []
  const routeBands = loadRouteBands({
    executeRows: async (dbPath, sql) => calls.push({ dbPath, sql }),
    queryRows: async () => [{ band_rows: 48, routes: 6, widest_bundle: 4 }],
  })

  assert.deepEqual(
    JSON.parse(JSON.stringify(await routeBands.buildRouteShapeBands("feed.duckdb"))),
    {
      bandRows: 48,
      routes: 6,
      widestBundle: 4,
    },
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].dbPath, "feed.duckdb")
  assert.match(calls[0].sql, /BEGIN TRANSACTION;[\s\S]*DELETE FROM RouteShapeLanesTable;/)
  assert.match(calls[0].sql, /INSERT INTO RouteShapeBandsTable[\s\S]*COMMIT;/)

  const statements = calls[0].sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
  const position = (pattern) => statements.findIndex((statement) => pattern.test(statement))
  const createVersion = position(/CREATE TABLE IF NOT EXISTS RouteShapeMacroVersion/i)
  const begin = position(/^BEGIN TRANSACTION$/i)
  const deleteLanes = position(/^DELETE FROM RouteShapeLanesTable$/i)
  const deleteBands = position(/^DELETE FROM RouteShapeBandsTable$/i)
  const deleteVersion = position(/^DELETE FROM RouteShapeMacroVersion$/i)
  const insertBands = position(/^INSERT INTO RouteShapeBandsTable/i)
  const insertVersion = position(/^INSERT INTO RouteShapeMacroVersion/i)
  const commit = position(/^COMMIT$/i)

  assert.ok(begin < createVersion)
  assert.ok(createVersion < deleteLanes)
  assert.ok(deleteLanes < deleteBands)
  assert.ok(deleteBands < deleteVersion)
  assert.ok(deleteVersion < insertBands)
  assert.ok(insertBands < insertVersion)
  assert.ok(insertVersion < commit)
  assert.equal(
    statements.filter((statement) => /^INSERT INTO RouteShapeMacroVersion/i.test(statement))
      .length,
    1,
  )
  assert.equal(
    statements[insertVersion],
    "INSERT INTO RouteShapeMacroVersion VALUES ('v2-test''version')",
  )
})
