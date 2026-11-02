// Import source parsing: local paths, http(s) URLs and s3/s3a/s3n/r2 object references, with
// display metadata that never carries query strings, fragments or URL credentials.
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

const loadSourceModule = async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-remote-source-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const outfile = path.join(directory, "source.mjs")
  await build({
    entryPoints: [new URL("../src/remote/source.ts", import.meta.url).pathname],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
  })
  return import(pathToFileURL(outfile).href)
}

test("local paths, including Windows drive paths, stay local", async (t) => {
  const { parseFeedSource } = await loadSourceModule(t)
  for (const input of ["/data/feed.zip", "feed.zip", "./feeds/feed.ZIP", "C:\\data\\feed.zip", "C:/data/feed.zip", "c://data/feed.zip"]) {
    assert.deepEqual(parseFeedSource(input), { kind: "local", path: input, label: path.basename(input) }, input)
  }
})

test("http(s) URLs download from the full URL but display it without query, fragment or credentials", async (t) => {
  const { parseFeedSource } = await loadSourceModule(t)
  assert.deepEqual(parseFeedSource("https://example.test/feeds/Sample%20Feed.ZIP?X-Amz-Signature=abc123#part"), {
    kind: "http",
    url: "https://example.test/feeds/Sample%20Feed.ZIP?X-Amz-Signature=abc123",
    sourcePath: "https://example.test/feeds/Sample%20Feed.ZIP",
    fileName: "Sample Feed.ZIP",
    label: "https://example.test/feeds/Sample%20Feed.ZIP",
  })
  assert.deepEqual(parseFeedSource("HTTP://127.0.0.1:8080/download?id=7"), {
    kind: "http",
    url: "http://127.0.0.1:8080/download?id=7",
    sourcePath: "http://127.0.0.1:8080/download",
    fileName: "feed.zip",
    label: "http://127.0.0.1:8080/download",
  })
  assert.equal(parseFeedSource("https://example.test/a/%2Fetc%2Fpasswd.zip").fileName, "feed.zip")
  assert.equal(parseFeedSource("https://example.test/a/bad%E0.zip").fileName, "bad%E0.zip")
})

test("file names with C1 controls or bidi and invisible formatting characters fall back to feed.zip", async (t) => {
  const { parseFeedSource } = await loadSourceModule(t)
  for (const encoded of [
    "%C2%9B31mred.zip", "%C2%80a.zip", "%C2%9Fa.zip",
    "%E2%80%AEpiz.exe.zip", "%E2%80%AAa.zip", "%E2%80%8Ba.zip", "%E2%80%8Fa.zip",
    "%E2%81%A0a.zip", "%E2%81%A9a.zip", "%EF%BB%BFa.zip",
  ]) {
    assert.equal(parseFeedSource(`https://example.test/${encoded}`).fileName, "feed.zip", encoded)
  }
  assert.equal(parseFeedSource("s3://bucket/\u202Epiz.exe.zip").fileName, "feed.zip")
  assert.equal(parseFeedSource("https://example.test/caf%C3%A9%20%E2%80%94%20v2.zip").fileName, "café — v2.zip")
})

test("s3, s3a, s3n and r2 object references keep their exact key", async (t) => {
  const { parseFeedSource } = await loadSourceModule(t)
  assert.deepEqual(parseFeedSource("s3://bucket/path/sample.zip"), {
    kind: "object",
    secretType: "s3",
    url: "s3://bucket/path/sample.zip",
    sourcePath: "s3://bucket/path/sample.zip",
    fileName: "sample.zip",
    label: "s3://bucket/path/sample.zip",
  })
  assert.equal(parseFeedSource("S3A://bucket/a/feed.zip").url, "s3a://bucket/a/feed.zip")
  assert.equal(parseFeedSource("s3n://bucket/a/feed.zip").secretType, "s3")
  const r2 = parseFeedSource("r2://bucket/my feed.zip")
  assert.equal(r2.secretType, "r2")
  assert.equal(r2.url, "r2://bucket/my feed.zip")
  assert.equal(r2.fileName, "my feed.zip")
  assert.equal(parseFeedSource("s3://bucket/latest").fileName, "feed.zip")
})

