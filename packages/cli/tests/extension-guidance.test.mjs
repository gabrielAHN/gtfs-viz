// Extension install guidance: community needs a DuckDB v2.0.0 CLI, GTFS_EXTENSION_REPOSITORY selects
// another repository, and an "origin is different" failure explains FORCE INSTALL without running it.
import assert from "node:assert/strict"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

const ORIGIN_DIFFERENT =
  "Invalid Input Error: Installing extension 'gtfs' failed. The extension is already installed but the origin is different.\nCurrently installed extension is from repository 'http://127.0.0.1:1/repo', while the extension to be installed is from repository 'http://extensions.duckdb.org/community'.\nTo solve this rerun this command with `FORCE INSTALL`"
const FORCE_HINT = 'duckdb -c "FORCE INSTALL gtfs FROM community"'

const clientModule = async () => {
  const result = await build({
    entryPoints: [new URL("../../duckdb-client/lib/client.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`)
}

const bundleRunner = async (directory) => {
  const outfile = path.join(directory, "runner.mjs")
  await build({
    entryPoints: [new URL("../src/duckdb/runner.ts", import.meta.url).pathname],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
  })
  return outfile
}

const withEnv = (t, values) => {
  const previous = {}
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}

// Fake DuckDB: appends its argv to calls.jsonl, prints `stdout`, writes `stderr` and exits with `code`.
const fakeDuckDb = async (directory, { stdout = "", stderr = "", code = 0 } = {}) => {
  const calls = path.join(directory, "calls.jsonl")
  const file = path.join(directory, "fake-duckdb.mjs")
  await writeFile(
    file,
    `#!/usr/bin/env node\nimport { appendFileSync } from "node:fs"\nappendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + "\\n")\nprocess.stdout.write(${JSON.stringify(stdout)})\nprocess.stderr.write(${JSON.stringify(stderr)})\nprocess.exitCode = ${code}\n`,
  )
  await chmod(file, 0o755)
  return {
    file,
    calls: async () => (await readFile(calls, "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line)),
  }
}

test("the unconfigured client explains community and repository configuration without the old wording", async () => {
  const { createExtensionClient } = await clientModule()
  assert.throws(
    () => createExtensionClient({ query: async () => {} }, {}).install(),
    (error) => {
      assert.match(error.message, /Configure GTFS_EXTENSION_REPOSITORY/)
      assert.match(error.message, /community/)
      assert.doesNotMatch(error.message, /No public distribution/)
      return true
    },
  )
})

test("a failed community install says community builds need a DuckDB v2.0.0 CLI", async () => {
  const { createExtensionClient } = await clientModule()
  const cause = new Error("HTTP Error: Failed to download extension \"gtfs\" (HTTP 404)")
  await assert.rejects(
    createExtensionClient({ query: async () => { throw cause } }, { repository: "community" }).install(),
    (error) => {
      assert.equal(error.cause, cause)
      assert.match(error.message, /v2\.0\.0/)
      assert.match(error.message, /GTFS_EXTENSION_REPOSITORY/)
      assert.doesNotMatch(error.message, /No public distribution/)
      return true
    },
  )
})

test("a client install whose origin differs explains FORCE INSTALL and never runs it", async () => {
  const { createExtensionClient } = await clientModule()
  const queries = []
  await assert.rejects(
    createExtensionClient({ query: async (sql) => { queries.push(sql); throw new Error(ORIGIN_DIFFERENT) } }, { repository: "community" }).install(),
    (error) => {
      assert.ok(error.message.includes(FORCE_HINT), error.message)
      assert.match(error.message, /GTFS_EXTENSION_REPOSITORY/)
      assert.match(error.message, /original repository/)
      return true
    },
  )
  assert.deepEqual(queries, ["INSTALL gtfs FROM community"])
})

test("the CLI runner explains community and GTFS_EXTENSION_REPOSITORY when gtfs fails", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-guidance-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const runnerPath = await bundleRunner(directory)
  const fake = await fakeDuckDb(directory, { stderr: "IO Error: Failed to download extension \"gtfs\" at URL \"http://extensions.duckdb.org/community/v1.5.4/osx_arm64/gtfs.duckdb_extension.gz\" (HTTP 404)\n", code: 1 })
  withEnv(t, { DUCKDB_BIN: fake.file })
  const runner = await import(`${pathToFileURL(runnerPath).href}?case=generic`)
  await assert.rejects(runner.runDuckDb([":memory:", "-c", "LOAD gtfs"]), (error) => {
    assert.match(error.message, /HTTP 404/)
    assert.match(error.message, /community/)
    assert.match(error.message, /v2\.0\.0/)
    assert.match(error.message, /GTFS_EXTENSION_REPOSITORY/)
    return true
  })
})

test("the CLI runner explains FORCE INSTALL for a different origin and runs DuckDB only once", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-guidance-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const runnerPath = await bundleRunner(directory)
  const fake = await fakeDuckDb(directory, { stderr: ORIGIN_DIFFERENT + "\n", code: 1 })
  withEnv(t, { DUCKDB_BIN: fake.file })
  const runner = await import(`${pathToFileURL(runnerPath).href}?case=origin`)
  await assert.rejects(runner.runDuckDb([":memory:", "-cmd", "INSTALL gtfs FROM community", "-c", "SELECT 1"]), (error) => {
    assert.ok(error.message.includes(FORCE_HINT), error.message)
    assert.match(error.message, /GTFS_EXTENSION_REPOSITORY/)
    assert.match(error.message, /original repository/)
    return true
  })
  const calls = await fake.calls()
  assert.equal(calls.length, 1)
  assert.ok(!calls.flat().some((arg) => /FORCE INSTALL/i.test(arg)), JSON.stringify(calls))
})

test("an unconfigured import resolves and records the community repository", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-guidance-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const runnerPath = await bundleRunner(directory)
  const fake = await fakeDuckDb(directory, { stdout: "[]" })
  withEnv(t, { DUCKDB_BIN: fake.file, GTFS_EXTENSION_REPOSITORY: undefined })
  const runner = await import(`${pathToFileURL(runnerPath).href}?case=persist`)
  await mkdir(path.join(directory, "data"))
  const dbPath = path.join(directory, "data", "gtfs.duckdb")
  assert.equal(await runner.getNativeExtensionRepository(dbPath), "community")
  await runner.executeSqlFile(dbPath, path.join(directory, "import.sql"), ["SELECT 1"])
  assert.deepEqual(JSON.parse(await readFile(`${dbPath}.extension.json`, "utf8")), { repository: "community" })
  const [call] = await fake.calls()
  assert.deepEqual(call.filter((arg, index) => call[index - 1] === "-cmd"), ["INSTALL gtfs FROM community", "LOAD gtfs"])
})
