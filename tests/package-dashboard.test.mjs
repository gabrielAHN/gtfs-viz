// Edge cases of scripts/package-dashboard.mjs beyond the split acceptance test: long paths,
// paths that cannot fit a ustar header, links, and compatibility with the system tar.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { gunzipSync } from "node:zlib"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const script = path.join(root, "scripts", "package-dashboard.mjs")
const commit = "c".repeat(40)

const pack = (dist, out, ...extra) =>
  spawnSync(
    process.execPath,
    [script, "--dist", dist, "--out", out, "--version", "1.6.0", "--commit", commit, ...extra],
    { encoding: "utf8" },
  )

const headers = (tar) => {
  const result = []
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const text = (start, length) =>
      header.toString("utf8", start, start + length).replace(/\0.*$/s, "")
    const size = parseInt(text(124, 12) || "0", 8)
    let sum = 0
    for (let index = 0; index < 512; index++) {
      sum += index >= 148 && index < 156 ? 0x20 : header[index]
    }
    result.push({
      name: text(0, 100),
      prefix: text(345, 155),
      checksumOk: parseInt(text(148, 8).trim(), 8) === sum,
    })
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return result
}

const fixture = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-dashboard-edge-"))
  const dist = path.join(dir, "dist")
  await mkdir(dist)
  await writeFile(path.join(dist, "index.html"), "<!doctype html>")
  return { dir, dist }
}

test("paths over 100 bytes go into the ustar prefix field and round-trip", async () => {
  const { dir, dist } = await fixture()
  const deep = path.join(dist, "assets", "a".repeat(60), "b".repeat(60))
  await mkdir(deep, { recursive: true })
  const file = `${"c".repeat(90)}.js`
  await writeFile(path.join(deep, file), "deep")
  const result = pack(dist, path.join(dir, "out"))
  assert.equal(result.status, 0, result.stderr)

  const tar = gunzipSync(await readFile(path.join(dir, "out", "gtfs-viz-dashboard.tar.gz")))
  const all = headers(tar)
  assert.ok(all.every((entry) => entry.checksumOk))
  const full = `dashboard/assets/${"a".repeat(60)}/${"b".repeat(60)}/${file}`
  const entry = all.find((item) => `${item.prefix}/${item.name}` === full)
  assert.ok(entry, "the long file is stored with a prefix")
  assert.ok(Buffer.byteLength(entry.prefix) <= 155 && Buffer.byteLength(entry.name) <= 100)

  // The system tar (GNU tar on Linux, bsdtar on macOS) reads the same paths back.
  const listed = spawnSync("tar", ["-tzf", path.join(dir, "out", "gtfs-viz-dashboard.tar.gz")], {
    encoding: "utf8",
  })
  assert.equal(listed.status, 0, listed.stderr)
  assert.ok(listed.stdout.split("\n").includes(full), listed.stdout)
  const extracted = path.join(dir, "extract")
  await mkdir(extracted)
  const untar = spawnSync(
    "tar",
    ["-xzf", path.join(dir, "out", "gtfs-viz-dashboard.tar.gz"), "-C", extracted],
    { encoding: "utf8" },
  )
  assert.equal(untar.status, 0, untar.stderr)
  assert.equal(await readFile(path.join(extracted, full), "utf8"), "deep")
})

test("a path that cannot fit a ustar header fails clearly", async () => {
  const { dir, dist } = await fixture()
  await mkdir(path.join(dist, "assets"))
  await writeFile(path.join(dist, "assets", `${"x".repeat(120)}.js`), "long name")
  const result = pack(dist, path.join(dir, "out"))
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /cannot be stored in a ustar header/)
  assert.match(result.stderr, /x{120}\.js/)
})

test("symlinks are refused instead of packed", async () => {
  const { dir, dist } = await fixture()
  await symlink("index.html", path.join(dist, "alias.html"))
  const result = pack(dist, path.join(dir, "out"))
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /symlink/)
})

test("version and commit are validated", async () => {
  const { dir, dist } = await fixture()
  const badCommit = spawnSync(
    process.execPath,
    [script, "--dist", dist, "--out", dir, "--version", "1.6.0", "--commit", "HEAD"],
    { encoding: "utf8" },
  )
  assert.notEqual(badCommit.status, 0)
  assert.match(badCommit.stderr, /--commit/)
  const badVersion = spawnSync(
    process.execPath,
    [script, "--dist", dist, "--out", dir, "--version", "v1.6", "--commit", commit],
    { encoding: "utf8" },
  )
  assert.notEqual(badVersion.status, 0)
  assert.match(badVersion.stderr, /--version/)
})

test("the gzip header is platform independent", async () => {
  const { dir, dist } = await fixture()
  const result = pack(dist, path.join(dir, "out"))
  assert.equal(result.status, 0, result.stderr)
  const bytes = await readFile(path.join(dir, "out", "gtfs-viz-dashboard.tar.gz"))
  assert.equal(bytes[3], 0, "no FTEXT/FHCRC/FEXTRA/FNAME/FCOMMENT flags")
  assert.equal(bytes.readUInt32LE(4), 0, "mtime 0")
  assert.equal(bytes[9], 0xff, "OS byte pinned to 255 (unknown)")
})
