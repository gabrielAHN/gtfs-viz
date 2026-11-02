// Remote feed downloads: http(s) through fetch, s3/r2 objects through the DuckDB CLI with
// secret lookup -> credential_chain -> anonymous fallback, zip validation and temp-file cleanup.
import assert from "node:assert/strict"
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("fixture zip bytes")])

const bundle = async (directory, entry, name) => {
  const outfile = path.join(directory, `${name}.mjs`)
  await build({ entryPoints: [new URL(entry, import.meta.url).pathname], outfile, bundle: true, format: "esm", platform: "node" })
  return outfile
}

// A fake DuckDB CLI: records each -c script, prints a WARNING first (as DuckDB 2.0 does on stdout),
// then runs the statements in order and stops at the first failure, like the real CLI.
const FAKE_DUCKDB = `#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
const args = process.argv.slice(2)
const sql = args[args.indexOf("-c") + 1] ?? ""
const config = JSON.parse(readFileSync(process.env.FAKE_DUCKDB_CONFIG, "utf8"))
appendFileSync(config.calls, JSON.stringify(sql) + "\\n")
process.stdout.write("WARNING:\\nsomething is deprecated\\n\\n")
const fail = (message) => { process.stderr.write(message + "\\n"); process.exit(1) }
if (/which_secret/.test(sql)) {
  for (const name of config.secrets ?? []) process.stdout.write("gtfs-viz-secret:" + name + "\\n")
  process.exit(0)
}
for (const statement of sql.split(/;\\s*/).map((part) => part.trim()).filter(Boolean)) {
  if (/^CREATE TEMPORARY SECRET/.test(statement)) {
    if (config.credentialChain === "fail-warning") process.stderr.write("WARNING:\\nSet region explicitly using REGION 'us-east-1' in your CREATE SECRET statement.\\n\\n")
    if (/^fail/.test(config.credentialChain ?? "")) fail("Invalid Configuration Error: Secret Validation Failure: no profile 'default' found in config file")
    process.stdout.write("true\\n")
    continue
  }
  const select = /^SELECT '([^']*)'$/.exec(statement)
  if (select) { process.stdout.write(select[1] + "\\n"); continue }
  const copy = /^COPY \\(SELECT content FROM read_blob\\('((?:[^']|'')*)'\\)\\) TO '((?:[^']|'')*)' \\(FORMAT blob\\)$/.exec(statement)
  if (copy) {
    if (config.copy === "404") fail("HTTP Error: HTTP HEAD error checking '" + copy[1].replaceAll("''", "'") + "' (HTTP 404 Not Found)")
    writeFileSync(copy[2].replaceAll("''", "'"), Buffer.from(config.body, "base64"))
    continue
  }
  fail("Parser Error: unexpected statement " + statement)
}
`

const setup = async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-remote-download-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const fake = path.join(directory, "fake-duckdb.mjs")
  await writeFile(fake, FAKE_DUCKDB)
  await chmod(fake, 0o755)
  const previous = { DUCKDB_BIN: process.env.DUCKDB_BIN, FAKE_DUCKDB_CONFIG: process.env.FAKE_DUCKDB_CONFIG }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.DUCKDB_BIN = fake
  const calls = path.join(directory, "calls.jsonl")
  const configure = async (config) => {
    process.env.FAKE_DUCKDB_CONFIG = path.join(directory, "config.json")
    await writeFile(process.env.FAKE_DUCKDB_CONFIG, JSON.stringify({ calls, body: ZIP.toString("base64"), ...config }))
  }
  const download = await import(`${pathToFileURL(await bundle(directory, "../src/remote/download.ts", "download")).href}?dir=${path.basename(directory)}`)
  const source = await import(pathToFileURL(await bundle(directory, "../src/remote/source.ts", "source")).href)
  const downloads = path.join(directory, "downloads")
  return {
    configure,
    downloads,
    parse: source.parseFeedSource,
    downloadFeed: download.downloadFeed,
    calls: async () => (await readFile(calls, "utf8").catch(() => "")).split("\n").filter(Boolean).map((line) => JSON.parse(line)),
    leftovers: async () => readdir(downloads).catch(() => []),
  }
}

