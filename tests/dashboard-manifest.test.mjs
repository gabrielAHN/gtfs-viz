// Edge cases of scripts/dashboard-manifest.mjs; the main contract is in split.acceptance.test.mjs.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const script = path.join(root, "scripts", "dashboard-manifest.mjs")

async function builtDist() {
  const dist = path.join(await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-manifest-")), "dist")
  await mkdir(dist)
  await writeFile(path.join(dist, "index.html"), "<!doctype html><title>GTFS Viz</title>")
  return dist
}

const run = (args, env = {}) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  })

test("a GTFS_VIZ_COMMIT that is not a 40-hex commit is refused, and no manifest is written", async () => {
  const dist = await builtDist()
  for (const commit of ["main", "A".repeat(40), "a".repeat(39), `${"a".repeat(40)}0`]) {
    const result = run(["--dist", dist], { GTFS_VIZ_COMMIT: commit })
    assert.notEqual(result.status, 0, commit)
    assert.match(result.stderr, /GTFS_VIZ_COMMIT must be a 40-character lowercase hex commit/)
  }
  assert.equal(existsSync(path.join(dist, "dashboard-manifest.json")), false)
})

test("--dist is required", () => {
  const result = run([], { GTFS_VIZ_COMMIT: "c".repeat(40) })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--dist <dir>/)
})

test("a copy without its own .git inside another repository does not record that repository's commit", async () => {
  const outer = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-outer-"))
  const git = (args) => spawnSync("git", args, { cwd: outer, encoding: "utf8" })
  git(["init", "-q"])
  git([
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@localhost",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "outer",
  ])
  const copy = path.join(outer, "vendor", "gtfs-viz")
  await mkdir(path.join(copy, "scripts"), { recursive: true })
  await copyFile(script, path.join(copy, "scripts", "dashboard-manifest.mjs"))
  await writeFile(
    path.join(copy, "package.json"),
    JSON.stringify({ name: "gtfs-viz", version: "1.6.0" }),
  )
  const dist = await builtDist()
  const copied = (env) =>
    spawnSync(
      process.execPath,
      [path.join(copy, "scripts", "dashboard-manifest.mjs"), "--dist", dist],
      {
        encoding: "utf8",
        cwd: copy,
        env: { ...process.env, ...env },
      },
    )
  const refused = copied({ GTFS_VIZ_COMMIT: "" })
  assert.notEqual(refused.status, 0)
  assert.match(refused.stderr, /not the root of its own git checkout/)
  assert.equal(existsSync(path.join(dist, "dashboard-manifest.json")), false)
  assert.equal(copied({ GTFS_VIZ_COMMIT: "c".repeat(40) }).status, 0, "GTFS_VIZ_COMMIT still works")
})
