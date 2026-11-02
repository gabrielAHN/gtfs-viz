// Ctrl-C or SIGTERM after a remote feed has downloaded, while DuckDB imports it: the real bundled CLI
// kills the DuckDB child, removes downloads/<uuid>.zip and dies by the signal.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { build } from "esbuild"

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, output }))
  })

// A fake DuckDB that records its pid and hangs, ignoring SIGINT and SIGTERM as a busy import may.
const HANGING_DUCKDB = `#!/usr/bin/env node
import { appendFileSync } from "node:fs"
process.on("SIGINT", () => {})
process.on("SIGTERM", () => {})
appendFileSync(process.env.FAKE_DUCKDB_PIDS, process.pid + "\\n")
setInterval(() => {}, 1000)
`

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test("Ctrl-C or SIGTERM during the DuckDB import of a downloaded feed removes the download and kills DuckDB", async (t) => {
  const root = path.resolve(await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-import-signal-")))
  t.after(() => rm(root, { recursive: true, force: true }))
  const packageRoot = path.join(root, "pkg")
  await mkdir(path.join(packageRoot, "dist"), { recursive: true })
  await build({
    entryPoints: [new URL("../src/index.ts", import.meta.url).pathname],
    outfile: path.join(packageRoot, "dist", "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
  })
  await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({ name: "@gabrielahn/gtfs-viz-cli", version: "0.0.0-test", type: "module" }))
  const feed = path.join(root, "feed")
  await mkdir(feed)
  await writeFile(path.join(feed, "stops.txt"), "stop_id,stop_name,stop_lat,stop_lon\nS1,One,40.0,-73.0\n")
  const zipped = await run("zip", ["-j", "-q", path.join(root, "feed.zip"), path.join(feed, "stops.txt")])
  assert.equal(zipped.code, 0, zipped.output)
  const zipBytes = await readFile(path.join(root, "feed.zip"))
  const server = http.createServer((req, res) => res.writeHead(200, { "content-type": "application/zip" }).end(zipBytes))
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const fake = path.join(root, "hanging-duckdb.mjs")
  await writeFile(fake, HANGING_DUCKDB)
  await chmod(fake, 0o755)

  for (const signal of ["SIGINT", "SIGTERM"]) {
    const home = path.join(root, `home-${signal}`)
    const pids = path.join(root, `duckdb-${signal}.pids`)
    await mkdir(home)
    const downloads = path.join(home, ".gtfs-viz-cli", "downloads")
    const child = spawn(process.execPath, [path.join(packageRoot, "dist", "index.js"), "import", `http://127.0.0.1:${server.address().port}/feed.zip`], {
      env: { ...process.env, HOME: home, TMPDIR: root, DUCKDB_BIN: fake, FAKE_DUCKDB_PIDS: pids },
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (chunk) => (output += chunk))
    child.stderr.on("data", (chunk) => (output += chunk))
    const exited = new Promise((resolve) => child.on("close", (code, killedBy) => resolve({ code, signal: killedBy })))
    let duckdbPid = 0
    const deadline = Date.now() + 15000
    while (Date.now() < deadline && !duckdbPid) {
      duckdbPid = Number((await readFile(pids, "utf8").catch(() => "")).split("\n")[0] || 0)
      if (!duckdbPid) await new Promise((resolve) => setTimeout(resolve, 25))
    }
    assert.ok(duckdbPid > 0, `the fake DuckDB never started: ${output}`)
    t.after(() => { if (alive(duckdbPid)) process.kill(duckdbPid, "SIGKILL") })
    assert.equal((await readdir(downloads)).length, 1, `the downloaded feed is not in downloads/: ${output}`)
    child.kill(signal)
    const result = await exited
    assert.deepEqual(result, { code: null, signal }, `${signal}: ${output}`)
    assert.deepEqual(await readdir(downloads), [], `${signal} left the downloaded feed behind`)
    const gone = Date.now() + 3000
    while (alive(duckdbPid) && Date.now() < gone) await new Promise((resolve) => setTimeout(resolve, 25))
    assert.equal(alive(duckdbPid), false, `${signal}: DuckDB child ${duckdbPid} is still running`)
  }
})
