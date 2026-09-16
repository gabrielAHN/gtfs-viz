import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const execFileAsync = promisify(execFile)

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
          return { ROUTE_SHAPE_MACRO_VERSION: "v2-current-test" }
        }
        assert.fail(`unexpected import: ${id}`)
      },
    },
  )
  return exports
}

test("a real DuckDB failure rolls back both route-band tables", async (t) => {
  const duckdb = process.env.DUCKDB_BIN || "duckdb"
  try {
    await execFileAsync(duckdb, ["--version"])
  } catch (error) {
    if (error?.code === "ENOENT") {
      t.skip(`DuckDB CLI is unavailable at ${JSON.stringify(duckdb)}`)
      return
    }
    throw error
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-route-bands-"))
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }))
  const databasePath = path.join(temporaryDirectory, "rollback.duckdb")
  const runDuckDb = (args) =>
    execFileAsync(duckdb, args, {
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, HOME: os.homedir() },
    }).then(({ stdout }) => stdout)

  await runDuckDb([
    "-bail",
    databasePath,
    "-c",
    `CREATE TABLE RouteShapeLanesTable(marker INTEGER);
     CREATE TABLE RouteShapeBandsTable(marker INTEGER);
     CREATE TABLE RouteShapeMacroVersion(version VARCHAR);
     INSERT INTO RouteShapeLanesTable VALUES (1), (2), (3);
     INSERT INTO RouteShapeBandsTable VALUES (4), (5);
     INSERT INTO RouteShapeMacroVersion VALUES ('v2-previous-test');
     CREATE MACRO prepare_route_shape_lanes_rail() AS TABLE
       SELECT 10::INTEGER AS marker;
     CREATE MACRO prepare_route_shape_lanes_bus() AS TABLE
       SELECT error('forced route-band failure')::INTEGER AS marker;
     CREATE MACRO prepare_route_shape_lanes_other() AS TABLE
       SELECT 30::INTEGER AS marker;
     CREATE MACRO refresh_route_shape_bands() AS TABLE
       SELECT 40::INTEGER AS marker;`,
  ])

  let invokedTransactionSql
  const routeBands = loadRouteBands({
    executeRows: async (dbPath, sql) => {
      invokedTransactionSql = sql
      await runDuckDb(["-bail", dbPath, "-c", sql])
    },
    queryRows: async () => {
      assert.fail("summary query must not run after a real DuckDB failure")
    },
  })

  await assert.rejects(
    routeBands.buildRouteShapeBands(databasePath),
    /forced route-band failure/,
  )
  assert.equal(typeof invokedTransactionSql, "string")

  const counts = JSON.parse(
    await runDuckDb([
      "-readonly",
      "-json",
      databasePath,
      "-c",
      `SELECT (SELECT count(*) FROM RouteShapeLanesTable) AS lanes,
              (SELECT count(*) FROM RouteShapeBandsTable) AS bands,
              (SELECT version FROM RouteShapeMacroVersion) AS version`,
    ]),
  )
  assert.deepEqual(counts, [{ lanes: 3, bands: 2, version: "v2-previous-test" }])
})
