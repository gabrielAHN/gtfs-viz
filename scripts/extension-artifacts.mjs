import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"

const defaultSource =
  "https://github.com/gabrielAHN/gtfs-duckdb/releases/download/main-latest/gtfs-extension-repository.tar.gz"

const { values } = parseArgs({
  options: {
    from: { type: "string", default: process.env.GTFS_EXTENSION_SOURCE || defaultSource },
    out: { type: "string" },
  },
})
if (!values.out) throw new Error("Pass --out <directory>")

const out = resolve(values.out)
const isDirectory = (path) =>
  stat(path).then(
    (s) => s.isDirectory(),
    () => false,
  )
const isFile = (path) =>
  stat(path).then(
    (s) => s.isFile(),
    () => false,
  )
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

async function unpack(archive) {
  const dir = await mkdtemp(join(tmpdir(), "gtfs-extension-"))
  const result = spawnSync("tar", ["-xzf", archive, "-C", dir], { stdio: "inherit" })
  if (result.status !== 0) throw new Error(`Could not unpack ${archive}`)
  return dir
}

async function repositoryFrom(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { redirect: "follow" })
    if (!response.ok) {
      throw new Error(`GTFS DuckDB download failed: ${response.status} ${source}`)
    }
    const dir = await mkdtemp(join(tmpdir(), "gtfs-extension-download-"))
    const archive = join(dir, "repository.tar.gz")
    await writeFile(archive, Buffer.from(await response.arrayBuffer()))
    return { dir: await unpack(archive), manifest: true }
  }
  const path = resolve(source)
  if (await isFile(path)) return { dir: await unpack(path), manifest: true }
  if (await isFile(join(path, "manifest.json"))) return { dir: path, manifest: true }
  if (await isDirectory(join(path, "build"))) {
    const dir = await mkdtemp(join(tmpdir(), "gtfs-extension-local-"))
    let found = 0
    for (const variant of ["eh", "mvp"]) {
      const wasm = join(path, "build", `wasm_${variant}`, "extension", "gtfs", "gtfs.duckdb_extension.wasm")
      if (!(await isFile(wasm))) continue
      await mkdir(join(dir, "v1.4.3", `wasm_${variant}`), { recursive: true })
      await cp(wasm, join(dir, "v1.4.3", `wasm_${variant}`, "gtfs.duckdb_extension.wasm"))
      found++
    }
    if (found) return { dir, manifest: false }
  }
  throw new Error(`No GTFS DuckDB build found at ${source}`)
}

const { dir, manifest } = await repositoryFrom(values.from)

if (manifest) {
  const { artifacts } = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"))
  for (const artifact of artifacts.filter((a) => a.target === "wasm")) {
    const actual = sha256(await readFile(join(dir, artifact.path)))
    if (actual !== artifact.sha256) throw new Error(`Checksum mismatch for ${artifact.path}`)
  }
}

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
const copied = []
for (const version of await readdir(dir)) {
  if (!/^v\d/.test(version)) continue
  for (const platform of await readdir(join(dir, version))) {
    if (!platform.startsWith("wasm_")) continue
    const file = join(dir, version, platform, "gtfs.duckdb_extension.wasm")
    if (!(await isFile(file))) continue
    await mkdir(join(out, version, platform), { recursive: true })
    await cp(file, join(out, version, platform, "gtfs.duckdb_extension.wasm"))
    copied.push(`${version}/${platform}`)
  }
}
if (!copied.length) throw new Error(`No browser (wasm) builds in ${values.from}`)
if (manifest) await cp(join(dir, "manifest.json"), join(out, "manifest.json"))
console.log(`GTFS DuckDB ${copied.join(", ")} from ${values.from} -> ${out}`)
