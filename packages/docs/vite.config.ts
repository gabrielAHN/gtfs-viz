import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite-plus"
import type { Plugin } from "vite"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const webSrc = path.resolve(rootDir, "../web/src")

function agentDocs(): Plugin {
  return {
    name: "gtfs-viz-agent-docs",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const name = request.url?.split("?")[0].replace(/^\/docs\//, "")
        if (!name || !/\.(md|txt)$/.test(name)) return next()
        const { markdownFiles } = await server.ssrLoadModule("/markdown.ts")
        const text = markdownFiles()[name]
        if (!text) {
          response.statusCode = 404
          response.end()
          return
        }
        response.setHeader(
          "content-type",
          name.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
        )
        response.end(text)
      })
    },
    async generateBundle() {
      const { markdownFiles } = await import("./src/markdown")
      for (const [fileName, source] of Object.entries(markdownFiles())) {
        this.emitFile({ type: "asset", fileName, source })
      }
    },
  }
}

export default defineConfig({
  fmt: {
    semi: false,
    printWidth: 100,
    trailingComma: "all",
    ignorePatterns: ["dist/**"],
  },
  lint: {
    ignorePatterns: ["dist/**"],
  },
  base: "/docs/",
  root: "./src",
  publicDir: "../../web/public",
  plugins: [react(), agentDocs()],
  resolve: {
    alias: {
      "@": webSrc,
    },
  },
  css: {
    postcss: path.resolve(rootDir, "postcss.config.js"),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
})
