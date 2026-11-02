// Acceptance contract: `gtfs-viz import` accepts a local zip, an http(s) URL, or an s3:// object.
// Runs the real CLI bundle against a real DuckDB CLI and gtfs extension, with every
// remote endpoint served from loopback. Skipped unless DUCKDB_BIN and GTFS_EXTENSION are set.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createReadStream } from "node:fs"
import { chmod, copyFile, link, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { gzipSync } from "node:zlib"
import { build } from "esbuild"

const realDuckDb = process.env.DUCKDB_BIN
const extensionFile = process.env.GTFS_EXTENSION
const dependencyCache = process.env.GTFS_DEPENDENCY_CACHE
const skip =
  realDuckDb && extensionFile
    ? false
    : "Set DUCKDB_BIN and GTFS_EXTENSION (and GTFS_DEPENDENCY_CACHE holding spatial) to run"

const SECRET_QUERY = "X-Amz-Signature=querysecret0123456789"
const S3_KEY_ID = "gtfskeyid"
const S3_SECRET = "gtfssecretvalue"

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

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`

const fixtureFiles = {
  "stops.txt": [
    "stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station",
    "STA,Central Station,40.0,-73.0,1,",
    "P1,Central Platform 1,40.0001,-73.0001,0,STA",
    "P2,Central Platform 2,40.0002,-73.0002,0,STA",
    "S3,Elm Street,40.01,-73.01,0,",
  ],
  "routes.txt": ["route_id,route_short_name,route_long_name,route_type", "R1,1,Main Line,3"],
  "trips.txt": ["route_id,service_id,trip_id", "R1,WK,T1"],
  "stop_times.txt": [
    "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
    "T1,08:00:00,08:00:00,P1,1",
    "T1,08:10:00,08:10:00,S3,2",
  ],
  "calendar.txt": [
    "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
    "WK,1,1,1,1,1,0,0,20260101,20261231",
  ],
}

const startServer = async (zipBytes, requestLog) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1")
    requestLog.push({
      method: req.method,
      path: url.pathname,
      authorization: req.headers.authorization ?? "",
    })
    const sendZip = () => {
      const headers = { "content-type": "application/zip", "accept-ranges": "bytes", etag: '"fixture"', "last-modified": new Date(0).toUTCString() }
      const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range)
      if (range) {
        const start = Number(range[1])
        const end = range[2] ? Math.min(Number(range[2]), zipBytes.length - 1) : zipBytes.length - 1
        res.writeHead(206, { ...headers, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${zipBytes.length}` })
        res.end(req.method === "HEAD" ? undefined : zipBytes.subarray(start, end + 1))
        return
      }
      res.writeHead(200, { ...headers, "content-length": zipBytes.length })
      res.end(req.method === "HEAD" ? undefined : zipBytes)
    }
    if (url.pathname.startsWith("/repo/")) {
      const file = path.join(server.repositoryRoot, decodeURIComponent(url.pathname.slice("/repo/".length)))
      stat(file).then(
        (info) => {
          res.writeHead(200, { "content-length": info.size })
          if (req.method === "HEAD") res.end()
          else createReadStream(file).pipe(res)
        },
        () => {
          res.writeHead(404)
          res.end()
        },
      )
      return
    }
    if (url.pathname === "/feeds/sample.zip" || url.pathname === "/download" || url.pathname === "/bucket/path/sample.zip") {
      sendZip()
      return
    }
    if (url.pathname === "/page.html") {
      res.writeHead(200, { "content-type": "text/html" })
      res.end("<!doctype html><title>not a feed</title>")
      return
    }
    res.writeHead(404, { "content-type": "text/plain" })
    res.end("not found")
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  return server
}

