#!/usr/bin/env node
import { cp, mkdir, readFile, rm, access, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourceDir = path.join(packageRoot, "skills", "gtfs-viz");

if (process.env.GTFS_VIZ_PRESERVE_DATA !== "1") {
  const dataRoot = path.join(os.homedir(), ".gtfs-viz-cli");
  const sessionRoot = path.join(os.tmpdir(), "gtfs-viz-cli");
  const daemonFile = path.join(dataRoot, "daemon.json");
  try {
    const raw = await readFile(daemonFile, "utf8");
    const meta = JSON.parse(raw);
    if (meta.pid) {
      try { process.kill(meta.pid, "SIGTERM"); } catch {}
    }
    await rm(daemonFile, { force: true });
  } catch {}
  await rm(dataRoot, { recursive: true, force: true }).catch(() => {});
  await rm(sessionRoot, { recursive: true, force: true }).catch(() => {});
}

try {
  await access(sourceDir);
} catch {
  process.exit(0);
}

const targets = {
  1: {
    provider: "anthropic",
    label: "Anthropic / Claude Code (~/.claude/skills)",
    dir: path.join(
      process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude"),
      "skills"
    ),
    allowedTools: "Bash(gtfs-viz:*) Bash(duckdb:*) Read",
  },
  2: {
    provider: "openai",
    label: "OpenAI / Codex (~/.codex/skills)",
    dir: path.join(
      process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
      "skills"
    ),
  },
  3: {
    provider: "google",
    label: "Google / Gemini CLI (~/.gemini/skills)",
    dir: path.join(
      process.env.GEMINI_HOME || path.join(os.homedir(), ".gemini"),
      "skills"
    ),
  },
  4: {
    provider: "generic",
    label: "Generic Agent Skills (~/.agents/skills)",
    dir: path.join(os.homedir(), ".agents", "skills"),
  },
};

async function installTo(target) {
  const targetDir = path.join(target.dir, "gtfs-viz");
  await rm(targetDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(target.dir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  const skillMdPath = path.join(targetDir, "SKILL.md");
  let skillMd = await readFile(skillMdPath, "utf8");
  skillMd = skillMd.replace(/^(metadata:\s*\n)/m, `$1  provider: ${target.provider}\n`);
  if (target.allowedTools) {
    skillMd = skillMd.replace(/^(metadata:)/m, `allowed-tools: ${target.allowedTools}\n$1`);
  }
  await writeFile(skillMdPath, skillMd, "utf8");
  console.log(`Installed GTFS Viz skill for ${target.provider} to ${targetDir}`);
}

if (!process.stdin.isTTY) {
  console.log(
    "Run `gtfs-viz install-skill <provider>` to install the agent skill."
  );
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\nInstall GTFS Viz skills:");
Object.entries(targets).forEach(([number, target]) => {
  console.log(`  ${number}. ${target.label}`);
});
console.log("  5. Skip");

const answer = await new Promise((resolve) => {
  rl.question("Choose 1-5: ", resolve);
});
rl.close();

const choice = answer.trim();
if (targets[choice]) {
  try {
    await installTo(targets[choice]);
  } catch (error) {
    console.error("Skill installation failed:", error.message);
    console.log("Run `gtfs-viz install-skill` to retry.");
  }
} else {
  console.log("Skipped. Run `gtfs-viz install-skill` anytime to install.");
}
