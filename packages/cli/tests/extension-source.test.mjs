// Acceptance contract: without GTFS_EXTENSION_REPOSITORY the CLI installs gtfs from the
// DuckDB community repository, and DuckDB child processes never run in DuckDB 2.0 agent mode.
import assert from "node:assert/strict"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

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

test("the extension source defaults to the community repository", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-extension-source-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const runnerPath = await bundleRunner(directory)
  const dbPath = path.join(directory, "missing", "gtfs.duckdb")

  withEnv(t, { GTFS_EXTENSION_REPOSITORY: undefined })
  const unset = await import(`${pathToFileURL(runnerPath).href}?case=unset`)
  assert.deepEqual(await unset.extensionStartupArgs(dbPath), [
    "-cmd",
    "INSTALL gtfs FROM community",
    "-cmd",
    "LOAD gtfs",
  ])

  process.env.GTFS_EXTENSION_REPOSITORY = "community"
  const explicit = await import(`${pathToFileURL(runnerPath).href}?case=explicit`)
  assert.deepEqual(await explicit.extensionStartupArgs(dbPath), [
    "-cmd",
    "INSTALL gtfs FROM community",
    "-cmd",
    "LOAD gtfs",
  ])

  process.env.GTFS_EXTENSION_REPOSITORY = "https://example.test/extensions"
  const custom = await import(`${pathToFileURL(runnerPath).href}?case=custom`)
  assert.deepEqual(await custom.extensionStartupArgs(dbPath), [
    "-cmd",
    "INSTALL gtfs FROM 'https://example.test/extensions'",
    "-cmd",
    "LOAD gtfs",
  ])
})

test("DuckDB child processes run without AI_AGENT", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-agent-env-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const runnerPath = await bundleRunner(directory)
  const envLog = path.join(directory, "env.json")
  const fakeDuckDb = path.join(directory, "fake-duckdb.mjs")
  await writeFile(
    fakeDuckDb,
    `#!/usr/bin/env node\nimport { writeFileSync } from "node:fs"\nwriteFileSync(${JSON.stringify(envLog)}, JSON.stringify({ AI_AGENT: process.env.AI_AGENT ?? null, KEEP: process.env.GTFS_VIZ_TEST_KEEP ?? null }))\nprocess.stdout.write("[]")\n`,
  )
  await chmod(fakeDuckDb, 0o755)
  withEnv(t, { DUCKDB_BIN: fakeDuckDb, AI_AGENT: "1", GTFS_VIZ_TEST_KEEP: "kept" })
  const runner = await import(`${pathToFileURL(runnerPath).href}?case=agent`)
  await runner.runDuckDb([":memory:", "-c", "SELECT 1"])
  assert.deepEqual(JSON.parse(await readFile(envLog, "utf8")), { AI_AGENT: null, KEEP: "kept" })
})
