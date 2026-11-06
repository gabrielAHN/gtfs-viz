// Acceptance contract for moving the CLI to gabrielAHN/gtfs-tools (see the split CONTRACT.md).
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relative) => readFileSync(path.join(root, relative), "utf8")
const tracked = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean)

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

// gtfs-tools builds the dashboard from this repository as a git submodule (CONTRACT v2): `yarn build:dashboard`
// leaves the CLI-mode web app in packages/web/dist with a dashboard-manifest.json. No archive, no release asset.
test("dashboard-manifest writes the CLI-mode manifest into a built dist", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-dashboard-"))
  const dist = path.join(dir, "dist")
  await mkdir(dist)
  await writeFile(path.join(dist, "index.html"), "<!doctype html><title>GTFS Viz</title>")
  const commit = "a".repeat(40)
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "dashboard-manifest.mjs"), "--dist", dist], {
    encoding: "utf8",
    env: { ...process.env, GTFS_VIZ_COMMIT: commit },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(await readFile(path.join(dist, "dashboard-manifest.json"), "utf8")), {
    name: "gtfs-viz-dashboard",
    commit,
    cliApi: 1,
  })
  // Without GTFS_VIZ_COMMIT it records this checkout's HEAD.
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim()
  const fromGit = spawnSync(process.execPath, [path.join(root, "scripts", "dashboard-manifest.mjs"), "--dist", dist], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, GTFS_VIZ_COMMIT: "" },
  })
  assert.equal(fromGit.status, 0, fromGit.stderr)
  assert.equal(JSON.parse(await readFile(path.join(dist, "dashboard-manifest.json"), "utf8")).commit, head)
})

test("dashboard-manifest rejects a dist without index.html", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-dashboard-"))
  await mkdir(path.join(dir, "dist"))
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "dashboard-manifest.mjs"), "--dist", path.join(dir, "dist")], {
    encoding: "utf8",
    env: { ...process.env, GTFS_VIZ_COMMIT: "b".repeat(40) },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /index\.html/)
})

test("build:dashboard builds the CLI-mode web app and writes its manifest", () => {
  const script = JSON.parse(read("package.json")).scripts["build:dashboard"]
  assert.match(script, /build:web/)
  assert.match(script, /dashboard-manifest\.mjs --dist packages\/web\/dist/)
  assert.match(script, /-u VITE_GTFS_EXTENSION_REPOSITORY/)
  assert.doesNotMatch(script, /package-dashboard|dist-dashboard/)
})

// gtfs-viz is the web app, the docs and duckdb-client. It is deployed from main and has no versions: no release
// workflow, no tags created, no version fields or version headings. The CLI and its history live in gtfs-tools.
test("gtfs-viz has no versions and no release workflow", () => {
  for (const gone of [".github/workflows/release.yml", "scripts/version.sh", "scripts/package-dashboard.mjs", "scripts/verify-dashboard.mjs"]) {
    assert.equal(existsSync(path.join(root, gone)), false, gone)
  }
  const pkg = JSON.parse(read("package.json"))
  assert.equal(pkg.version, undefined, "root package.json has no version")
  for (const name of Object.keys(pkg.scripts)) assert.doesNotMatch(name, /^(version|release)(:|$)/, name)
  for (const app of ["packages/web/package.json", "packages/docs/package.json"]) {
    assert.equal(JSON.parse(read(app)).version, undefined, `${app} has no version`)
  }
  const changelog = read("CHANGELOG.md")
  assert.doesNotMatch(changelog, /^## \[?v?\d+\.\d+\.\d+/m, "CHANGELOG sections are dated, not versioned")
  const docs = read("packages/docs/src/content.ts")
  assert.doesNotMatch(docs, /repo: "gtfs-viz"/, "the docs release list has no gtfs-viz versions")
  const ci = read(".github/workflows/ci.yml")
  assert.doesNotMatch(ci, /--cli-e2e|packages\/cli|package-dashboard|gtfs-viz-dashboard/)
  assert.match(ci, /build:dashboard/)
  assert.match(ci, /dashboard-manifest\.json/)
})

test("the retired npm package and the CLI's history are gone from gtfs-viz", () => {
  const mentions = spawnSync(
    "git",
    ["grep", "-n", "-i", "gabrielahn/gtfs-viz-cli", "--", ":!tests/split.acceptance.test.mjs"],
    { cwd: root, encoding: "utf8" },
  ).stdout
  assert.equal(mentions, "", "no mention of @gabrielahn/gtfs-viz-cli")
  const changelog = read("CHANGELOG.md")
  assert.doesNotMatch(changelog, /packages\/cli|npm (publish|install)|`gtfs-viz (import|update|install-skill)/, "CLI history lives in gtfs-tools")
  assert.match(changelog, /github\.com\/gabrielAHN\/gtfs-tools/)
})

test("docs and the web app point CLI users to gtfs-tools", () => {
  const docs = read("packages/docs/src/content.ts")
  assert.match(docs, /@gabrielahn\/gtfs-tools/)
  assert.match(docs, /https:\/\/github\.com\/gabrielAHN\/gtfs-tools/)
  assert.match(docs, /~\/\.claude\/skills\/gtfs-tools/)
  assert.match(docs, /repo: "gtfs-tools",\s*version: "1\.3\.0"/, "the CLI's releases are listed under gtfs-tools")
  assert.doesNotMatch(docs, /packages\/cli/)
  assert.doesNotMatch(docs, /gtfs-viz-dashboard\.tar\.gz|dashboard-latest|release asset/i)
  assert.match(docs, /submodule/i, "docs say gtfs-tools builds the dashboard from gtfs-viz as a submodule")
  assert.match(read("packages/web/src/client/Intro/FileImporter/index.tsx"), /gtfs-tools/)
  const readme = read("README.md")
  assert.match(readme, /github\.com\/gabrielAHN\/gtfs-tools/)
  assert.doesNotMatch(readme, /packages\/cli|gtfs-viz-dashboard\.tar\.gz|dashboard-latest/)
})
