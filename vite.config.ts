import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, createLogger } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"

// Custom logger to suppress DuckDB sourcemap warnings
const logger = createLogger();
const originalWarning = logger.warn;
logger.warn = (msg, options) => {
  // Suppress DuckDB sourcemap warnings
  if (typeof msg === 'string' && msg.includes('duckdb') && msg.includes('Sourcemap')) {
    return;
  }
  originalWarning(msg, options);
};

// Plugin to remove sourcemap references from DuckDB files
const removeDuckDBSourcemaps = () => ({
  name: 'remove-duckdb-sourcemaps',
  transform(code: string, id: string) {
    if (id.includes('@duckdb/duckdb-wasm')) {
      return {
        code: code.replace(/\/\/# sourceMappingURL=.*\.map/g, ''),
        map: null,
      };
    }
  },
});

export default defineConfig({
  customLogger: logger,
  plugins: [
    react(),
    TanStackRouterVite({
      routesDirectory: path.resolve(__dirname, './src/routes'),
      generatedRouteTree: path.resolve(__dirname, './src/routeTree.gen.ts'),
    }),
    removeDuckDBSourcemaps(),
  ],
  root: "./src",
  publicDir: "../public",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@gtfs-viz/ingestion": path.resolve(__dirname, "./extensions/dist/index.js"),
    },
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
    include: [
      'react',
      'react-dom',
      '@tanstack/react-router',
      '@tanstack/react-query',
      'deck.gl',
      '@deck.gl/core',
      '@deck.gl/layers',
    ],
    esbuildOptions: {
      // Suppress loader warnings for web workers
      logOverride: { 'unsupported-source-map': 'silent' },
    },
  },
  server: {
    // Suppress sourcemap warnings in development
    hmr: {
      overlay: true,
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual vendor chunks for better caching
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom'],
          // TanStack ecosystem
          'tanstack-vendor': [
            '@tanstack/react-router',
            '@tanstack/react-query',
            '@tanstack/react-table',
          ],
          // Deck.gl and mapping (large bundle)
          'deck-vendor': [
            'deck.gl',
            '@deck.gl/core',
            '@deck.gl/layers',
            '@deck.gl/react',
            '@deck.gl/extensions',
            '@deck.gl/geo-layers',
            '@deck.gl/mesh-layers',
          ],
          // Map libraries
          'map-vendor': [
            'maplibre-gl',
            'react-map-gl',
          ],
          // UI components
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
            '@radix-ui/react-slider',
            '@radix-ui/react-progress',
          ],
          // Forms and validation
          'form-vendor': [
            'react-hook-form',
            '@hookform/resolvers',
          ],
          // Utilities
          'util-vendor': [
            'jszip',
            'papaparse',
            'clsx',
            'tailwind-merge',
          ],
        },
      },
      onwarn(warning, warn) {
        // Suppress sourcemap warnings for DuckDB WASM
        if (
          (warning.code === 'SOURCEMAP_ERROR' || warning.code === 'SOURCEMAP_BROKEN') &&
          warning.message?.includes('duckdb')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
})
