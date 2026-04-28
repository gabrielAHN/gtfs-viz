#!/usr/bin/env node
/**
 * Preuninstall: stops the dashboard daemon and removes local data.
 * Cleans up ~/.gtfs-viz-cli/ (DuckDB database, feed zip, session state)
 * and kills any running dashboard process.
 */
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const dataRoot = path.join(os.homedir(), ".gtfs-viz-cli");
const daemonFile = path.join(dataRoot, "daemon.json");
const sessionRoot = path.join(os.tmpdir(), "gtfs-viz-cli");

// Stop daemon if running
try {
  const raw = await readFile(daemonFile, "utf8");
  const meta = JSON.parse(raw);
  if (meta.pid) {
    try {
      process.kill(meta.pid, "SIGTERM");
    } catch {}
  }
} catch {}

// Remove local data
try {
  await rm(dataRoot, { recursive: true, force: true });
} catch {}

// Remove temp session files
try {
  await rm(sessionRoot, { recursive: true, force: true });
} catch {}

console.log("gtfs-viz-cli: cleaned up local data and stopped daemon.");
