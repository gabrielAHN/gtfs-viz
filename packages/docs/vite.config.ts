import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite-plus"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const webSrc = path.resolve(rootDir, "../web/src")

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
  plugins: [react()],
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
