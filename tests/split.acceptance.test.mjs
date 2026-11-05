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
  const version = JSON.parse(read("package.json")).version
  assert.deepEqual(JSON.parse(await readFile(path.join(dist, "dashboard-manifest.json"), "utf8")), {
    name: "gtfs-viz-dashboard",
    version,
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

test("releases only tag and create the GitHub release: no dashboard asset, no npm", () => {
  for (const gone of ["scripts/package-dashboard.mjs", "scripts/verify-dashboard.mjs", "tests/package-dashboard.test.mjs"]) {
    assert.equal(existsSync(path.join(root, gone)), false, gone)
  }
  const release = read(".github/workflows/release.yml")
  assert.doesNotMatch(release, /gtfs-viz-dashboard|dashboard-latest|package-dashboard|npm publish|upload-artifact/)
  assert.match(release, /refs\/tags\/|createRef|git tag/)
  assert.match(release, /createRelease|gh release create/)
  const ci = read(".github/workflows/ci.yml")
  assert.doesNotMatch(ci, /--cli-e2e|packages\/cli|package-dashboard|gtfs-viz-dashboard/)
  assert.match(ci, /build:dashboard/)
  assert.match(ci, /dashboard-manifest\.json/)
})

test("docs and the web app point CLI users to gtfs-tools", () => {
  const docs = read("packages/docs/src/content.ts")
  assert.match(docs, /@gabrielahn\/gtfs-tools/)
  assert.match(docs, /https:\/\/github\.com\/gabrielAHN\/gtfs-tools/)
  assert.match(docs, /~\/\.claude\/skills\/gtfs-tools/)
  assert.match(docs, /@gabrielahn\/gtfs-viz-cli/, "docs say the old package still works")
  assert.doesNotMatch(docs, /packages\/cli/)
  assert.doesNotMatch(docs, /gtfs-viz-dashboard\.tar\.gz|dashboard-latest|release asset/i, "no dashboard release asset anymore")
  assert.match(docs, /submodule/i, "docs say gtfs-tools builds the dashboard from gtfs-viz as a submodule")
  for (const doc of ["README.md", "CHANGELOG.md"]) {
    const top = read(doc).split(/\n## \[1\.5/)[0]
    assert.doesNotMatch(top, /gtfs-viz-dashboard\.tar\.gz|dashboard-latest/, doc)
  }
  assert.match(read("packages/web/src/client/Intro/FileImporter/index.tsx"), /gtfs-tools/)
  const readme = read("README.md")
  assert.match(readme, /github\.com\/gabrielAHN\/gtfs-tools/)
  assert.doesNotMatch(readme, /packages\/cli/)
})
