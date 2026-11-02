// What `gtfs-viz import` and `gtfs-viz status` print is safe for a terminal: escape sequences are
// stripped and C0/C1 controls (except newline and tab) and bidi or invisible formatting characters
// are replaced, wherever the text came from (a hostile server's reason phrase, a stored source, a
// local path). Object keys are stored and shown with such characters percent-encoded.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { build } from "esbuild"

// C0 controls except tab and newline, DEL, C1 controls, and bidi or invisible formatting characters.
const UNSAFE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })

const setup = async (t) => {
  const root = path.resolve(await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-import-output-")))
  t.after(() => rm(root, { recursive: true, force: true }))
  const home = path.join(root, "home")
  const packageRoot = path.join(root, "pkg")
  await mkdir(home, { recursive: true })
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
  const env = { ...process.env, HOME: home, TMPDIR: path.join(root, "t"), DUCKDB_BIN: path.join(root, "no-duckdb-needed") }
  await mkdir(env.TMPDIR)
  const cli = (...args) => {
    const overrides = typeof args.at(-1) === "object" ? args.pop() : {}
    return run(process.execPath, [path.join(packageRoot, "dist", "index.js"), ...args], { env: { ...env, ...overrides }, cwd: root })
  }
  return { root, cli, dataRoot: path.join(home, ".gtfs-viz-cli") }
}

test("a hostile HTTP reason phrase never reaches the terminal raw", async (t) => {
  const env = await setup(t)
  // A raw server whose reason phrase carries an OSC title, an SGR colour, a C1 CSI and bidi bytes.
  const server = net.createServer((socket) => {
    socket.once("data", () => socket.end("HTTP/1.1 404 \x1b]0;TITLE\x07\x1b[31mRED\x9b31m\r\ncontent-length: 0\r\nconnection: close\r\n\r\n", "latin1"))
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/feed.zip`
  const result = await env.cli("import", `${url}?sig=querysecret0123`)
  assert.notEqual(result.code, 0)
  assert.equal(result.stderr.split("\n")[0], `Import failed: ${url}`, result.stderr)
  assert.match(result.stderr, /HTTP 404/)
  assert.doesNotMatch(result.stdout + result.stderr, UNSAFE, JSON.stringify(result.stderr))
  assert.ok(!result.stderr.includes("TITLE"), JSON.stringify(result.stderr))
  assert.ok(!result.stderr.includes("querysecret"), result.stderr)
})

test("an object key with bidi or invisible characters is shown percent-encoded and never raw", async (t) => {
  const env = await setup(t)
  const invocations = path.join(env.root, "duckdb-invocations.txt")
  const fakeDuckDb = path.join(env.root, "fake-duckdb.sh")
  await writeFile(fakeDuckDb, `#!/bin/sh\necho invoked >> ${JSON.stringify(invocations)}\necho "HTTP Error: HTTP HEAD error checking '$*' (HTTP 404 Not Found)" >&2\nexit 1\n`)
  await chmod(fakeDuckDb, 0o755)
  for (const [input, label] of [
    ["s3://bucket/path/evil\u202egpj.sample.zip", "s3://bucket/path/evil%E2%80%AEgpj.sample.zip"],
    ["S3://bucket/pa\u200bth/sample.zip", "s3://bucket/pa%E2%80%8Bth/sample.zip"],
  ]) {
    const result = await env.cli("import", input, { DUCKDB_BIN: fakeDuckDb })
    assert.notEqual(result.code, 0, input)
    assert.ok((await readFile(invocations, "utf8").catch(() => "")).length > 0, `${input} never reached DuckDB`)
    assert.equal(result.stderr.split("\n")[0], `Import failed: ${label}`, JSON.stringify(result.stderr))
    assert.doesNotMatch(result.stdout + result.stderr, UNSAFE, JSON.stringify(result.stderr))
  }
})

test("local paths with escape sequences or bidi characters are printed safely", async (t) => {
  const env = await setup(t)
  const result = await env.cli("import", "missing/\u001b]0;TITLE\u0007ev\u202eil\u001b[31m.zip")
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /^Import failed: /)
  assert.match(result.stderr, /GTFS file not found: missing\//)
  assert.doesNotMatch(result.stdout + result.stderr, UNSAFE, JSON.stringify(result.stderr))
  assert.ok(!result.stderr.includes("TITLE"), JSON.stringify(result.stderr))
})

test("status prints the stored source and file name without escape sequences or bidi characters", async (t) => {
  const env = await setup(t)
  const statePath = path.join(env.dataRoot, "current", "state.json")
  await mkdir(path.dirname(statePath), { recursive: true })
  await writeFile(statePath, JSON.stringify({
    status: "ready",
    sourcePath: "s3://bucket/evil\u202egpj\u001b]0;TITLE\u0007\u009b31m.zip",
    feedPath: path.join(env.dataRoot, "current", "feed.zip"),
    dbPath: path.join(env.dataRoot, "current", "gtfs.duckdb"),
    importedAt: new Date().toISOString(),
    fileName: "fe\u200bed\u001b[2J.zip",
    fileSize: 1,
    counts: { stops: 1, stations: 0, pathways: 0, routes: 0 },
  }))
  const result = await env.cli("status")
  assert.equal(result.code, 0, result.stderr)
  const source = result.stdout.split("\n").find((line) => line.startsWith("Source: "))
  assert.ok(source?.startsWith("Source: s3://bucket/evil"), result.stdout)
  assert.ok(result.stdout.includes("Dataset: fe"), result.stdout)
  assert.doesNotMatch(result.stdout + result.stderr, UNSAFE, JSON.stringify(result.stdout))
  assert.ok(!result.stdout.includes("TITLE"), JSON.stringify(result.stdout))
})
