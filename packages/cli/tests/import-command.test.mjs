// `gtfs-viz import` command wiring that needs no DuckDB: temp-file cleanup when a downloaded feed
// fails to import, redacted failure headers, unchanged local-path errors, usage, help and hints.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { build } from "esbuild"

const USAGE = "gtfs-viz import <feed.zip|https://…|s3://…|r2://…>"

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
  const root = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-import-command-"))
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
  const cli = (...args) => run(process.execPath, [path.join(packageRoot, "dist", "index.js"), ...args], { env, cwd: root })
  return { root, home, cli, dataRoot: path.join(home, ".gtfs-viz-cli") }
}

const zipWithout = async (root, name) => {
  const directory = path.join(root, "feed")
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, "routes.txt"), "route_id,route_short_name,route_long_name,route_type\nR1,1,Main,3\n")
  const zipPath = path.join(root, name)
  const zipped = await run("zip", ["-j", "-q", zipPath, path.join(directory, "routes.txt")])
  assert.equal(zipped.code, 0, zipped.stderr)
  return readFile(zipPath)
}

test("a downloaded feed that fails to import is deleted and leaves the dataset as it was", async (t) => {
  const env = await setup(t)
  const zipBytes = await zipWithout(env.root, "nostops.zip")
  const server = http.createServer((req, res) => res.writeHead(200, { "content-type": "application/zip" }).end(zipBytes))
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const statePath = path.join(env.dataRoot, "current", "state.json")
  await mkdir(path.dirname(statePath), { recursive: true })
  await writeFile(statePath, '{"previous":"dataset"}')
  const url = `http://127.0.0.1:${server.address().port}/feeds/nostops.zip`
  const result = await env.cli("import", `${url}?sig=querysecret`)
  assert.notEqual(result.code, 0)
  assert.match(result.stderr, /stops\.txt/)
  assert.ok(result.stderr.includes(`Import failed: ${url}\n`), result.stderr)
  assert.ok(!(result.stdout + result.stderr).includes("querysecret"), result.stderr)
  assert.deepEqual(await readdir(path.join(env.dataRoot, "downloads")), [])
  assert.equal(await readFile(statePath, "utf8"), '{"previous":"dataset"}')
})

test("failure headers never show query strings or URL credentials", async (t) => {
  const env = await setup(t)
  const cases = [
    ["http://user:urlpassword@127.0.0.1:9/feeds/f.zip?sig=querysecret", "http://127.0.0.1:9/feeds/f.zip"],
    ["gs://user:urlpassword@bucket/feed.zip?sig=querysecret", "gs://bucket/feed.zip"],
    ["s3://bucket/feed.zip?s3_secret_access_key=querysecret", "s3://bucket/feed.zip"],
  ]
  for (const [input, label] of cases) {
    const result = await env.cli("import", input)
    assert.notEqual(result.code, 0)
    assert.ok(result.stderr.startsWith(`Import failed: ${label}\n`), result.stderr)
    for (const leaked of ["urlpassword", "querysecret", "user:"]) assert.ok(!(result.stdout + result.stderr).includes(leaked), `${leaked}: ${result.stderr}`)
  }
})

test("local paths keep their existing errors", async (t) => {
  const env = await setup(t)
  const missing = await env.cli("import", "missing/feed.zip")
  assert.notEqual(missing.code, 0)
  assert.equal(missing.stderr, "Import failed: feed.zip\nGTFS file not found: missing/feed.zip\n")
  await writeFile(path.join(env.root, "notes.txt"), "not a zip")
  const notZip = await env.cli("import", "notes.txt")
  assert.equal(notZip.stderr, "Import failed: notes.txt\nRequires a .zip file\n")
})

test("usage, help and hints show every import form", async (t) => {
  const env = await setup(t)
  const usage = await env.cli("import")
  assert.notEqual(usage.code, 0)
  assert.ok(usage.stderr.includes(`Usage: ${USAGE}`), usage.stderr)
  const help = await env.cli("help", "import")
  assert.equal(help.code, 0)
  for (const text of [USAGE, "CREATE PERSISTENT SECRET", "credential_chain", "AWS_ACCESS_KEY_ID", "SSO", "ENDPOINT", "TYPE r2", "ACCOUNT_ID"]) {
    assert.ok(help.stdout.includes(text), `${text} missing from:\n${help.stdout}`)
  }
  const general = await env.cli("help")
  assert.ok(general.stdout.includes("import <feed.zip|https://…|s3://…|r2://…>"), general.stdout)
  const examples = await env.cli("examples")
  assert.match(examples.stdout, /gtfs-viz import https:\/\//)
  assert.match(examples.stdout, /gtfs-viz import s3:\/\//)
  const tables = await env.cli("tables")
  assert.ok(tables.stderr.includes(`Run ${USAGE} first.`), tables.stderr)
  const restart = await env.cli("restart")
  assert.ok(restart.stdout.includes(`Run ${USAGE} to start fresh.`), restart.stdout)
})
