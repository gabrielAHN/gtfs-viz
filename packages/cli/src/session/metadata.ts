import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type StatusValue = "starting" | "dashboard-connected" | "importing" | "ready" | "error";

export type SessionMetadata = {
  sessionId: string;
  dashboardUrl: string;
  feedUrl: string;
  apiUrl: string;
  pid: number;
  createdAt: string;
};

export type SessionStatus = {
  sessionId: string;
  status: StatusValue;
  message?: string;
  error?: string;
  updatedAt: string;
};

export type DatasetMetadata = {
  status: "ready";
  sourcePath: string;
  feedPath: string;
  dbPath: string;
  importedAt: string;
  fileName: string;
  fileSize: number;
  counts: {
    stops: number;
    stations: number;
    pathways: number;
  };
};

export type DaemonMetadata = {
  pid: number;
  port: number;
  sessionId: string;
  dashboardUrl: string;
  apiUrl: string;
  startedAt: string;
  datasetFile: string;
};

const sessionRoot = path.join(os.tmpdir(), "gtfs-viz-cli");
const sessionsDir = path.join(sessionRoot, "sessions");
const latestFile = path.join(sessionRoot, "latest.json");
export const dataRoot = path.join(os.homedir(), ".gtfs-viz-cli");
export const currentDataDir = path.join(dataRoot, "current");
export const currentDbPath = path.join(currentDataDir, "gtfs.duckdb");
export const currentFeedPath = path.join(currentDataDir, "feed.zip");
export const currentExtractDir = path.join(currentDataDir, "extract");
export const currentStatePath = path.join(currentDataDir, "state.json");
const daemonFile = path.join(dataRoot, "daemon.json");

export const ensureSessionsDir = async () => {
  await mkdir(sessionsDir, { recursive: true });
};

const getSessionFile = (sessionId: string) =>
  path.join(sessionsDir, `${sessionId}.json`);

export const writeSession = async (metadata: SessionMetadata) => {
  await ensureSessionsDir();
  const body = JSON.stringify(metadata, null, 2);
  await writeFile(getSessionFile(metadata.sessionId), body);
  await writeFile(latestFile, body);
};

export const removeSession = async (sessionId: string) => {
  await rm(getSessionFile(sessionId), { force: true });
  const latest = await readFile(latestFile, "utf8").catch(() => "");
  if (latest) {
    try {
      const metadata = JSON.parse(latest) as SessionMetadata;
      if (metadata.sessionId === sessionId) {
        await rm(latestFile, { force: true });
      }
    } catch {}
  }
};

export const removeAllSessions = async () => {
  await rm(sessionsDir, { recursive: true, force: true });
  await rm(latestFile, { force: true });
};

const DATASET_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const readDatasetState = async () => {
  const raw = await readFile(currentStatePath, "utf8").catch(() => {
    throw new Error("No GTFS dataset imported. Run gtfs-viz import /path/to/feed.zip first.");
  });
  const state = JSON.parse(raw) as DatasetMetadata;

  // Auto-expire datasets older than 7 days
  if (state.importedAt) {
    const age = Date.now() - new Date(state.importedAt).getTime();
    if (age > DATASET_MAX_AGE_MS) {
      await rm(currentDataDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(
        `Dataset expired (imported ${Math.floor(age / 86400000)} days ago). Run gtfs-viz import /path/to/feed.zip to reimport.`
      );
    }
  }

  return state;
};

export const writeDatasetState = async (metadata: DatasetMetadata) => {
  await mkdir(currentDataDir, { recursive: true });
  await writeFile(currentStatePath, JSON.stringify(metadata, null, 2));
};

export const writeDaemonMetadata = async (metadata: DaemonMetadata) => {
  await mkdir(dataRoot, { recursive: true });
  await writeFile(daemonFile, JSON.stringify(metadata, null, 2));
};

export const readDaemonMetadata = async (): Promise<DaemonMetadata | null> => {
  try {
    const raw = await readFile(daemonFile, "utf8");
    return JSON.parse(raw) as DaemonMetadata;
  } catch {
    return null;
  }
};

export const removeDaemonMetadata = async () => {
  await rm(daemonFile, { force: true });
};

export const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
