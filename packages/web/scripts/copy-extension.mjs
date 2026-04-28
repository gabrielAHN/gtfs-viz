#!/usr/bin/env node
/**
 * Copies the built gtfs.sql from the procedures package to the web public dir.
 * This makes the extension available at /extensions/gtfs.sql when deployed.
 */
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.resolve(root, "..", "procedures", "dist", "gtfs.sql");
const destDir = path.join(root, "public", "extensions");
const dest = path.join(destDir, "gtfs.sql");

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
console.log(`Copied gtfs.sql to public/extensions/gtfs.sql`);
