import assert from "node:assert/strict"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import vm from "node:vm"
import { build } from "esbuild"
import ts from "typescript"

const read = async (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8")

const loadNativeDuckDb = async (apiBaseUrl) => {
  const exports = {}
  const source = await read("../../web/src/lib/cli/nativeDuckDb.ts")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInThisContext(`(function (exports, require) { ${output} })`)(
    exports,
    (id) => {
      if (id === "./launchProfile") {
        return {
          buildCliApiUrl: (_profile, endpoint) => `${apiBaseUrl}${endpoint}`,
          getStoredCliLaunchProfile: () => null,
          readCliLaunchProfileFromUrl: () => null,
        }
      }
      throw new Error(`Unexpected import: ${id}`)
    },
  )
  return exports
}

test("native spatial retry crosses the HTTP and DuckDB process boundary", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-spatial-http-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const requestLog = path.join(directory, "requests.jsonl")
  const fakeDuckDb = path.join(directory, "fake-duckdb.mjs")
  const spatialError =
    'IO Error: Extension "spatial" not found. Install it first using "INSTALL spatial".'
  await writeFile(
    fakeDuckDb,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs"
const args = process.argv.slice(2)
const commandIndex = args.indexOf("-c")
const sql = commandIndex >= 0 ? args[commandIndex + 1] : ""
appendFileSync(process.env.FAKE_DUCKDB_REQUEST_LOG, JSON.stringify(sql) + "\\n")
if (!/INSTALL spatial/i.test(sql)) {
  process.stderr.write(${JSON.stringify(spatialError)})
  process.exitCode = 1
} else {
  process.stdout.write(JSON.stringify([{ route_id: "A", geometry: "ready" }]))
}
`,
  )
  await chmod(fakeDuckDb, 0o755)

  const previousDuckDbBin = process.env.DUCKDB_BIN
  const previousRequestLog = process.env.FAKE_DUCKDB_REQUEST_LOG
  process.env.DUCKDB_BIN = fakeDuckDb
  process.env.FAKE_DUCKDB_REQUEST_LOG = requestLog
  t.after(() => {
    if (previousDuckDbBin === undefined) delete process.env.DUCKDB_BIN
    else process.env.DUCKDB_BIN = previousDuckDbBin
    if (previousRequestLog === undefined) delete process.env.FAKE_DUCKDB_REQUEST_LOG
    else process.env.FAKE_DUCKDB_REQUEST_LOG = previousRequestLog
  })

  const serverBundle = path.join(directory, "http-server.mjs")
  await build({
    entryPoints: [new URL("../src/server/http-server.ts", import.meta.url).pathname],
    outfile: serverBundle,
    bundle: true,
    format: "esm",
    platform: "node",
  })
  const { createServer, listen } = await import(pathToFileURL(serverBundle).href)
  const sessionId = "spatial-http-test"
  const handle = createServer(
    sessionId,
    { dbPath: path.join(directory, "test.duckdb"), feedPath: "unused.zip" },
    { sessionId, status: "ready", updatedAt: new Date(0).toISOString() },
  )
  t.after(
    () =>
      new Promise((resolve, reject) =>
        handle.server.close((error) => (error ? reject(error) : resolve())),
      ),
  )
  const port = await listen(handle.server, "127.0.0.1", 0)
  const nativeDuckDb = await loadNativeDuckDb(
    `http://127.0.0.1:${port}/__gtfs_viz/api`,
  )
  const productionConnection = nativeDuckDb.createCliNativeConnection({ sessionId })
  const httpErrors = []
  const connection = {
    ...productionConnection,
    async query(sql) {
      try {
        return await productionConnection.query(sql)
      } catch (error) {
        httpErrors.push(error.message)
        throw error
      }
    },
  }
  const originalSql = "SELECT ST_AsText(geom) AS geometry FROM shapes"

  const result = await nativeDuckDb.queryWithSpatial(connection, originalSql)

  assert.deepEqual(
    result.toArray().map((row) => row.toJSON()),
    [{ route_id: "A", geometry: "ready" }],
  )
  assert.deepEqual(httpErrors, [spatialError], "the first HTTP 500 body preserves stderr")
  const requests = (await readFile(requestLog, "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse)
  assert.equal(requests.length, 2)
  assert.match(requests[0], /LOAD spatial;[\s\S]*SELECT ST_AsText/)
  assert.match(
    requests[1],
    /INSTALL spatial;[\s\S]*LOAD spatial;[\s\S]*SELECT ST_AsText\(geom\) AS geometry FROM shapes/,
  )
})
