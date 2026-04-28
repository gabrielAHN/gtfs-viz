import path from "node:path"
import { fileURLToPath } from "node:url"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { createLogger, defineConfig } from "vite-plus"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const logger = createLogger()
const originalWarning = logger.warn
const manualChunkGroups = {
  "react-vendor": ["react", "react-dom"],
  "tanstack-vendor": [
    "@tanstack/react-router",
    "@tanstack/react-query",
    "@tanstack/react-table",
  ],
  "deck-vendor": [
    "deck.gl",
    "@deck.gl/core",
    "@deck.gl/layers",
    "@deck.gl/react",
    "@deck.gl/extensions",
    "@deck.gl/geo-layers",
    "@deck.gl/mesh-layers",
  ],
  "map-vendor": ["maplibre-gl", "react-map-gl"],
  "ui-vendor": [
    "@radix-ui/react-dialog",
    "@radix-ui/react-select",
    "@radix-ui/react-popover",
    "@radix-ui/react-tabs",
    "@radix-ui/react-slider",
    "@radix-ui/react-progress",
  ],
  "form-vendor": ["react-hook-form", "@hookform/resolvers"],
  "util-vendor": ["jszip", "papaparse", "clsx", "tailwind-merge"],
} as const

logger.warn = (msg, options) => {
  if (
    typeof msg === "string" &&
    msg.includes("duckdb") &&
    msg.includes("Sourcemap")
  ) {
    return
  }
  originalWarning(msg, options)
}

const removeDuckDBSourcemaps = () => ({
  name: "remove-duckdb-sourcemaps",
  transform(code: string, id: string) {
    if (id.includes("@duckdb/duckdb-wasm") && code.includes("sourceMappingURL")) {
      return {
        code: code.replace(/\/\/# sourceMappingURL=.*\.map/g, ""),
        map: null,
      }
    }
  },
})

const resolveManualChunk = (id: string) => {
  const normalizedId = id.replaceAll("\\", "/")

  if (!normalizedId.includes("/node_modules/")) {
    return undefined
  }

  for (const [chunkName, packages] of Object.entries(manualChunkGroups)) {
    if (packages.some((pkg) => normalizedId.includes(`/node_modules/${pkg}/`))) {
      return chunkName
    }
  }

  return undefined
}

export default defineConfig({
  customLogger: logger,
  lint: {
    ignorePatterns: ["dist/**", "src/routeTree.gen.ts", "src/src/routeTree.gen.ts"],
  },
  plugins: [
    TanStackRouterVite({
      target: "react",
      routesDirectory: path.resolve(rootDir, "./src/routes"),
      generatedRouteTree: path.resolve(rootDir, "./src/routeTree.gen.ts"),
    }),
    react(),
    removeDuckDBSourcemaps(),
  ],
  root: "./src",
  publicDir: "../public",
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
    include: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-query",
      "deck.gl",
      "@deck.gl/core",
      "@deck.gl/layers",
    ],
  },
  server: {
    hmr: {
      overlay: true,
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
      onwarn(warning, warn) {
        if (
          (warning.code === "SOURCEMAP_ERROR" ||
            warning.code === "SOURCEMAP_BROKEN") &&
          warning.message?.includes("duckdb")
        ) {
          return
        }
        if (warning.code === "EVAL" && warning.id?.includes("@loaders.gl")) {
          return
        }
        if (warning.code === "PLUGIN_TIMINGS") {
          return
        }
        warn(warning)
      },
    },
  },
})
