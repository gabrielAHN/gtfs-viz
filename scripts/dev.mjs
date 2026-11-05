import { spawn } from "node:child_process"

// The web dev server proxies /docs to the docs dev server, so the app can link to it relatively.
const webEnv = { ...process.env, VITE_GTFS_DOCS_URL: process.env.VITE_GTFS_DOCS_URL || "/docs/" }

const children = [
  spawn("yarn", ["workspace", "@gtfs-viz/docs", "run", "dev"], { stdio: "inherit" }),
  spawn("yarn", ["workspace", "@gtfs-viz/web", "run", "dev"], { stdio: "inherit", env: webEnv }),
]

const stop = (code) => {
  for (const child of children) child.kill("SIGTERM")
  process.exit(code)
}

for (const child of children) child.on("exit", (code) => stop(code ?? 0))
process.on("SIGINT", () => stop(0))
process.on("SIGTERM", () => stop(0))