test("credentials embedded in a URL are refused without echoing them", async (t) => {
  const { parseFeedSource } = await loadSourceModule(t)
  for (const input of [
    "http://user:urlpassword@127.0.0.1:9/feeds/sample.zip",
    "https://ghp_tokenvalue@example.test/feed.zip",
    "s3://AKIDVALUE:urlpassword@bucket/feed.zip",
    "r2://ghp_tokenvalue@bucket/feed.zip",
  ]) {
    assert.throws(() => parseFeedSource(input), (error) => {
      assert.match(error.message, /credentials/i)
      assert.match(error.message, /secret/i)
      for (const leaked of ["urlpassword", "ghp_tokenvalue", "AKIDVALUE"]) assert.ok(!error.message.includes(leaked), `${leaked} leaked: ${error.message}`)
      return true
    }, input)
  }
})

// The user info runs to the last @ before the first / after scheme://, so a password that contains an
// unencoded ? or # is still user info: it is refused before any parsing or request and never displayed.
const PASSWORD_INPUTS = [
  ["http://user:LEAKPART?rest@127.0.0.1:9/f.zip", "http://127.0.0.1:9/f.zip"],
  ["http://user:LEAKHASH#rest@127.0.0.1:9/f.zip", "http://127.0.0.1:9/f.zip"],
  ["http://user:123?LEAKNUM@host/f.zip", "http://host/f.zip"],
  ["https://user:LEAKPART?a#b@example.test/feeds/f.zip?sig=querysecret0123", "https://example.test/feeds/f.zip"],
  ["s3://AKID:LEAKPART?x@bucket/f.zip", "s3://bucket/f.zip"],
  ["r2://AKID:LEAKHASH#x@bucket/f.zip", "r2://bucket/f.zip"],
  ["gs://user:LEAKPART?x@bucket/f.zip", "gs://bucket/f.zip"],
]
const LEAKS = ["LEAKPART", "LEAKHASH", "LEAKNUM", "user:", "AKID", "querysecret"]

test("a password containing ? or # is refused before parsing and never displayed", async (t) => {
  const { parseFeedSource, sourceLabel, redactSource } = await loadSourceModule(t)
  for (const [input, label] of PASSWORD_INPUTS) {
    assert.equal(sourceLabel(input), label, input)
    for (const message of [`Invalid URL: ${input}`, `request to ${input} failed`, `Import failed: ${input.slice(0, input.indexOf("@"))}`]) {
      const redacted = redactSource(message, input)
      for (const leaked of LEAKS) assert.ok(!redacted.includes(leaked), `${leaked} leaked: ${redacted}`)
    }
    assert.throws(() => parseFeedSource(input), (error) => {
      if (!input.startsWith("gs:")) assert.match(error.message, /embedded credentials/, input)
      for (const leaked of LEAKS) assert.ok(!error.message.includes(leaked), `${leaked} leaked: ${error.message}`)
      return true
    }, input)
  }
})

test("an @ in the path or key is not user info", async (t) => {
  const { parseFeedSource, sourceLabel, redactSource } = await loadSourceModule(t)
  assert.equal(sourceLabel("https://host/@team/feed.zip?sig=querysecret0123"), "https://host/@team/feed.zip")
  assert.equal(parseFeedSource("https://host/@team/feed.zip").label, "https://host/@team/feed.zip")
  assert.equal(sourceLabel("s3://bucket/a@b/feed.zip"), "s3://bucket/a@b/feed.zip")
  assert.equal(parseFeedSource("s3://bucket/a@b/feed.zip").sourcePath, "s3://bucket/a@b/feed.zip")
  const message = "Download failed for https://host/@team/feed.zip: HTTP 404 Not Found"
  assert.equal(redactSource(message, "https://host/@team/feed.zip"), message)
})

test("redactSource hides long query values behind a placeholder and leaves short words intact", async (t) => {
  const { redactSource } = await loadSourceModule(t)
  assert.equal(
    redactSource("Downloaded file is not a zip archive: https://h/f", "https://h/f?format=zip"),
    "Downloaded file is not a zip archive: https://h/f",
  )
  const input = "https://h/f.zip?X-Amz-Signature=querysecret0123456789&format=zip"
  assert.equal(
    redactSource("rejected X-Amz-Signature=querysecret0123456789 (querysecret0123456789) for a zip", input),
    "rejected X-Amz-Signature=… (…) for a zip",
  )
  const query = "?X-Amz-Signature=querysecret0123456789&format=zip"
  assert.equal(redactSource(`GET ${input}, then ${encodeURIComponent(query)} and ${query}`, input), "GET https://h/f.zip, then  and ")
})

