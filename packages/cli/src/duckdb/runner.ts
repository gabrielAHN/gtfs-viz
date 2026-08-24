import { spawn } from "node:child_process";
import { buildDuckDbSessionSql } from "./config.js";

const duckdbBin = process.env.DUCKDB_BIN || "duckdb";

const duckDbErrorPattern =
  /(^|\n)(Binder|Catalog|Conversion|HTTP|IO|Invalid Input|Parser|Permission|Transaction) Error:|(^|\n)Error:|Failed to /;

export const runProcess = (command: string, args: string[], options: { cwd?: string } = {}) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => {
      stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      if (code === 0) {
        resolve({ stdout: stdoutText, stderr: stderrText });
      } else {
        reject(new Error(stderrText || stdoutText || `${command} exited with ${code}`));
      }
    });
  });

export const runDuckDb = async (args: string[]) => {
  try {
    const result = await runProcess(duckdbBin, args);
    if (duckDbErrorPattern.test(result.stderr)) {
      throw new Error(result.stderr.trim());
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT") || message.includes("not found")) {
      throw new Error(
        "DuckDB CLI not found. Install DuckDB or set DUCKDB_BIN to the duckdb executable.",
      );
    }
    throw error;
  }
};

export const queryRows = async (dbPath: string, sql: string) => {
  const configuredSql = `${buildDuckDbSessionSql(dbPath)}\n${sql}`;
  const { stdout } = await runDuckDb(["-readonly", "-json", dbPath, "-c", configuredSql]);
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as Record<string, unknown>[];
};

export const executeRows = async (dbPath: string, sql: string) => {
  const configuredSql = `${buildDuckDbSessionSql(dbPath)}\n${sql}`;
  const { stdout } = await runDuckDb(["-json", dbPath, "-c", configuredSql]);
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed) as Record<string, unknown>[];
  } catch {
    return [];
  }
};

export const executeSqlFile = async (dbPath: string, sqlPath: string) => {
  await runDuckDb([dbPath, "-bail", "-f", sqlPath]);
};
