import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createExtensionClient } from "@gtfs-viz/duckdb-extension/client";
import { buildDuckDbSessionSql } from "./config.js";

const duckdbBin = process.env.DUCKDB_BIN || "duckdb";

export const getNativeExtensionRepository = async (dbPath: string): Promise<string | undefined> => {
  let stored: string | undefined;
  try {
    stored = JSON.parse(await readFile(`${dbPath}.extension.json`, "utf8")).repository;
    if (typeof stored !== "string") throw new Error("Invalid saved extension repository");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return stored ?? process.env.GTFS_EXTENSION_REPOSITORY;
};

export const extensionStartupArgs = async (dbPath: string): Promise<string[]> => {
  const repository = await getNativeExtensionRepository(dbPath);
  if (repository === undefined) return [];
  const args: string[] = [];
  const client = createExtensionClient({ query: async sql => { args.push("-cmd", sql); } }, { repository });
  await client.install();
  await client.load();
  return args;
};

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
    const processError = error as NodeJS.ErrnoException;
    if (processError.code === "ENOENT") {
      throw new Error(
        "DuckDB CLI not found. Install DuckDB or set DUCKDB_BIN to the duckdb executable.",
      );
    }
    throw error;
  }
};

export const queryRows = async (dbPath: string, sql: string) => {
  const configuredSql = `${buildDuckDbSessionSql(dbPath)}\n${sql}`;
  const { stdout } = await runDuckDb(["-bail", "-readonly", "-json", ...await extensionStartupArgs(dbPath), dbPath, "-c", configuredSql]);
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  return JSON.parse(trimmed) as Record<string, unknown>[];
};

export const executeRows = async (dbPath: string, sql: string) => {
  const configuredSql = `${buildDuckDbSessionSql(dbPath)}\n${sql}`;
  const { stdout } = await runDuckDb(["-bail", "-json", ...await extensionStartupArgs(dbPath), dbPath, "-c", configuredSql]);
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed) as Record<string, unknown>[];
  } catch {
    return [];
  }
};

export const executeSqlFile = async (dbPath: string, sqlPath: string, importSteps?: string[]) => {
  const repository = await getNativeExtensionRepository(dbPath);
  if (repository === undefined) {
    await runDuckDb([dbPath, "-bail", "-f", sqlPath]);
  } else {
    if (!importSteps) throw new Error("Downloaded import requires explicit prepare/import/init stages");
    for (const step of importSteps) await executeRows(dbPath, step);
  }
  if (repository !== undefined) await writeFile(`${dbPath}.extension.json`, JSON.stringify({ repository }));
};

export const refreshDownloadedDataset = async (dbPath: string): Promise<boolean> => {
  const repository = await getNativeExtensionRepository(dbPath);
  if (repository === undefined) return false;
  const client = createExtensionClient({ query: sql => executeRows(dbPath, sql) }, { repository });
  await client.refresh();
  return true;
};
