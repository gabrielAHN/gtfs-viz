#!/usr/bin/env node
/**
 * Generates gtfs.sql from the duckdb-extension package and copies it
 * to the web public dir. Available at /extensions/gtfs.sql when deployed.
 */
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const destDir = path.join(root, "public", "extensions")
const dest = path.join(destDir, "gtfs.sql")

const { GTFS_LOAD_SQL, GTFS_INIT_SQL } = await import("@gtfs-viz/duckdb-extension")

const header = [
  "-- ============================================================================",
  "-- GTFS Extension for DuckDB",
  "-- ============================================================================",
  "-- Generated from @gtfs-viz/duckdb-extension",
  "-- Install with: INSTALL gtfs FROM '<repo>'; LOAD gtfs;",
  "-- ============================================================================",
  "",
].join("\n")

await mkdir(destDir, { recursive: true })
await writeFile(
  dest,
  header +
    GTFS_LOAD_SQL +
    "\n" +
    GTFS_INIT_SQL +
    "\nSELECT 'GTFS extension installed' AS status;\n",
)
console.log("Generated gtfs.sql to public/extensions/gtfs.sql")
