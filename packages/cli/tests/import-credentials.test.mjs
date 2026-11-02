// Every URL-credential leak input found by the reviews so far, through the real bundled CLI with
// loopback servers and a fake DuckDB that records each run. A source that does not parse and validate
// is refused before any request or DuckDB run, leaves the dataset alone, is shown only as
// "<scheme>://…" and has no part of it printed. Valid sources still go ahead with their parsed label.
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
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.stderr.on("data", (chunk) => (stderr += chunk))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })

const listen = (server, host) =>
  new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, host, () => resolve(server.address().port))
  })

const setup = async (t) => {
  const root = path.resolve(await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-import-credentials-")))
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
  // A fake DuckDB that records every run and, like the real CLI, echoes its arguments in a 404 error.
  const invocations = path.join(root, "duckdb-invocations.txt")
  const fakeDuckDb = path.join(root, "fake-duckdb.sh")
  await writeFile(fakeDuckDb, `#!/bin/sh\necho invoked >> ${JSON.stringify(invocations)}\necho "HTTP Error: HTTP HEAD error checking '$*' (HTTP 404 Not Found)" >&2\nexit 1\n`)
  await chmod(fakeDuckDb, 0o755)
  // Loopback servers on IPv4 and IPv6 that count every connection (http or a TLS attempt) and answer 404.
  let connections = 0
  const requests = []
  const servers = [http.createServer(), http.createServer()]
  for (const server of servers) {
    server.on("connection", () => (connections += 1))
    server.on("request", (req, res) => {
      requests.push(req.url)
      res.writeHead(404, { "content-type": "text/plain" }).end("not found")
    })
  }
  const port = await listen(servers[0], "127.0.0.1")
  const port6 = await listen(servers[1], "::1")
  t.after(() => Promise.all(servers.map((server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve) }))))
  const dataRoot = path.join(home, ".gtfs-viz-cli")
  const statePath = path.join(dataRoot, "current", "state.json")
  await mkdir(path.dirname(statePath), { recursive: true })
  await writeFile(statePath, '{"previous":"dataset"}')
  const env = {
    ...process.env,
    HOME: home,
    TMPDIR: path.join(root, "t"),
    DUCKDB_BIN: fakeDuckDb,
    AWS_CONFIG_FILE: path.join(root, "none"),
    AWS_SHARED_CREDENTIALS_FILE: path.join(root, "none"),
    AWS_EC2_METADATA_DISABLED: "true",
  }
  await mkdir(env.TMPDIR)
  return {
    host: `127.0.0.1:${port}`,
    host6: `[::1]:${port6}`,
    cli: (...args) => run(process.execPath, [path.join(packageRoot, "dist", "index.js"), ...args], { env, cwd: root }),
    connections: () => connections,
    requests,
    duckDbRuns: async () => (await readFile(invocations, "utf8").catch(() => "")).split("\n").filter(Boolean).length,
    state: () => readFile(statePath, "utf8"),
    downloads: () => readdir(path.join(dataRoot, "downloads")).catch(() => []),
  }
}

const KEY_ID = "KEYIDLEAK7"
const SLASH_SECRET = "SKONELEAK/SKTWOLEAK/SKTHREELEAK"
const SLASH_TOKENS = [KEY_ID, "SKONELEAK", "SKTWOLEAK", "SKTHREELEAK"]

