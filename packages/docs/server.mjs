import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist")
const port = Number(process.env.PORT || 4173)
const prefix = "/docs"

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}

async function resolveFile(pathname) {
  const relative = decodeURIComponent(pathname.slice(prefix.length)).replace(/^\/+/, "")
  const file = path.resolve(root, relative)
  if (file !== root && !file.startsWith(root + path.sep)) return null
  try {
    const info = await stat(file)
    if (info.isFile()) return file
  } catch {
    return types[path.extname(file)] ? null : path.join(root, "index.html")
  }
  return path.join(root, "index.html")
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url || "/", "http://localhost")
  if (pathname === "/healthz") {
    response.writeHead(200, { "content-type": "text/plain" }).end("ok")
    return
  }
  if (pathname !== prefix && !pathname.startsWith(prefix + "/")) {
    response.writeHead(302, { location: prefix + "/" }).end()
    return
  }
  if (pathname === prefix) {
    response.writeHead(301, { location: prefix + "/" }).end()
    return
  }
  const file = await resolveFile(pathname)
  if (!file) {
    response.writeHead(404).end()
    return
  }
  const immutable = file.includes(path.sep + "assets" + path.sep)
  response.writeHead(200, {
    "content-type": types[path.extname(file)] || "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  })
  createReadStream(file).pipe(response)
}).listen(port, () => {
  console.log(`GTFS Viz docs on http://localhost:${port}${prefix}/`)
})