test("an s3 object with a matching DuckDB secret downloads with one COPY and no temporary secret", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: ["my_persistent_s3"] })
  const result = await env.downloadFeed(env.parse("s3://bucket/path/sample.zip"), env.downloads)
  assert.deepEqual(await readFile(result.file), ZIP)
  assert.equal(result.size, ZIP.length)
  assert.equal(path.dirname(result.file), env.downloads)
  assert.match(path.basename(result.file), /^[0-9a-f-]{16,}\.zip$/)
  const calls = await env.calls()
  assert.equal(calls.length, 2, JSON.stringify(calls))
  assert.match(calls[0], /which_secret\('s3:\/\/bucket\/path\/sample\.zip', 's3'\)/)
  assert.match(calls[1], /^COPY \(SELECT content FROM read_blob\('s3:\/\/bucket\/path\/sample\.zip'\)\) TO '.*\.zip' \(FORMAT blob\);?$/)
})

test("an s3 object without a secret creates a temporary credential_chain secret in the same DuckDB process", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: [] })
  const result = await env.downloadFeed(env.parse("s3a://bucket/feed.zip"), env.downloads)
  assert.deepEqual(await readFile(result.file), ZIP)
  const calls = await env.calls()
  assert.equal(calls.length, 2, JSON.stringify(calls))
  assert.match(calls[0], /which_secret\('s3a:\/\/bucket\/feed\.zip', 's3'\)/)
  assert.match(calls[1], /^CREATE TEMPORARY SECRET \w+ \(TYPE s3, PROVIDER credential_chain\);[\s\S]*COPY \(SELECT content FROM read_blob\('s3a:\/\/bucket\/feed\.zip'\)\)/)
})

test("when credential_chain finds no credentials the COPY is retried anonymously", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: [], credentialChain: "fail" })
  const result = await env.downloadFeed(env.parse("s3://public-bucket/feeds/feed.zip"), env.downloads)
  assert.deepEqual(await readFile(result.file), ZIP)
  const calls = await env.calls()
  assert.equal(calls.length, 3, JSON.stringify(calls))
  assert.match(calls[1], /PROVIDER credential_chain/)
  assert.doesNotMatch(calls[2], /SECRET/)
  assert.match(calls[2], /^COPY \(SELECT content FROM read_blob\('s3:\/\/public-bucket\/feeds\/feed\.zip'\)\)/)
})

test("when credential_chain cannot create a secret, the anonymous failure includes DuckDB's reason", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: [], credentialChain: "fail", copy: "404" })
  await assert.rejects(env.downloadFeed(env.parse("s3://private-bucket/feed.zip"), env.downloads), (error) => {
    assert.match(error.message, /HTTP 404 Not Found/)
    assert.ok(
      error.message.includes("credential_chain could not create a secret (Invalid Configuration Error: Secret Validation Failure: no profile 'default' found in config file), so the object was requested anonymously"),
      error.message,
    )
    assert.doesNotMatch(error.message, /found no AWS credentials/)
    return true
  })
  assert.equal((await env.calls()).length, 3)
  assert.deepEqual(await env.leftovers(), [])
})

test("DuckDB WARNING lines are left out of the credential_chain reason", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: [], credentialChain: "fail-warning", copy: "404" })
  await assert.rejects(env.downloadFeed(env.parse("s3://private-bucket/feed.zip"), env.downloads), (error) => {
    assert.ok(error.message.includes("could not create a secret (Invalid Configuration Error: Secret Validation Failure: no profile 'default' found in config file)"), error.message)
    assert.doesNotMatch(error.message, /WARNING|Set region/)
    return true
  })
})

test("a failed COPY after the secret was created is reported with a credentials hint and no retry", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: [], copy: "404" })
  await assert.rejects(env.downloadFeed(env.parse("s3://my-gtfs-bucket/missing.zip"), env.downloads), (error) => {
    assert.match(error.message, /HTTP 404 Not Found/)
    assert.match(error.message, /s3:\/\/my-gtfs-bucket\/missing\.zip/)
    assert.match(error.message, /PERSISTENT SECRET/)
    assert.match(error.message, /AWS/)
    assert.doesNotMatch(error.message, /gtfs execution failed|FORCE INSTALL/)
    return true
  })
  assert.equal((await env.calls()).length, 2)
  assert.deepEqual(await env.leftovers(), [])
})