// [input, header scheme, secret tokens that must never be printed]
const leakInputs = ({ host, host6 }) => [
  // r1: user info and passwords containing "?" or "#", plain user info, queries.
  [`http://user:LEAKPART?rest@${host}/f.zip`, "http", ["LEAKPART", "user:"]],
  [`http://user:LEAKHASH#rest@${host}/f.zip`, "http", ["LEAKHASH", "user:"]],
  [`http://user:123?LEAKNUM@${host}/f.zip`, "http", ["LEAKNUM", "user:"]],
  [`https://user:LEAKPART?a#b@${host}/feeds/f.zip?sig=querysecret0123`, "https", ["LEAKPART", "querysecret", "user:"]],
  [`http://user:urlpassword@${host}/feeds/f.zip?sig=querysecret`, "http", ["urlpassword", "querysecret", "user:"]],
  [`https://TOKENLEAK@${host}/feed.zip`, "https", ["TOKENLEAK"]],
  [`s3://AKIDLEAK:LEAKPART?x@bucket/f.zip`, "s3", ["AKIDLEAK", "LEAKPART"]],
  [`r2://AKIDLEAK:LEAKHASH#x@bucket/f.zip`, "r2", ["AKIDLEAK", "LEAKHASH"]],
  [`s3://AKIDLEAK:urlpassword@bucket/feed.zip`, "s3", ["AKIDLEAK", "urlpassword"]],
  [`r2://TOKENLEAK@bucket/feed.zip`, "r2", ["TOKENLEAK"]],
  [`s3://bucket/feed.zip?s3_secret_access_key=querysecret`, "s3", ["querysecret"]],
  [`gs://user:LEAKPART?x@bucket/f.zip`, "gs", ["LEAKPART", "user:"]],
  // r2: passwords containing an unencoded "/" (AWS secret keys), %2F and %40, several @, backslashes,
  // IPv6 with credentials, upper-case schemes, unsupported schemes with credentials and queries.
  ...["s3", "s3a", "s3n", "r2"].map((scheme) => [`${scheme}://${KEY_ID}:${SLASH_SECRET}@bucket/path/sample.zip`, scheme, SLASH_TOKENS]),
  [`https://${KEY_ID}:${SLASH_SECRET}@${host}/feeds/sample.zip`, "https", SLASH_TOKENS],
  [`http://${KEY_ID}:${SLASH_SECRET}@${host}/feeds/sample.zip?sig=querysecret0123`, "http", [...SLASH_TOKENS, "querysecret"]],
  [`HTTPS://${KEY_ID}:${SLASH_SECRET}@${host}/feeds/sample.zip`, "https", SLASH_TOKENS],
  [`S3://${KEY_ID}:${SLASH_SECRET}@bucket/path/sample.zip`, "s3", SLASH_TOKENS],
  [`http://user:pa%2FLEAKPCT@${host}/f.zip`, "http", ["LEAKPCT", "user:"]],
  [`http://user:pa%40LEAKPCT@${host}/f.zip`, "http", ["LEAKPCT", "user:"]],
  [`s3://AKIDLEAK:pa%2FLEAKPCT@bucket/f.zip`, "s3", ["AKIDLEAK", "LEAKPCT"]],
  [`http://user:LEAKA@LEAKB@${host}/f.zip`, "http", ["LEAKA", "LEAKB", "user:"]],
  [`http://user:LEAK\\BSL@${host}/f.zip`, "http", ["LEAK\\BSL", "BSL", "user:"]],
  [`http://user:LEAKV6@${host6}/f.zip`, "http", ["LEAKV6", "user:"]],
  [`HTTP://user:LEAKUP@${host}/f.zip`, "http", ["LEAKUP", "user:"]],
  [`R2://AKIDLEAK:LEAKUP@bucket/f.zip`, "r2", ["AKIDLEAK", "LEAKUP"]],
  [`gs://user:LEAKGS@bucket/feed.zip?sig=querysecret`, "gs", ["LEAKGS", "querysecret", "user:"]],
  [`ftp://user:LEAKFTP@${host}/feed.zip`, "ftp", ["LEAKFTP", "user:"]],
  [`hf://user:LEAKHF@datasets/x/feed.zip`, "hf", ["LEAKHF", "user:"]],
  [`az://user:LEAKAZ@container/feed.zip`, "az", ["LEAKAZ", "user:"]],
  [`GS://user:LEAKGS@bucket/feed.zip`, "gs", ["LEAKGS", "user:"]],
  // r3: URL parsers skip extra "/" or "\" after http(s):, so these still carry user info.
  [`http:///user:SECRETPW@${host}/feeds/sample.zip`, "http", ["SECRETPW", "user:"]],
  [`HTTP:///user:SECRETPW@${host}/feeds/sample.zip`, "http", ["SECRETPW", "user:"]],
  [`https:///user:SECRETPW@${host}/feeds/sample.zip`, "https", ["SECRETPW", "user:"]],
  [`http://\\/user:SECRETPW@${host}/feeds/sample.zip`, "http", ["SECRETPW", "user:"]],
  [`http:////TOKENONLYSECRET@${host}/feeds/sample.zip`, "http", ["TOKENONLYSECRET"]],
  [`http:///${host}?LEAKSLASHNUM@${host}/f.zip`, "http", ["LEAKSLASHNUM"]],
  // r3: forms every URL parser reads as host, port and a path holding "@": a digits port, an empty
  // port, and no colon at all. The "user" part is a loopback name so nothing leaves the machine.
  [`http://127.0.0.1:${host.split(":")[1]}/SECRETPW@${host}/feeds/sample.zip`, "http", ["SECRETPW"]],
  [`http://localhost:/SECRETPW@${host}/feeds/sample.zip`, "http", ["SECRETPW", "localhost:"]],
  [`http://localhost/TOKENB@${host}/feeds/sample.zip`, "http", ["TOKENB", "localhost/"]],
  // Remote sources with control characters and invalid buckets.
  [`s3://bucket/\u001b[31mINJECTED\nline.zip`, "s3", ["INJECTED", "\u001b"]],
  [`s3://bucket:9000/feed.zip`, "s3", ["bucket:9000"]],
]

