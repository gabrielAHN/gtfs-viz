// Acceptance contract for moving the CLI to gabrielAHN/gtfs-tools (see the split CONTRACT.md).
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { gunzipSync } from "node:zlib"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relative) => readFileSync(path.join(root, relative), "utf8")
const tracked = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean)

// Minimal ustar reader: [{ name, type, mode, uid, gid, mtime, uname, gname, size, body }].
const readUstar = (tar) => {
  const entries = []
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const text = (start, length) => header.toString("utf8", start, start + length).replace(/\0.*$/s, "")
    const number = (start, length) => parseInt(text(start, length).trim() || "0", 8)
    const prefix = text(345, 155)
    const name = (prefix ? `${prefix}/` : "") + text(0, 100)
    const size = number(124, 12)
    entries.push({
      name,
      type: text(156, 1) || "0",
      mode: number(100, 8),
      uid: number(108, 8),
      gid: number(116, 8),
      size,
      mtime: number(136, 12),
      uname: text(265, 32),
      gname: text(297, 32),
      magic: header.toString("utf8", 257, 262),
      body: tar.subarray(offset + 512, offset + 512 + size),
    })
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

test("the CLI package is gone from gtfs-viz", () => {
  assert.equal(existsSync(path.join(root, "packages", "cli")), false)
  const pkg = JSON.parse(read("package.json"))
  for (const [name, script] of Object.entries(pkg.scripts)) {
    assert.doesNotMatch(`${name} ${script}`, /packages\/cli|build:cli|gtfs-viz-cli|^cli(:|\s)/, name)
  }
  const workspaces = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages ?? []
  assert.equal(workspaces.includes("packages/cli"), false)
  const code = tracked.filter(
    (file) =>
      !/^(CHANGELOG\.md|packages\/docs\/src\/content\.ts|tests\/split\.acceptance\.test\.mjs)$/.test(file) &&
      /\.(m?[jt]sx?|json|ya?ml|sh)$/.test(file) &&
      file !== "yarn.lock",
  )
  const offenders = code.filter((file) => /packages\/cli\b|@gabrielahn\/gtfs-viz-cli\b/.test(read(file)))
  assert.deepEqual(offenders, [])
})

test("package-dashboard writes a reproducible, contract-shaped archive", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-dashboard-"))
  const dist = path.join(dir, "dist")
  await mkdir(path.join(dist, "assets"), { recursive: true })
  await mkdir(path.join(dist, "font"), { recursive: true })
  await writeFile(path.join(dist, "index.html"), "<!doctype html><title>GTFS Viz</title>")
  await writeFile(path.join(dist, "assets", "app.js"), "console.log('app')")
  await writeFile(path.join(dist, "assets", "app.js.map"), "{}")
  await writeFile(path.join(dist, ".DS_Store"), "junk")
  await writeFile(path.join(dist, "font", "zain.woff2"), Buffer.from([1, 2, 3]))
  const commit = "a".repeat(40)
  const pack = (out) =>
    spawnSync(
      process.execPath,
      [path.join(root, "scripts", "package-dashboard.mjs"), "--dist", dist, "--out", out, "--version", "1.6.0", "--commit", commit],
      { encoding: "utf8" },
    )
  const first = pack(path.join(dir, "out-1"))
  assert.equal(first.status, 0, first.stderr)
  const second = pack(path.join(dir, "out-2"))
  assert.equal(second.status, 0, second.stderr)

  const bytes = await readFile(path.join(dir, "out-1", "gtfs-viz-dashboard.tar.gz"))
  assert.deepEqual(bytes, await readFile(path.join(dir, "out-2", "gtfs-viz-dashboard.tar.gz")), "byte-identical across runs")
  const digest = createHash("sha256").update(bytes).digest("hex")
  assert.equal(await readFile(path.join(dir, "out-1", "gtfs-viz-dashboard.tar.gz.sha256"), "utf8"), `${digest}  gtfs-viz-dashboard.tar.gz\n`)
  assert.deepEqual([...bytes.subarray(0, 3)], [0x1f, 0x8b, 0x08])
  assert.deepEqual([...bytes.subarray(4, 8)], [0, 0, 0, 0], "gzip mtime is 0")
  assert.equal(bytes[3] & 0x08, 0, "no file name in the gzip header")

  const entries = readUstar(gunzipSync(bytes))
  assert.deepEqual(
    entries.map((entry) => entry.name),
    [
      "dashboard/",
      "dashboard/assets/",
      "dashboard/assets/app.js",
      "dashboard/dashboard-manifest.json",
      "dashboard/font/",
      "dashboard/font/zain.woff2",
      "dashboard/index.html",
    ],
  )
  for (const entry of entries) {
    assert.equal(entry.magic, "ustar", entry.name)
    assert.equal(entry.mtime, 0, entry.name)
    assert.equal(entry.uid, 0, entry.name)
    assert.equal(entry.gid, 0, entry.name)
    assert.equal(entry.uname, "", entry.name)
    assert.equal(entry.gname, "", entry.name)
    if (entry.name.endsWith("/")) {
      assert.equal(entry.type, "5", entry.name)
      assert.equal(entry.mode, 0o755, entry.name)
    } else {
      assert.equal(entry.type, "0", entry.name)
      assert.equal(entry.mode, 0o644, entry.name)
    }
  }
  const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry.body]))
  assert.equal(byName["dashboard/index.html"].toString(), "<!doctype html><title>GTFS Viz</title>")
  assert.deepEqual([...byName["dashboard/font/zain.woff2"]], [1, 2, 3])
  assert.deepEqual(JSON.parse(byName["dashboard/dashboard-manifest.json"].toString()), {
    name: "gtfs-viz-dashboard",
    version: "1.6.0",
    commit,
    cliApi: 1,
  })
})

test("package-dashboard rejects a dist without index.html", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-dashboard-"))
  await mkdir(path.join(dir, "dist"))
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "package-dashboard.mjs"), "--dist", path.join(dir, "dist"), "--out", path.join(dir, "out"), "--version", "1.6.0", "--commit", "b".repeat(40)],
    { encoding: "utf8" },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /index\.html/)
})

test("releases publish the dashboard, not the CLI", () => {
  const release = read(".github/workflows/release.yml")
  assert.match(release, /gtfs-viz-dashboard\.tar\.gz/)
  assert.match(release, /package-dashboard\.mjs/)
  assert.match(release, /dashboard-latest/)
  assert.doesNotMatch(release, /npm publish/)
  const ci = read(".github/workflows/ci.yml")
  assert.doesNotMatch(ci, /--cli-e2e|packages\/cli/)
  assert.match(ci, /package-dashboard\.mjs/)
})

test("docs and the web app point CLI users to gtfs-tools", () => {
  const docs = read("packages/docs/src/content.ts")
  assert.match(docs, /@gabrielahn\/gtfs-tools/)
  assert.match(docs, /https:\/\/github\.com\/gabrielAHN\/gtfs-tools/)
  assert.match(docs, /~\/\.claude\/skills\/gtfs-tools/)
  assert.match(docs, /@gabrielahn\/gtfs-viz-cli/, "docs say the old package still works")
  assert.doesNotMatch(docs, /packages\/cli/)
  assert.match(read("packages/web/src/client/Intro/FileImporter/index.tsx"), /gtfs-tools/)
  const readme = read("README.md")
  assert.match(readme, /github\.com\/gabrielAHN\/gtfs-tools/)
  assert.doesNotMatch(readme, /packages\/cli/)
})