test("object references must name one object without a query, fragment or wildcard", async (t) => {
  const { parseFeedSource } = await loadSourceModule(t)
  for (const input of ["s3://bucket", "s3://bucket/", "s3:///feed.zip", "r2://bucket"]) {
    assert.throws(() => parseFeedSource(input), /<bucket>\/<key>/, input)
  }
  for (const input of ["s3://bucket/feed.zip?s3_secret_access_key=topsecret", "s3://bucket/feed.zip#topsecret"]) {
    assert.throws(() => parseFeedSource(input), (error) => {
      assert.match(error.message, /query string|fragment/i)
      assert.ok(!error.message.includes("topsecret"), error.message)
      return true
    }, input)
  }
  for (const input of ["s3://bucket/*.zip", "s3://bucket/feeds/[ab].zip"]) {
    assert.throws(() => parseFeedSource(input), /wildcard/i, input)
  }
})

test("remote sources with control characters are refused without echoing them", async (t) => {
  const { parseFeedSource, sourceLabel } = await loadSourceModule(t)
  for (const input of [
    "s3://bucket/x\nINJECTED.zip",
    "r2://bucket/\u001b[31mINJECTED.zip",
    "https://example.test/a\tINJECTED.zip",
    "http://example.test/\u0085INJECTED.zip",
    "s3a://bucket/\u007fINJECTED.zip",
    "https://example.test/f.zip?sig=\u0000INJECTED",
  ]) {
    assert.throws(() => parseFeedSource(input), (error) => {
      assert.match(error.message, /control characters/i)
      assert.ok(!error.message.includes("INJECTED"), error.message)
      return true
    }, JSON.stringify(input))
    assert.doesNotMatch(sourceLabel(input), /[\u0000-\u001f\u007f-\u009f]/, JSON.stringify(input))
  }
})

test("unsupported schemes fail with the supported forms and without leaking credentials", async (t) => {
  const { parseFeedSource } = await loadSourceModule(t)
  for (const input of ["gs://bucket/feed.zip", "gcs://bucket/feed.zip", "az://container/feed.zip", "abfss://c@acct.dfs.core.windows.net/feed.zip", "hf://datasets/x/feed.zip", "ftp://host/feed.zip", "file:///tmp/feed.zip", "gs://user:pw0123@bucket/feed.zip?sig=sigsecret"]) {
    assert.throws(() => parseFeedSource(input), (error) => {
      for (const form of [/\.zip/, /https?:\/\//, /s3:\/\//, /r2:\/\//]) assert.match(error.message, form)
      assert.ok(!error.message.includes("pw0123") && !error.message.includes("sigsecret"), error.message)
      return true
    }, input)
  }
})

test("sourceLabel and redactSource never expose queries, fragments or URL credentials", async (t) => {
  const { sourceLabel, redactSource } = await loadSourceModule(t)
  assert.equal(sourceLabel("/data/feeds/feed.zip"), "feed.zip")
  assert.equal(sourceLabel("https://user:pw0123@example.test/a/feed.zip?sig=sigsecret#frag"), "https://example.test/a/feed.zip")
  assert.equal(sourceLabel("gs://user:pw0123@bucket/feed.zip?sig=sigsecret"), "gs://bucket/feed.zip")
  const input = "https://user:pw0123@example.test/a/feed.zip?sig=sigsecret&token=tokensecret"
  const message = `failed for ${input}; retry ${encodeURIComponent("?sig=sigsecret")} and tokensecret`
  const redacted = redactSource(message, input)
  for (const leaked of ["pw0123", "sigsecret", "tokensecret"]) assert.ok(!redacted.includes(leaked), redacted)
  assert.ok(redacted.includes("https://example.test/a/feed.zip"), redacted)
  assert.equal(redactSource("plain message", "/data/feed.zip"), "plain message")
})
