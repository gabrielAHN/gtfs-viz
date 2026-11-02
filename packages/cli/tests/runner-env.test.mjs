// runProcess (used for every DuckDB child, including the S3 download) drops AI_AGENT and keeps the rest.
import assert from "node:assert/strict"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

test("runProcess removes AI_AGENT from the child environment and keeps every other variable", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-runner-env-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const outfile = path.join(directory, "runner.mjs")
  await build({
    entryPoints: [new URL("../src/duckdb/runner.ts", import.meta.url).pathname],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
  })
  const envLog = path.join(directory, "env.json")
  const child = path.join(directory, "child.mjs")
  await writeFile(
    child,
    `#!/usr/bin/env node\nimport { writeFileSync } from "node:fs"\nwriteFileSync(${JSON.stringify(envLog)}, JSON.stringify({ AI_AGENT: process.env.AI_AGENT ?? null, KEEP: process.env.GTFS_VIZ_RUNNER_ENV_KEEP ?? null, PATH: process.env.PATH ?? null }))\n`,
  )
  await chmod(child, 0o755)
  const previous = { AI_AGENT: process.env.AI_AGENT, KEEP: process.env.GTFS_VIZ_RUNNER_ENV_KEEP }
  t.after(() => {
    if (previous.AI_AGENT === undefined) delete process.env.AI_AGENT
    else process.env.AI_AGENT = previous.AI_AGENT
    if (previous.KEEP === undefined) delete process.env.GTFS_VIZ_RUNNER_ENV_KEEP
    else process.env.GTFS_VIZ_RUNNER_ENV_KEEP = previous.KEEP
  })
  process.env.AI_AGENT = "1"
  process.env.GTFS_VIZ_RUNNER_ENV_KEEP = "kept"
  const runner = await import(`${pathToFileURL(outfile).href}?case=run-process`)
  await runner.runProcess(child, [])
  assert.deepEqual(JSON.parse(await readFile(envLog, "utf8")), { AI_AGENT: null, KEEP: "kept", PATH: process.env.PATH ?? null })
  assert.equal(process.env.AI_AGENT, "1", "the parent environment is not modified")
})
