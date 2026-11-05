#!/usr/bin/env node
// Packs the CLI-mode web app build (packages/web/dist) into the dashboard release asset that
// gabrielAHN/gtfs-tools bundles: a reproducible gzip-compressed POSIX ustar archive with every entry
// under dashboard/, plus a one-line .sha256 file. Node built-ins only.
//
//   node scripts/package-dashboard.mjs --dist packages/web/dist --out dist-dashboard \
//     --version 1.6.0 --commit "$(git rev-parse HEAD)"
//
// Same input, same bytes: entries are sorted by path, mtime/uid/gid are 0, uname/gname are empty,
// modes are 0644 (files) and 0755 (directories), and the gzip header has mtime 0, no file name and
// a fixed OS byte. Source maps and .DS_Store files are left out.
import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { gzipSync } from "node:zlib"

const ARCHIVE_NAME = "gtfs-viz-dashboard.tar.gz"
const MANIFEST_NAME = "dashboard-manifest.json"
const ROOT = "dashboard"
const BLOCK = 512
const RECORD = BLOCK * 20

const fail = (message) => {
  throw new Error(message)
}

const excluded = (name) => name === ".DS_Store" || name.endsWith(".map")

const compareBytes = (a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))

// Collect "dashboard/…" entries: directories end with "/" and have no body.
async function collect(dist) {
  const entries = [{ path: `${ROOT}/`, body: null }]
  const walk = async (directory, relative) => {
    for (const dirent of await readdir(directory, { withFileTypes: true })) {
      const name = dirent.name
      const full = path.join(directory, name)
      const archivePath = `${ROOT}/${relative}${name}`
      const info = await lstat(full)
      if (info.isSymbolicLink()) fail(`refusing to pack a symlink: ${full}`)
      if (info.isDirectory()) {
        entries.push({ path: `${archivePath}/`, body: null })
        await walk(full, `${relative}${name}/`)
      } else if (info.isFile()) {
        if (excluded(name)) continue
        entries.push({ path: archivePath, body: await readFile(full) })
      } else {
        fail(`refusing to pack something that is not a regular file or directory: ${full}`)
      }
    }
  }
  await walk(dist, "")
  return entries
}

// Split a path into the ustar name (100 bytes) and prefix (155 bytes) fields.
function splitPath(entryPath) {
  const bytes = Buffer.from(entryPath, "utf8")
  if (bytes.length <= 100) return { name: bytes, prefix: Buffer.alloc(0) }
  // The longest prefix that fits and ends just before a "/", leaving a non-empty name.
  for (let slash = Math.min(155, bytes.length - 2); slash > 0; slash--) {
    if (bytes[slash] !== 0x2f) continue
    const name = bytes.subarray(slash + 1)
    if (name.length === 0 || name.length > 100) break
    return { name, prefix: bytes.subarray(0, slash) }
  }
  fail(
    `path cannot be stored in a ustar header (name max 100 bytes, prefix max 155 bytes, split at a "/"): ${entryPath}`,
  )
}

function octal(header, offset, length, value) {
  const digits = value.toString(8)
  if (digits.length > length - 1) fail(`value ${value} does not fit a ${length}-byte ustar field`)
  header.write(`${digits.padStart(length - 1, "0")}\0`, offset, length, "ascii")
}

function header(entry) {
  const block = Buffer.alloc(BLOCK)
  const { name, prefix } = splitPath(entry.path)
  name.copy(block, 0)
  const directory = entry.body === null
  octal(block, 100, 8, directory ? 0o755 : 0o644)
  octal(block, 108, 8, 0)
  octal(block, 116, 8, 0)
  octal(block, 124, 12, directory ? 0 : entry.body.length)
  octal(block, 136, 12, 0)
  block.fill(0x20, 148, 156)
  block.write(directory ? "5" : "0", 156, 1, "ascii")
  block.write("ustar\0", 257, 6, "ascii")
  block.write("00", 263, 2, "ascii")
  octal(block, 329, 8, 0)
  octal(block, 337, 8, 0)
  prefix.copy(block, 345)
  let sum = 0
  for (const byte of block) sum += byte
  block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii")
  return block
}

function ustar(entries) {
  const chunks = []
  for (const entry of entries) {
    chunks.push(header(entry))
    if (entry.body !== null && entry.body.length > 0) {
      chunks.push(entry.body, Buffer.alloc((BLOCK - (entry.body.length % BLOCK)) % BLOCK))
    }
  }
  chunks.push(Buffer.alloc(BLOCK * 2))
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0)
  chunks.push(Buffer.alloc((RECORD - (size % RECORD)) % RECORD))
  return Buffer.concat(chunks)
}

function gzip(tar) {
  const bytes = gzipSync(tar, { level: 9 })
  // RFC 1952 header: no FNAME/FHCRC flags, MTIME 0; pin the OS byte to 255 ("unknown") so the
  // header does not depend on the platform zlib was built for.
  if (bytes[3] !== 0 || bytes.readUInt32LE(4) !== 0) fail("unexpected gzip header from zlib")
  bytes[9] = 0xff
  return bytes
}

async function packageDashboard({ dist, out, version, commit }) {
  if (!dist || !out || !version || !commit) {
    fail(
      "usage: package-dashboard.mjs --dist <dir> --out <dir> --version <x.y.z> --commit <40 hex>",
    )
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`--version must look like x.y.z, got ${JSON.stringify(version)}`)
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    fail(`--commit must be a 40-character lowercase hex git commit, got ${JSON.stringify(commit)}`)
  }
  const distDir = path.resolve(dist)
  const index = await lstat(path.join(distDir, "index.html")).catch(() => null)
  if (!index?.isFile()) {
    fail(`${path.join(distDir, "index.html")} is missing: build the web app before packaging`)
  }
  const entries = await collect(distDir)
  if (entries.some((entry) => entry.path === `${ROOT}/${MANIFEST_NAME}`)) {
    fail(`${path.join(distDir, MANIFEST_NAME)} already exists; the packager writes it`)
  }
  const manifest = { name: "gtfs-viz-dashboard", version, commit, cliApi: 1 }
  entries.push({
    path: `${ROOT}/${MANIFEST_NAME}`,
    body: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  })
  entries.sort((a, b) => compareBytes(a.path, b.path))

  const archive = gzip(ustar(entries))
  const digest = createHash("sha256").update(archive).digest("hex")
  const outDir = path.resolve(out)
  await mkdir(outDir, { recursive: true })
  const archivePath = path.join(outDir, ARCHIVE_NAME)
  const checksumPath = `${archivePath}.sha256`
  await writeFile(`${archivePath}.tmp`, archive)
  await rename(`${archivePath}.tmp`, archivePath)
  await writeFile(`${checksumPath}.tmp`, `${digest}  ${ARCHIVE_NAME}\n`)
  await rename(`${checksumPath}.tmp`, checksumPath)
  return { archivePath, checksumPath, digest, entries: entries.length, bytes: archive.length }
}

try {
  const { values } = parseArgs({
    options: {
      dist: { type: "string" },
      out: { type: "string" },
      version: { type: "string" },
      commit: { type: "string" },
    },
    strict: true,
  })
  const result = await packageDashboard(values)
  console.log(
    `${result.digest}  ${result.archivePath} (${result.entries} entries, ${result.bytes} bytes)`,
  )
} catch (error) {
  console.error(`package-dashboard: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
