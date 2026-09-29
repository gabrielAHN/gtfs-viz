import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const checkout =
  ["../gtfs-duckdb", "../gtfs-duckdb-extension"].find((dir) => existsSync(resolve(root, dir))) ??
  "../gtfs-duckdb"
const { values } = parseArgs({
  options: {
    extension: { type: "string", default: process.env.GTFS_EXTENSION_SOURCE || checkout },
    port: { type: "string", default: process.env.PORT || "4000" },
    "skip-build": { type: "boolean", default: false },
  },
})

if (spawnSync("caddy", ["version"], { stdio: "ignore" }).status !== 0) {
  console.error("caddy is required to serve the Railway build (brew install caddy).")
  process.exit(1)
}

const source = /^https?:\/\//.test(values.extension) ? values.extension : resolve(root, values.extension)
const env = { ...process.env, GTFS_EXTENSION_SOURCE: source }

if (!values["skip-build"]) {
  const build = spawnSync("yarn", ["build:deploy"], { cwd: root, env, stdio: "inherit" })
  if (build.status !== 0) process.exit(build.status ?? 1)
} else {
  const refresh = spawnSync("node", ["scripts/extension-artifacts.mjs", "--out", "dist/extensions"], {
    cwd: root,
    env,
    stdio: "inherit",
  })
  if (refresh.status !== 0) process.exit(refresh.status ?? 1)
}

const cache = resolve(root, "node_modules/.cache/gtfs-viz")
await mkdir(cache, { recursive: true })
const caddyfile = resolve(cache, "Caddyfile")
await writeFile(caddyfile, (await readFile(resolve(root, "Caddyfile"), "utf8")).replaceAll("/app/dist", resolve(root, "dist")))

const caddy = spawn("caddy", ["run", "--config", caddyfile, "--adapter", "caddyfile"], {
  cwd: cache,
  env: { ...process.env, PORT: values.port },
  stdio: ["ignore", "ignore", "ignore"],
})
const stop = () => caddy.kill()
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
caddy.on("exit", (code) => process.exit(code ?? 0))

console.log(
  [
    "",
    "Railway build running locally",
    `  app         http://localhost:${values.port}/`,
    `  docs        http://localhost:${values.port}/docs/`,
    `  extension   http://localhost:${values.port}/extensions/ <- ${source}`,
  ].join("\n"),
)
