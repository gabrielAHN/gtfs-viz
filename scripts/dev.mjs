import { spawn } from "node:child_process"

const children = [
  spawn("yarn", ["workspace", "@gtfs-viz/docs", "run", "dev"], { stdio: "inherit" }),
  spawn("yarn", ["workspace", "@gtfs-viz/web", "run", "dev"], { stdio: "inherit" }),
]

const stop = (code) => {
  for (const child of children) child.kill("SIGTERM")
  process.exit(code)
}

for (const child of children) child.on("exit", (code) => stop(code ?? 0))
process.on("SIGINT", () => stop(0))
process.on("SIGTERM", () => stop(0))
