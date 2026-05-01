import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  readDaemonMetadata,
  removeDaemonMetadata,
  removeAllSessions,
  removeSession,
  type DaemonMetadata,
} from "./metadata.js";

export async function isDaemonRunning(): Promise<DaemonMetadata | null> {
  const meta = await readDaemonMetadata();
  if (!meta) return null;

  try {
    process.kill(meta.pid, 0);
    return meta;
  } catch {
    await removeDaemonMetadata();
    return null;
  }
}

export async function startDaemon(cliArgs: string[]): Promise<void> {
  const cliEntry = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "index.js"
  );

  const child = spawn(process.execPath, [cliEntry, "__daemon__", ...cliArgs], {
    detached: true,
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, GTFS_VIZ_DAEMON: "1" },
  });

  // Read startup info from child stdout (first line is JSON with port/url)
  const startupInfo = await new Promise<string>((resolve, reject) => {
    let data = "";
    const timeout = setTimeout(() => {
      child.stdout?.removeAllListeners();
      resolve(data);
    }, 5000);

    child.stdout?.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
      if (data.includes("\n")) {
        clearTimeout(timeout);
        child.stdout?.removeAllListeners();
        resolve(data.split("\n")[0]);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  child.unref();

  if (startupInfo) {
    process.stdout.write(startupInfo + "\n");
  }
}

export async function stopDaemon(): Promise<boolean> {
  const meta = await readDaemonMetadata();
  if (!meta) {
    await removeAllSessions().catch(() => {});
    return false;
  }

  try {
    process.kill(meta.pid, "SIGTERM");
    await removeSession(meta.sessionId).catch(() => {});
    await removeAllSessions().catch(() => {});
    await removeDaemonMetadata();
    return true;
  } catch {
    await removeSession(meta.sessionId).catch(() => {});
    await removeAllSessions().catch(() => {});
    await removeDaemonMetadata();
    return false;
  }
}
