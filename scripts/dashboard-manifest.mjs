#!/usr/bin/env node
// Writes dashboard-manifest.json into a built CLI-mode web app (packages/web/dist), so that
// gabrielAHN/gtfs-tools, which builds the dashboard from this repository as a git submodule, can
// check what it bundles. Node built-ins only.
//
//   node scripts/dashboard-manifest.mjs --dist packages/web/dist
//
// The manifest is {"name": "gtfs-viz-dashboard", "version": <root package.json version>,
// "commit": <40-hex>, "cliApi": 1}. The commit is GTFS_VIZ_COMMIT when set and non-empty, else
// `git rev-parse HEAD` in this repository (also inside a submodule checkout).
import { execFileSync } from "node:child_process"
import { readFileSync, realpathSync } from "node:fs"
import { stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

const MANIFEST_NAME = "dashboard-manifest.json"
const CLI_API = 1
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const git = (args) =>
  execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()

function commitFromGit() {
  let top
  let head
  try {
    top = git(["rev-parse", "--show-toplevel"])
    head = git(["rev-parse", "HEAD"])
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message
    throw new Error(`cannot read the commit with git rev-parse HEAD in ${repoRoot}: ${detail}`)
  }
  // A copy of this repository without its own .git inside another repository would otherwise record
  // that repository's commit.
  if (realpathSync(top) !== realpathSync(repoRoot)) {
    throw new Error(
      `${repoRoot} is not the root of its own git checkout (git found ${top}); set GTFS_VIZ_COMMIT`,
    )
  }
  return head
}

function resolveCommit() {
  const fromEnv = process.env.GTFS_VIZ_COMMIT
  const [commit, source] = fromEnv
    ? [fromEnv.trim(), "GTFS_VIZ_COMMIT"]
    : [commitFromGit(), "git rev-parse HEAD"]
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(
      `${source} must be a 40-character lowercase hex commit, got ${JSON.stringify(commit)}`,
    )
  }
  return commit
}

async function main() {
  const { values } = parseArgs({ options: { dist: { type: "string" } }, strict: true })
  if (!values.dist) throw new Error("usage: node scripts/dashboard-manifest.mjs --dist <dir>")
  const dist = path.resolve(values.dist)

  const index = path.join(dist, "index.html")
  const info = await stat(index).catch(() => null)
  if (!info?.isFile()) {
    throw new Error(`${index} not found: build the web app first (yarn build:dashboard)`)
  }

  const { version } = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"))
  if (typeof version !== "string" || version === "") {
    throw new Error(`${path.join(repoRoot, "package.json")} has no version`)
  }

  const manifest = { name: "gtfs-viz-dashboard", version, commit: resolveCommit(), cliApi: CLI_API }
  const target = path.join(dist, MANIFEST_NAME)
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote ${target}: ${JSON.stringify(manifest)}`)
}

main().catch((error) => {
  console.error(`dashboard-manifest: ${error.message}`)
  process.exitCode = 1
})
