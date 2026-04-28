#!/usr/bin/env node
/**
 * Postinstall: prompts user to install GTFS Viz skills to ~/.claude or ~/.skills.
 * In non-interactive mode (piped stdin), prints a message to run install-skill manually.
 */
import { cp, mkdir, readFile, rm, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourceDir = path.join(packageRoot, "skills", "gtfs-viz");

// Always wipe data and stop daemon on fresh install
const dataRoot = path.join(os.homedir(), ".gtfs-viz-cli");
const sessionRoot = path.join(os.tmpdir(), "gtfs-viz-cli");

// Kill any running daemon
const daemonFile = path.join(dataRoot, "daemon.json");
try {
  const raw = await readFile(daemonFile, "utf8");
  const meta = JSON.parse(raw);
  if (meta.pid) {
    try { process.kill(meta.pid, "SIGTERM"); } catch {}
  }
  await rm(daemonFile, { force: true });
} catch {}

// Wipe all local data (DuckDB, feed zip, session state)
await rm(dataRoot, { recursive: true, force: true }).catch(() => {});
await rm(sessionRoot, { recursive: true, force: true }).catch(() => {});

// Check if skills directory exists (won't during dev install)
try {
  await access(sourceDir);
} catch {
  // No skills dir — dev mode, skip silently
  process.exit(0);
}

const targets = {
  1: {
    label: "Claude Code (~/.claude/skills)",
    dir: path.join(
      process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude"),
      "skills"
    ),
  },
  2: {
    label: "Open source (~/.skills)",
    dir: path.join(os.homedir(), ".skills"),
  },
};

async function installTo(skillsDir) {
  const targetDir = path.join(skillsDir, "gtfs-viz");
  await rm(targetDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(skillsDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`Installed GTFS Viz skill to ${targetDir}`);
}

// Non-interactive — skip with message
if (!process.stdin.isTTY) {
  console.log(
    "Run `gtfs-viz install-skill` to install agent skills interactively."
  );
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\nInstall GTFS Viz skills:");
console.log("  1. Claude Code (~/.claude/skills)");
console.log("  2. Open source (~/.skills)");
console.log("  3. Skip");

const answer = await new Promise((resolve) => {
  rl.question("Choose 1, 2, or 3: ", resolve);
});
rl.close();

const choice = answer.trim();
if (choice === "1" || choice === "2") {
  try {
    await installTo(targets[choice].dir);
  } catch (error) {
    console.error("Skill installation failed:", error.message);
    console.log("Run `gtfs-viz install-skill` to retry.");
  }
} else {
  console.log("Skipped. Run `gtfs-viz install-skill` anytime to install.");
}