test("gtfs-viz import accepts a local zip, an http(s) URL and an s3:// object", { skip, timeout: 600_000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-remote-import-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const home = path.join(root, "home")
  const tmp = path.join(root, "t")
  const extensions = path.join(root, "extensions")
  const dashboard = path.join(root, "dashboard")
  const packageRoot = path.join(root, "pkg")
  for (const directory of [home, tmp, extensions, dashboard, path.join(packageRoot, "dist"), path.join(root, "feed")])
    await mkdir(directory, { recursive: true })
  await writeFile(path.join(dashboard, "index.html"), "<!doctype html><title>stub dashboard</title>")

  // Fixture feed
  for (const [name, lines] of Object.entries(fixtureFiles))
    await writeFile(path.join(root, "feed", name), lines.join("\n") + "\n")
  const zipPath = path.join(root, "sample.zip")
  const zipped = await run("zip", ["-j", "-q", zipPath, ...Object.keys(fixtureFiles).map((name) => path.join(root, "feed", name))])
  assert.equal(zipped.code, 0, zipped.stderr)
  const zipBytes = await readFile(zipPath)

  // CLI bundle in a throwaway package root
  await build({
    entryPoints: [new URL("../src/index.ts", import.meta.url).pathname],
    outfile: path.join(packageRoot, "dist", "index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
  })
  await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({ name: "@gabrielahn/gtfs-viz-cli", version: "0.0.0-test", type: "module" }))
  const cli = path.join(packageRoot, "dist", "index.js")

  // DuckDB wrapper: unsigned test artifact, isolated extension directories
  const directories = [extensions, ...(dependencyCache ? [dependencyCache] : [])].map(sqlString).join(", ")
  const wrapper = path.join(root, "duckdb")
  await writeFile(wrapper, `#!/bin/sh\nexec ${JSON.stringify(realDuckDb)} -unsigned -cmd ${JSON.stringify(`SET extension_directories=[${directories}];`)} "$@"\n`)
  await chmod(wrapper, 0o755)

  const baseEnv = { ...process.env, HOME: home, TMPDIR: tmp, DUCKDB_BIN: wrapper, GTFS_VIZ_DASHBOARD_DIST: dashboard, GTFS_VIZ_DUCKDB_THREADS: "1" }
  delete baseEnv.AI_AGENT
  delete baseEnv.GTFS_EXTENSION_REPOSITORY

  // Serve the extension as a repository, plus the remote feeds
  const engine = await run(wrapper, ["-json", ":memory:", "-c", "SELECT version() AS version, (SELECT platform FROM pragma_platform()) AS platform"], { env: baseEnv })
  assert.equal(engine.code, 0, engine.stderr)
  const [{ version, platform }] = JSON.parse(engine.stdout)
  // INSTALL only looks in the first extension directory, so link cached dependencies there
  // (spatial, httpfs, aws) to keep the run offline when the cache already holds them.
  if (dependencyCache) {
    const cached = path.join(dependencyCache, version, platform)
    const target = path.join(extensions, version, platform)
    await mkdir(target, { recursive: true })
    for (const name of await readdir(cached).catch(() => [])) {
      if (!/^(spatial|httpfs|aws)\.duckdb_extension(\.info)?$/.test(name)) continue
      await link(path.join(cached, name), path.join(target, name)).catch(() => copyFile(path.join(cached, name), path.join(target, name)))
    }
  }
  const repositoryRoot = path.join(root, "repository")
  await mkdir(path.join(repositoryRoot, version, platform), { recursive: true })
  await writeFile(path.join(repositoryRoot, version, platform, "gtfs.duckdb_extension.gz"), gzipSync(await readFile(extensionFile)))
  const requestLog = []
  const server = await startServer(zipBytes, requestLog)
  server.repositoryRoot = repositoryRoot
  t.after(() => new Promise((resolve) => server.close(() => resolve())))
  const base = `http://127.0.0.1:${server.address().port}`
  const env = { ...baseEnv, GTFS_EXTENSION_REPOSITORY: `${base}/repo` }

  const dataRoot = path.join(home, ".gtfs-viz-cli")
  const statePath = path.join(dataRoot, "current", "state.json")
  const stopDaemon = async () => {
    try {
      const { pid } = JSON.parse(await readFile(path.join(dataRoot, "daemon.json"), "utf8"))
      if (pid) process.kill(pid, "SIGTERM")
    } catch {}
  }
  t.after(stopDaemon)
  const importFeed = async (source) => {
    const result = await run(process.execPath, [cli, "import", source], { env, cwd: root })
    await stopDaemon()
    return result
  }
  const readState = async () => JSON.parse(await readFile(statePath, "utf8"))
  const leftoverDownloads = async () => (await readdir(path.join(dataRoot, "downloads")).catch(() => []))

  let baseline
  await t.test("a local zip still imports", async () => {
    const result = await importFeed(zipPath)
    assert.equal(result.code, 0, result.stderr)
    const state = await readState()
    assert.equal(state.sourcePath, zipPath)
    assert.equal(state.fileName, "sample.zip")
    assert.ok(state.counts.stops > 0, JSON.stringify(state.counts))
    baseline = state.counts
  })

  await t.test("an http URL downloads, imports and never stores the query string", async () => {
    const result = await importFeed(`${base}/feeds/sample.zip?${SECRET_QUERY}`)
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /Imported sample\.zip/)
    const stateText = await readFile(statePath, "utf8")
    const state = JSON.parse(stateText)
    assert.equal(state.sourcePath, `${base}/feeds/sample.zip`)
    assert.equal(state.fileName, "sample.zip")
    assert.deepEqual(state.counts, baseline)
    assert.deepEqual(await readFile(state.feedPath), zipBytes)
    for (const text of [stateText, result.stdout, result.stderr]) assert.ok(!text.includes("querysecret"), "signed query leaked")
    assert.deepEqual(await leftoverDownloads(), [])
  })

  await t.test("a URL whose path is not *.zip is accepted by content and named feed.zip", async () => {
    const result = await importFeed(`${base}/download?id=7`)
    assert.equal(result.code, 0, result.stderr)
    const state = await readState()
    assert.equal(state.sourcePath, `${base}/download`)
    assert.equal(state.fileName, "feed.zip")
    assert.deepEqual(state.counts, baseline)
  })

  const snapshot = async () => ({ state: await readFile(statePath, "utf8"), db: (await stat(path.join(dataRoot, "current", "gtfs.duckdb"))).size })

  await t.test("an HTTP error fails and leaves the current dataset untouched", async () => {
    const before = await snapshot()
    const result = await importFeed(`${base}/missing.zip`)
    assert.notEqual(result.code, 0)
    assert.match(result.stderr, /404/)
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual(await leftoverDownloads(), [])
  })

  await t.test("a response that is not a zip is rejected without touching the dataset", async () => {
    const before = await snapshot()
    const result = await importFeed(`${base}/page.html`)
    assert.notEqual(result.code, 0)
    assert.match(result.stderr, /zip/i)
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual(await leftoverDownloads(), [])
  })

  await t.test("credentials embedded in a URL are refused", async () => {
    const before = await snapshot()
    const result = await importFeed(`http://user:urlpassword@127.0.0.1:${server.address().port}/feeds/sample.zip`)
    assert.notEqual(result.code, 0)
    assert.ok(!(result.stdout + result.stderr).includes("urlpassword"), "URL password leaked")
    assert.deepEqual(await snapshot(), before)
  })

  await t.test("unsupported schemes fail with the supported list", async () => {
    const before = await snapshot()
    const result = await importFeed("gs://bucket/feed.zip")
    assert.notEqual(result.code, 0)
    assert.match(result.stderr, /s3:\/\//)
    assert.match(result.stderr, /https?:\/\//)
    assert.deepEqual(await snapshot(), before)
  })

  await t.test("an s3:// object downloads through DuckDB with a persistent secret", async () => {
    const created = await run(
      wrapper,
      [":memory:", "-c", `CREATE PERSISTENT SECRET gtfs_viz_test (TYPE s3, KEY_ID ${sqlString(S3_KEY_ID)}, SECRET ${sqlString(S3_SECRET)}, REGION 'us-east-1', ENDPOINT ${sqlString(`127.0.0.1:${server.address().port}`)}, URL_STYLE 'path', USE_SSL false)`],
      { env },
    )
    assert.equal(created.code, 0, created.stderr)
    requestLog.length = 0
    const result = await importFeed("s3://bucket/path/sample.zip")
    assert.equal(result.code, 0, result.stderr)
    const stateText = await readFile(statePath, "utf8")
    const state = JSON.parse(stateText)
    assert.equal(state.sourcePath, "s3://bucket/path/sample.zip")
    assert.equal(state.fileName, "sample.zip")
    assert.deepEqual(state.counts, baseline)
    const signed = requestLog.filter((entry) => entry.path === "/bucket/path/sample.zip" && entry.authorization.includes(`Credential=${S3_KEY_ID}/`))
    assert.ok(signed.length > 0, JSON.stringify(requestLog))
    for (const text of [stateText, result.stdout, result.stderr]) assert.ok(!text.includes(S3_SECRET), "secret leaked")
    assert.deepEqual(await leftoverDownloads(), [])
  })
})
