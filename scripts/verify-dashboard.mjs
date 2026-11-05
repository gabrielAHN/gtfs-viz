#!/usr/bin/env node
// Checks a packaged dashboard release asset before it is published: the .sha256 file is exactly one
// "<64 lowercase hex>  gtfs-viz-dashboard.tar.gz" line matching the archive, the archive is a gzip
// ustar with every entry under dashboard/, dashboard/index.html exists, and the manifest has exactly
// {name, version, commit, cliApi: 1} with the expected version and commit. Node built-ins only.
//
//   node scripts/verify-dashboard.mjs --dir dist-dashboard --version 1.6.0 --commit "$(git rev-parse HEAD)"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { gunzipSync } from "node:zlib"

const ARCHIVE_NAME = "gtfs-viz-dashboard.tar.gz"

const readUstar = (tar) => {
  const entries = []
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const text = (start, length) =>
      header.toString("utf8", start, start + length).replace(/\0.*$/s, "")
    if (header.toString("latin1", 257, 263) !== "ustar\0") {
      throw new Error(`entry at byte ${offset} is not a POSIX ustar header`)
    }
    const prefix = text(345, 155)
    const size = parseInt(text(124, 12).trim() || "0", 8)
    entries.push({
      name: (prefix ? `${prefix}/` : "") + text(0, 100),
      type: text(156, 1) || "0",
      body: tar.subarray(offset + 512, offset + 512 + size),
    })
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return entries
}

try {
  const { values } = parseArgs({
    options: {
      dir: { type: "string" },
      version: { type: "string" },
      commit: { type: "string" },
    },
    strict: true,
  })
  if (!values.dir || !values.version || !values.commit) {
    throw new Error("usage: verify-dashboard.mjs --dir <dir> --version <x.y.z> --commit <40 hex>")
  }
  const archivePath = path.join(values.dir, ARCHIVE_NAME)
  const archive = await readFile(archivePath)
  const checksum = await readFile(`${archivePath}.sha256`, "utf8")
  const digest = createHash("sha256").update(archive).digest("hex")
  if (checksum !== `${digest}  ${ARCHIVE_NAME}\n`) {
    throw new Error(
      `${archivePath}.sha256 must be exactly "${digest}  ${ARCHIVE_NAME}\\n", got ${JSON.stringify(checksum)}`,
    )
  }
  if (
    archive[0] !== 0x1f ||
    archive[1] !== 0x8b ||
    archive.readUInt32LE(4) !== 0 ||
    archive[3] !== 0
  ) {
    throw new Error("the gzip header must have mtime 0 and no file name")
  }
  const entries = readUstar(gunzipSync(archive))
  const outside = entries.filter(
    (entry) => !entry.name.startsWith("dashboard/") || !["0", "5"].includes(entry.type),
  )
  if (outside.length) {
    throw new Error(`unexpected entries: ${outside.map((entry) => entry.name).join(", ")}`)
  }
  const names = entries.map((entry) => entry.name)
  const sorted = [...names].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
  if (names.join("\n") !== sorted.join("\n")) throw new Error("entries are not sorted by path")
  if (names.some((name) => name.endsWith(".map") || name.endsWith("/.DS_Store"))) {
    throw new Error("the archive contains source maps or .DS_Store files")
  }
  if (!names.includes("dashboard/index.html")) throw new Error("dashboard/index.html is missing")
  const manifestEntry = entries.find((entry) => entry.name === "dashboard/dashboard-manifest.json")
  if (!manifestEntry) throw new Error("dashboard/dashboard-manifest.json is missing")
  const manifest = JSON.parse(manifestEntry.body.toString("utf8"))
  const expected = {
    name: "gtfs-viz-dashboard",
    version: values.version,
    commit: values.commit,
    cliApi: 1,
  }
  if (JSON.stringify(manifest) !== JSON.stringify(expected)) {
    throw new Error(
      `manifest ${JSON.stringify(manifest)} does not match ${JSON.stringify(expected)}`,
    )
  }
  console.log(
    `${digest}  ${ARCHIVE_NAME}: ${entries.length} entries, manifest ${JSON.stringify(manifest)}`,
  )
} catch (error) {
  console.error(`verify-dashboard: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