test("an r2 object without a matching secret fails with R2 secret guidance before any download", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: [] })
  await assert.rejects(env.downloadFeed(env.parse("r2://bucket/feed.zip"), env.downloads), (error) => {
    assert.match(error.message, /CREATE PERSISTENT SECRET \(TYPE r2, KEY_ID/)
    assert.match(error.message, /ACCOUNT_ID/)
    return true
  })
  const calls = await env.calls()
  assert.equal(calls.length, 1, JSON.stringify(calls))
  assert.match(calls[0], /which_secret\('r2:\/\/bucket\/feed\.zip', 'r2'\)/)
  assert.deepEqual(await env.leftovers(), [])
})

test("object URLs and paths are escaped as SQL literals", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: ["s"] })
  const result = await env.downloadFeed(env.parse("s3://bucket/o'hare.zip"), env.downloads)
  assert.deepEqual(await readFile(result.file), ZIP)
  const calls = await env.calls()
  assert.match(calls[0], /which_secret\('s3:\/\/bucket\/o''hare\.zip', 's3'\)/)
  assert.match(calls[1], /read_blob\('s3:\/\/bucket\/o''hare\.zip'\)/)
})

test("a downloaded object that is not a zip is rejected and removed", async (t) => {
  const env = await setup(t)
  await env.configure({ secrets: ["s"], body: Buffer.from("<html>not a feed</html>").toString("base64") })
  await assert.rejects(env.downloadFeed(env.parse("s3://bucket/feed.zip"), env.downloads), /not a zip archive/)
  assert.deepEqual(await env.leftovers(), [])
})

const startServer = async (t) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1")
    if (url.pathname === "/feed.zip") return res.writeHead(200, { "content-type": "application/zip" }).end(ZIP)
    if (url.pathname === "/redirect") return res.writeHead(302, { location: "/feed.zip" }).end()
    if (url.pathname === "/empty") return res.writeHead(200).end()
    if (url.pathname === "/page.html") return res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html>")
    if (url.pathname === "/forbidden.zip") return res.writeHead(403).end("denied")
    if (url.pathname === "/cut.zip") {
      // Promises more bytes than it sends, then drops the connection mid-body.
      res.writeHead(200, { "content-length": 100000 })
      res.write(Buffer.concat([ZIP, Buffer.alloc(5000)]))
      return setTimeout(() => res.socket.destroy(), 50)
    }
    res.writeHead(404).end("missing")
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}

test("http downloads stream the body, follow redirects and use the full URL", async (t) => {
  const env = await setup(t)
  const base = await startServer(t)
  const direct = await env.downloadFeed(env.parse(`${base}/feed.zip?token=querysecret`), env.downloads)
  assert.deepEqual(await readFile(direct.file), ZIP)
  assert.equal(direct.size, ZIP.length)
  const redirected = await env.downloadFeed(env.parse(`${base}/redirect`), env.downloads)
  assert.deepEqual(await readFile(redirected.file), ZIP)
  assert.notEqual(direct.file, redirected.file)
  assert.deepEqual(await env.calls(), [], "http downloads never start DuckDB")
})

test("http failures report the status and redacted URL and leave no temporary file", async (t) => {
  const env = await setup(t)
  const base = await startServer(t)
  const cases = [
    [`${base}/missing.zip?token=querysecret`, /404/],
    [`${base}/forbidden.zip?token=querysecret`, /403/],
    [`${base}/empty?token=querysecret`, /empty/i],
    [`${base}/page.html?token=querysecret`, /not a zip archive/],
  ]
  for (const [input, expected] of cases) {
    await assert.rejects(env.downloadFeed(env.parse(input), env.downloads), (error) => {
      assert.match(error.message, expected)
      assert.ok(error.message.includes(input.split("?")[0]), error.message)
      assert.ok(!error.message.includes("querysecret"), error.message)
      return true
    }, input)
  }
  assert.deepEqual(await env.leftovers(), [])
})

test("a connection cut mid-download names the source and leaves no temporary file", async (t) => {
  const env = await setup(t)
  const base = await startServer(t)
  await assert.rejects(env.downloadFeed(env.parse(`${base}/cut.zip?sig=querysecret0123`), env.downloads), (error) => {
    assert.ok(error.message.startsWith(`Download failed for ${base}/cut.zip: `), error.message)
    assert.match(error.message, /terminated/)
    assert.ok(!error.message.includes("querysecret"), error.message)
    return true
  })
  assert.deepEqual(await env.leftovers(), [])
})
