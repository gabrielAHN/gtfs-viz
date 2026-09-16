import assert from "node:assert/strict"
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

const friendlyMissingCli =
  "DuckDB CLI not found. Install DuckDB or set DUCKDB_BIN to the duckdb executable."

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

test("runDuckDb only reports a missing CLI for spawn ENOENT", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-runner-test-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const runnerPath = await bundleRunner(directory)
  const previousDuckDbBin = process.env.DUCKDB_BIN
  t.after(() => {
    if (previousDuckDbBin === undefined) delete process.env.DUCKDB_BIN
    else process.env.DUCKDB_BIN = previousDuckDbBin
  })

  process.env.DUCKDB_BIN = path.join(directory, "missing-duckdb")
  const missingRunner = await import(`${pathToFileURL(runnerPath).href}?case=enoent`)
  await assert.rejects(missingRunner.runDuckDb(["--version"]), {
    message: friendlyMissingCli,
  })

  const spatialError =
    'IO Error: Extension "spatial" not found. Install it first using "INSTALL spatial".'
  const fakeDuckDb = path.join(directory, "fake-duckdb.mjs")
  await writeFile(
    fakeDuckDb,
    `#!/usr/bin/env node\nprocess.stderr.write(${JSON.stringify(spatialError)})\nprocess.exitCode = 1\n`,
  )
  await chmod(fakeDuckDb, 0o755)

  process.env.DUCKDB_BIN = fakeDuckDb
  const spatialRunner = await import(`${pathToFileURL(runnerPath).href}?case=spatial`)
  await assert.rejects(
    spatialRunner.runDuckDb(["database.duckdb", "-c", "LOAD spatial;"]),
    (error) => {
      assert.equal(error.message, spatialError)
      return true
    },
  )
})