test("sources that fail to parse or validate are refused before any request or DuckDB run and shown only as <scheme>://…", async (t) => {
  const env = await setup(t)
  const before = await env.state()
  const failures = []
  for (const [input, scheme, secrets] of leakInputs(env)) {
    const connections = env.connections()
    const runs = await env.duckDbRuns()
    const result = await env.cli("import", input)
    const output = result.stdout + result.stderr
    const problems = []
    if (result.code === 0) problems.push("exit 0")
    if (env.connections() !== connections) problems.push(`${env.connections() - connections} connection(s)`)
    if ((await env.duckDbRuns()) !== runs) problems.push("DuckDB ran")
    if ((await env.state()) !== before) problems.push("state.json changed")
    if ((await env.downloads()).length) problems.push("download left behind")
    if (result.stderr.split("\n")[0] !== `Import failed: ${scheme}://…`) problems.push(`header ${JSON.stringify(result.stderr.split("\n")[0])}`)
    const leaked = secrets.filter((secret) => output.includes(secret))
    if (leaked.length) problems.push(`leaked ${JSON.stringify(leaked)}`)
    if (problems.length) failures.push(`${JSON.stringify(input)}: ${problems.join(", ")}\n    ${JSON.stringify(result.stderr)}`)
  }
  assert.deepEqual(failures, [], `\n${failures.join("\n")}`)
})

test("an unencoded @ in an http(s) URL path is refused with %40 guidance, while %40 is accepted", async (t) => {
  const env = await setup(t)
  for (const input of [`http://${env.host}/@team/feed.zip?sig=querysecret0123`, `http://${env.host6}/@x/feed.zip`]) {
    const connections = env.connections()
    const result = await env.cli("import", input)
    assert.notEqual(result.code, 0, input)
    assert.equal(env.connections(), connections, `${input} was requested`)
    assert.equal(result.stderr.split("\n")[0], "Import failed: http://…", result.stderr)
    assert.match(result.stderr, /%40/)
    assert.match(result.stderr, /never put a user name or password in a URL/)
    assert.ok(!result.stderr.includes("@team") && !result.stderr.includes("querysecret"), result.stderr)
  }
  const accepted = await env.cli("import", `http://${env.host}/%40team/missing.zip?sig=querysecret0123`)
  assert.notEqual(accepted.code, 0)
  assert.equal(accepted.stderr.split("\n")[0], `Import failed: http://${env.host}/%40team/missing.zip`, accepted.stderr)
  assert.match(accepted.stderr, /404/)
  assert.equal(env.requests.at(-1), "/%40team/missing.zip?sig=querysecret0123")
})

test("valid sources still download and are shown by their parsed label", async (t) => {
  const env = await setup(t)
  for (const [input, label] of [
    [`HTTP://${env.host}/feeds/missing.zip`, `http://${env.host}/feeds/missing.zip`],
    [`http://${env.host6}/%40x/missing.zip?sig=querysecret0123`, `http://${env.host6}/%40x/missing.zip`],
    [`http://${env.host}/caf%C3%A9 v2/missing.zip`, `http://${env.host}/caf%C3%A9%20v2/missing.zip`],
  ]) {
    const requests = env.requests.length
    const result = await env.cli("import", input)
    assert.notEqual(result.code, 0, input)
    assert.equal(env.requests.length, requests + 1, `${input} was not requested`)
    assert.equal(result.stderr.split("\n")[0], `Import failed: ${label}`, result.stderr)
    assert.ok(!result.stderr.includes("querysecret"), result.stderr)
  }
  for (const [input, label] of [
    ["s3://my-bucket/gtfs/feed.zip", "s3://my-bucket/gtfs/feed.zip"],
    ["s3://my.bucket.name/gtfs/feed.zip", "s3://my.bucket.name/gtfs/feed.zip"],
    ["S3A://Legacy_Bucket/gtfs/feed.zip", "s3a://Legacy_Bucket/gtfs/feed.zip"],
    ["s3://bucket/@team/feed.zip", "s3://bucket/@team/feed.zip"],
  ]) {
    const runs = await env.duckDbRuns()
    const result = await env.cli("import", input)
    assert.notEqual(result.code, 0, input)
    assert.ok((await env.duckDbRuns()) > runs, `${input} never reached DuckDB`)
    assert.equal(result.stderr.split("\n")[0], `Import failed: ${label}`, result.stderr)
  }
})
