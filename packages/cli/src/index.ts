import { createWriteStream, existsSync } from "node:fs";
import { access, copyFile, cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { fileURLToPath } from "node:url";

import { dashboardViewForNamedQuery, sqlForNamedQuery } from "@gtfs-viz/procedures";

import { parseArgs, getFlagString, hasFlag, wantsDataOutput } from "./args.js";
import type { Args } from "./args.js";
import { runProcess, queryRows, executeRows, executeSqlFile } from "./duckdb/runner.js";
import { buildImportSql } from "./duckdb/import-sql.js";
import { createServer, listen, validateAppDist } from "./server/http-server.js";
import { printResult, printHelp, printCommandHelp, printExamples } from "./output/print.js";
import {
  readDatasetState,
  writeDatasetState,
  writeSession,
  removeSession,
  readDaemonMetadata,
  writeDaemonMetadata,
  removeDaemonMetadata,
  randomId,
  dataRoot,
  currentDataDir,
  currentDbPath,
  currentFeedPath,
  currentExtractDir,
} from "./session/metadata.js";
import type {
  DatasetMetadata,
  SessionMetadata,
  SessionStatus,
  DaemonMetadata,
} from "./session/metadata.js";
import { isDaemonRunning, stopDaemon } from "./session/daemon.js";

import { realpathSync } from "node:fs";

const resolvePackageRoot = () => {
  // Resolve the real path of the running script (follows symlinks from npm global bin)
  try {
    const realScript = realpathSync(process.argv[1]);
    const dir = path.dirname(realScript);
    return dir.endsWith("dist") ? path.resolve(dir, "..") : path.resolve(dir, "..");
  } catch {
    // Fallback for import.meta.url (dev mode with tsc output)
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  }
};
const packageRoot = resolvePackageRoot();

const supportedViews = new Set([
  "auto",
  "stations/info",
  "stations/map",
  "stations/parts/map",
  "stations/parts/table",
  "stations/pathways/flow/radial",
  "stations/pathways/map/directional",
  "stations/pathways/table/start",
  "stations/pathways/table/end",
  "stations/table",
  "stops/map",
  "stops/table",
]);

const openBrowser = (url: string) => {
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const cliArgs = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, cliArgs, { detached: true, stdio: "ignore" });
  child.unref();
};

const escapeSql = (value: string) => value.replace(/'/g, "''");
const sqlString = (value: string) => `'${escapeSql(value)}'`;

const refreshPathwayNetwork = async (dbPath: string) => {
  await executeRows(
    dbPath,
    `DROP VIEW IF EXISTS pathway_network;
     CREATE VIEW pathway_network AS
     SELECT
       p.row_id,
       p.pathway_id,
       p.from_stop_id,
       p.to_stop_id,
       p.pathway_mode,
       p.is_bidirectional,
       p.length,
       p.traversal_time,
       p.stair_count,
       p.max_slope,
       p.min_width,
       p.signposted_as,
       p.reversed_signposted_as,
       p.pathway_mode_name,
       p.direction_type,
       COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) AS from_parent_station,
       s1.stop_lat AS from_lat,
       s1.stop_lon AS from_lon,
       s1.location_type_name AS from_location_type_name,
       COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) AS to_parent_station,
       s2.stop_lat AS to_lat,
       s2.stop_lon AS to_lon,
       s2.location_type_name AS to_location_type_name,
       CASE
         WHEN s1.stop_lat IS NOT NULL AND s1.stop_lon IS NOT NULL
              AND s2.stop_lat IS NOT NULL AND s2.stop_lon IS NOT NULL
         THEN DEGREES(
           ATAN2(
             s2.stop_lon - s1.stop_lon,
             s2.stop_lat - s1.stop_lat
           )
         )
         ELSE NULL
       END AS angle
     FROM PathwaysView p
     JOIN StopsView s1 ON p.from_stop_id = s1.stop_id
     JOIN StopsView s2 ON p.to_stop_id = s2.stop_id;
     CREATE OR REPLACE MACRO get_station_info(station_id) AS TABLE (
       WITH station_base AS (
         SELECT
           row_id,
           stop_id,
           stop_name,
           stop_lat,
           stop_lon,
           '🔵' AS status,
           location_type_name,
           parent_station,
           wheelchair_status
         FROM StopsView
         WHERE location_type_name = 'Station'
           AND stop_id = station_id
       ),
       exit_counts AS (
         SELECT
           COUNT(*) AS exit_count
         FROM StopsView
         WHERE location_type_name = 'Exit/Entrance'
           AND parent_station = station_id
       ),
       pathway_counts AS (
         SELECT
           COUNT(DISTINCT p.pathway_id) AS pathway_count
         FROM PathwaysView p
         JOIN StopsView s1 ON p.from_stop_id = s1.stop_id
         JOIN StopsView s2 ON p.to_stop_id = s2.stop_id
         WHERE (
           COALESCE(NULLIF(s1.parent_station, ''), s1.stop_id) = station_id
           AND COALESCE(NULLIF(s2.parent_station, ''), s2.stop_id) = station_id
         )
       )
       SELECT
         s.row_id,
         s.stop_id,
         s.stop_name,
         s.stop_lat,
         s.stop_lon,
         s.status,
         COALESCE(e.exit_count, 0) AS exit_count,
         s.location_type_name,
         s.parent_station,
         s.wheelchair_status,
         COALESCE(pc.pathway_count, 0) AS pathway_count,
         CASE
           WHEN COALESCE(pc.pathway_count, 0) = 0 THEN '❌'
           WHEN COALESCE(pc.pathway_count, 0) > 0 THEN '✅'
           WHEN COALESCE(pc.pathway_count, 0) = 0
             AND COALESCE(e.exit_count, 0) > 0
           THEN '🟡'
           ELSE '❌'
         END AS pathways_status
       FROM station_base s
       CROSS JOIN exit_counts e
       CROSS JOIN pathway_counts pc
     )`,
  );
};

const extractZipEntry = (zipPath: string, entry: string, targetPath: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("unzip", ["-p", zipPath, entry], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = createWriteStream(targetPath);
    const stderr: Buffer[] = [];
    child.stdout.pipe(output);
    child.stderr.on("data", (chunk) =>
      stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    child.on("error", reject);
    output.on("error", reject);
    child.on("close", (code) => {
      output.end();
      if (code === 0) resolve();
      else
        reject(new Error(Buffer.concat(stderr).toString("utf8") || `Failed to extract ${entry}`));
    });
  });

const listZipEntries = async (zipPath: string) => {
  const { stdout } = await runProcess("unzip", ["-Z1", zipPath]);
  return stdout.split(/\r?\n/).filter(Boolean);
};

const findGtfsEntry = (entries: string[], fileName: string) =>
  entries.find((e) => e === fileName || e.endsWith(`/${fileName}`));

const numberOrUndefined = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

type SelectionInput = {
  flag: string;
  mode: "any" | "id" | "name";
  value: string;
};

const getSelectionInput = (
  flags: Record<string, string | boolean>,
  candidates: Array<[string, "any" | "id" | "name"]>,
) => {
  const matches = candidates
    .map(([flag, mode]) => {
      const v = getFlagString(flags, flag);
      return v ? { flag, mode, value: v } : undefined;
    })
    .filter((v): v is SelectionInput => Boolean(v));
  if (matches.length > 1)
    throw new Error(`Use only one of ${matches.map((m) => `--${m.flag}`).join(", ")}`);
  return matches[0];
};

const getStationSelectionInput = (flags: Record<string, string | boolean>) =>
  getSelectionInput(flags, [
    ["station-id", "id"],
    ["station-name", "name"],
    ["selected-station", "any"],
  ]);
const getStopSelectionInput = (flags: Record<string, string | boolean>) =>
  getSelectionInput(flags, [
    ["stop-id", "id"],
    ["stop-name", "name"],
    ["selected-stop", "any"],
  ]);
const getNodeSelectionInput = (flags: Record<string, string | boolean>) =>
  getSelectionInput(flags, [
    ["node-id", "id"],
    ["node-name", "name"],
    ["selected-node", "any"],
  ]);

const selectionExpressions = (input: SelectionInput) => {
  const value = sqlString(input.value);
  const iId = input.mode !== "name";
  const iNm = input.mode !== "id";
  return {
    idE: iId ? `stop_id = ${value}` : "FALSE",
    idL: iId ? `LOWER(stop_id) = LOWER(${value})` : "FALSE",
    nmE: iNm ? `stop_name = ${value}` : "FALSE",
    nmL: iNm ? `LOWER(stop_name) = LOWER(${value})` : "FALSE",
    idC: iId ? `LOWER(stop_id) LIKE '%' || LOWER(${value}) || '%'` : "FALSE",
    nmC: iNm ? `LOWER(stop_name) LIKE '%' || LOWER(${value}) || '%'` : "FALSE",
  };
};

const resolveSelection = async (
  dbPath: string,
  table: "StationsTable" | "StopsTable",
  input: SelectionInput,
) => {
  const { idE, idL, nmE, nmL, idC, nmC } = selectionExpressions(input);

  const rows = await queryRows(
    dbPath,
    `
    WITH c AS (SELECT stop_id, stop_name, stop_lat, stop_lon,
      CASE WHEN ${idE} THEN 1 WHEN ${idL} THEN 2 WHEN ${nmE} THEN 3 WHEN ${nmL} THEN 4 WHEN ${idC} THEN 5 WHEN ${nmC} THEN 6 ELSE NULL END AS r
      FROM ${table} WHERE ${idE} OR ${idL} OR ${nmE} OR ${nmL} OR ${idC} OR ${nmC}),
    b AS (SELECT * FROM c WHERE r = (SELECT MIN(r) FROM c))
    SELECT stop_id, stop_name, stop_lat, stop_lon FROM b ORDER BY stop_name, stop_id LIMIT 6`,
  );

  const label = table === "StationsTable" ? "station" : "stop";
  if (rows.length === 0)
    throw new Error(`No ${label} matched "${input.value}" from --${input.flag}`);
  if (rows.length > 1) {
    const fmt = rows.map((r) => `${r.stop_id} (${r.stop_name || ""})`).join(", ");
    throw new Error(`Multiple ${label}s matched: ${fmt}. Use --${label}-id with exact ID.`);
  }
  const row = rows[0];
  return {
    stopId: String(row.stop_id),
    stopName: typeof row.stop_name === "string" ? row.stop_name : undefined,
    stopLat: numberOrUndefined(row.stop_lat),
    stopLon: numberOrUndefined(row.stop_lon),
  };
};

const resolveStopDetail = async (dbPath: string, input: SelectionInput) => {
  const { idE, idL, nmE, nmL, idC, nmC } = selectionExpressions(input);
  const rows = await queryRows(
    dbPath,
    `
    WITH c AS (SELECT stop_id, stop_name, stop_lat, stop_lon, parent_station, location_type_name,
      CASE WHEN ${idE} THEN 1 WHEN ${idL} THEN 2 WHEN ${nmE} THEN 3 WHEN ${nmL} THEN 4 WHEN ${idC} THEN 5 WHEN ${nmC} THEN 6 ELSE NULL END AS r
      FROM StopsView WHERE ${idE} OR ${idL} OR ${nmE} OR ${nmL} OR ${idC} OR ${nmC}),
    b AS (SELECT * FROM c WHERE r = (SELECT MIN(r) FROM c))
    SELECT stop_id, stop_name, stop_lat, stop_lon, parent_station, location_type_name FROM b ORDER BY stop_name, stop_id LIMIT 6`,
  );

  if (rows.length === 0)
    throw new Error(`No stop or node matched "${input.value}" from --${input.flag}`);
  if (rows.length > 1) {
    const fmt = rows.map((r) => `${r.stop_id} (${r.stop_name || ""})`).join(", ");
    throw new Error(`Multiple stops or nodes matched: ${fmt}. Use an exact ID.`);
  }
  const row = rows[0];
  return {
    stopId: String(row.stop_id),
    stopName: typeof row.stop_name === "string" ? row.stop_name : undefined,
    parentStation: typeof row.parent_station === "string" ? row.parent_station : undefined,
    locationType: typeof row.location_type_name === "string" ? row.location_type_name : undefined,
  };
};

const resolveStationNode = async (dbPath: string, stationId: string, input: SelectionInput) => {
  const { idE, idL, nmE, nmL, idC, nmC } = selectionExpressions(input);
  const rows = await queryRows(
    dbPath,
    `
    WITH c AS (SELECT stop_id, stop_name,
      CASE WHEN ${idE} THEN 1 WHEN ${idL} THEN 2 WHEN ${nmE} THEN 3 WHEN ${nmL} THEN 4 WHEN ${idC} THEN 5 WHEN ${nmC} THEN 6 ELSE NULL END AS r
      FROM get_station_stops(${sqlString(stationId)}) WHERE ${idE} OR ${idL} OR ${nmE} OR ${nmL} OR ${idC} OR ${nmC}),
    b AS (SELECT * FROM c WHERE r = (SELECT MIN(r) FROM c))
    SELECT stop_id, stop_name FROM b ORDER BY stop_name, stop_id LIMIT 6`,
  );

  if (rows.length === 0)
    throw new Error(`No station part matched "${input.value}" from --${input.flag}`);
  if (rows.length > 1) {
    const fmt = rows.map((r) => `${r.stop_id} (${r.stop_name || ""})`).join(", ");
    throw new Error(`Multiple station parts matched: ${fmt}. Use --node-id with exact ID.`);
  }
  const row = rows[0];
  return {
    stopId: String(row.stop_id),
    stopName: typeof row.stop_name === "string" ? row.stop_name : undefined,
  };
};

const validateFeed = async (feedPath: string) => {
  const resolved = path.resolve(feedPath);
  await access(resolved).catch(() => {
    throw new Error(`GTFS file not found: ${feedPath}`);
  });
  const s = await stat(resolved);
  if (!s.isFile()) throw new Error(`Not a file: ${feedPath}`);
  if (!resolved.toLowerCase().endsWith(".zip")) throw new Error("Requires a .zip file");
  return resolved;
};

const importDataset = async (feedArg: string) => {
  const feedPath = await validateFeed(feedArg);
  const fileStat = await stat(feedPath);
  const entries = await listZipEntries(feedPath);
  const stopsEntry = findGtfsEntry(entries, "stops.txt");
  const pathwaysEntry = findGtfsEntry(entries, "pathways.txt");
  if (!stopsEntry) throw new Error("GTFS zip is missing required stops.txt");

  await rm(currentDataDir, { recursive: true, force: true });
  await mkdir(currentExtractDir, { recursive: true });
  await copyFile(feedPath, currentFeedPath);

  const stopsPath = path.join(currentExtractDir, "stops.txt");
  const pathwaysPath = pathwaysEntry ? path.join(currentExtractDir, "pathways.txt") : undefined;
  await extractZipEntry(feedPath, stopsEntry, stopsPath);
  if (pathwaysEntry && pathwaysPath) await extractZipEntry(feedPath, pathwaysEntry, pathwaysPath);

  const importSqlContent = await buildImportSql({ stopsPath, pathwaysPath });
  const importSqlPath = path.join(currentDataDir, "import.sql");
  await writeFile(importSqlPath, importSqlContent);
  await executeSqlFile(currentDbPath, importSqlPath);

  const [counts] = await queryRows(
    currentDbPath,
    `SELECT (SELECT COUNT(*) FROM StopsTable) AS stops, (SELECT COUNT(*) FROM StationsTable) AS stations, (SELECT COUNT(*) FROM pathways) AS pathways`,
  );

  const metadata: DatasetMetadata = {
    status: "ready",
    sourcePath: feedPath,
    feedPath: currentFeedPath,
    dbPath: currentDbPath,
    importedAt: new Date().toISOString(),
    fileName: path.basename(feedPath),
    fileSize: fileStat.size,
    counts: {
      stops: Number(counts?.stops || 0),
      stations: Number(counts?.stations || 0),
      pathways: Number(counts?.pathways || 0),
    },
  };
  await writeDatasetState(metadata);
  return metadata;
};

function buildDashboardUrl(
  baseUrl: string,
  sessionId: string,
  view: string,
  params: Record<string, string>,
): string {
  const url = new URL(baseUrl);
  url.pathname = `/${view}`;
  url.searchParams.set("gtfsSource", "/__gtfs_viz/feed.zip");
  url.searchParams.set("cliSession", sessionId);
  url.searchParams.set("cliApi", "/__gtfs_viz/api");
  url.searchParams.set("cliView", view);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function spawnDaemon(): Promise<DaemonMetadata> {
  await readDatasetState();
  await validateAppDist();

  const cliEntry = path.join(packageRoot, "dist", "index.js");
  const child = spawn(process.execPath, [cliEntry, "__daemon__"], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GTFS_VIZ_DAEMON: "1" },
  });

  const startupInfo = await new Promise<string>((resolve, reject) => {
    let data = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      reject(new Error(stderr.trim() || "Timed out waiting for dashboard daemon to start"));
    }, 5000);
    child.stdout?.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
      if (data.includes("\n")) {
        clearTimeout(timer);
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();
        resolve(data.split("\n")[0]);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      reject(new Error(stderr.trim() || `Dashboard daemon exited with code ${code}`));
    });
  });

  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();

  if (!startupInfo.trim()) throw new Error("Dashboard daemon did not return startup metadata");
  const info = JSON.parse(startupInfo) as DaemonMetadata;
  return info;
}

async function ensureDaemon(): Promise<{
  daemon: DaemonMetadata;
  fresh: boolean;
}> {
  const existing = await isDaemonRunning();
  if (existing) return { daemon: existing, fresh: false };
  const daemon = await spawnDaemon();
  return { daemon, fresh: true };
}

async function navigateDaemon(daemon: DaemonMetadata, targetUrl: string): Promise<void> {
  await fetch(`${daemon.apiUrl}/navigate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: targetUrl }),
  });
}

async function openDashboardView(view: string, params: Record<string, string>): Promise<void> {
  const { daemon, fresh } = await ensureDaemon();
  const url = buildDashboardUrl(`http://127.0.0.1:${daemon.port}`, daemon.sessionId, view, params);

  if (fresh) {
    openBrowser(url);
  } else {
    await navigateDaemon(daemon, url);
  }

  console.log(url);
}

async function runDaemon(): Promise<void> {
  const dataset = await readDatasetState();

  const sessionId = randomId();
  const initialStatus: SessionStatus = {
    sessionId,
    status: "starting",
    message: "Waiting for dashboard",
    updatedAt: new Date().toISOString(),
  };
  const handle = createServer(sessionId, dataset, initialStatus);
  const actualPort = await listen(handle.server, "127.0.0.1", 0);
  const baseUrl = `http://127.0.0.1:${actualPort}`;

  const sessionMeta: SessionMetadata = {
    sessionId,
    dashboardUrl: baseUrl,
    feedUrl: `${baseUrl}/__gtfs_viz/feed.zip`,
    apiUrl: `${baseUrl}/__gtfs_viz/api`,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  };
  await writeSession(sessionMeta);

  const daemonMeta: DaemonMetadata = {
    pid: process.pid,
    port: actualPort,
    sessionId,
    dashboardUrl: baseUrl,
    apiUrl: sessionMeta.apiUrl,
    startedAt: new Date().toISOString(),
    datasetFile: dataset.fileName,
  };
  await writeDaemonMetadata(daemonMeta);

  const cleanup = async () => {
    await removeSession(sessionId).catch(() => {});
    const current = await readDaemonMetadata().catch(() => null);
    if (current && current.pid === process.pid) {
      await removeDaemonMetadata().catch(() => {});
    }
  };
  process.once("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });
  process.once("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });

  process.stdout.write(JSON.stringify(daemonMeta) + "\n");
  process.stdout.on("error", () => {});

  // Idle timeout: exit after 30 minutes with no HTTP requests
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  let idleTimer = setTimeout(async () => {
    await cleanup();
    process.exit(0);
  }, IDLE_TIMEOUT_MS);
  handle.server.on("request", () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      await cleanup();
      process.exit(0);
    }, IDLE_TIMEOUT_MS);
  });

  await new Promise(() => {});
}

async function resolveStationFromArgs(args: Args): Promise<{ stopId: string; stopName?: string }> {
  const positional = args.positionals.join(" ").trim();
  const flags = { ...args.flags };
  const id = getFlagString(flags, "id") || getFlagString(flags, "station-id");
  const name = getFlagString(flags, "name") || getFlagString(flags, "station-name");
  const selected = getFlagString(flags, "selected-station") || positional || undefined;
  if (id) flags["station-id"] = id;
  else if (name) flags["station-name"] = name;
  else if (selected) flags["selected-station"] = selected;
  const si = getStationSelectionInput(flags);
  if (!si) throw new Error("Provide a station value");
  const ds = await readDatasetState();
  return resolveSelection(ds.dbPath, "StationsTable", si);
}

async function resolveStopFromArgs(args: Args): Promise<{ stopId: string; stopName?: string }> {
  const positional = args.positionals.join(" ").trim();
  const flags = { ...args.flags };
  const id = getFlagString(flags, "id") || getFlagString(flags, "stop-id");
  const name = getFlagString(flags, "name") || getFlagString(flags, "stop-name");
  const selected = getFlagString(flags, "selected-stop") || positional || undefined;
  if (id) flags["stop-id"] = id;
  else if (name) flags["stop-name"] = name;
  else if (selected) flags["selected-stop"] = selected;
  const si = getStopSelectionInput(flags);
  if (!si) throw new Error("Provide a stop value");
  const ds = await readDatasetState();
  return resolveSelection(ds.dbPath, "StopsTable", si);
}

const getPathwayStopSelectionInput = (args: Args) => {
  const positional = args.positionals.join(" ").trim();
  const flags = { ...args.flags };
  const id =
    getFlagString(flags, "stop-id") ||
    getFlagString(flags, "node-id") ||
    getFlagString(flags, "id");
  const name =
    getFlagString(flags, "stop-name") ||
    getFlagString(flags, "node-name") ||
    getFlagString(flags, "name");
  const selected =
    getFlagString(flags, "selected-stop") ||
    getFlagString(flags, "selected-node") ||
    positional ||
    undefined;
  if (id) flags["stop-id"] = id;
  else if (name) flags["stop-name"] = name;
  else if (selected) flags["selected-stop"] = selected;
  return getStopSelectionInput(flags);
};

const getRouteFlag = (args: Args) =>
  getFlagString(args.flags, "route") || getFlagString(args.flags, "view");

const stationViewForRoute = (route?: string) => {
  if (!route || route === "info" || route === "station-info") return "stations/info";
  if (route === "map" || route === "stations/map") return "stations/map";
  if (route === "table" || route === "stations/table") return "stations/table";
  if (supportedViews.has(route)) return route;
  throw new Error("Station route must be info, map, or table");
};

const stationsViewForRoute = (route?: string) => {
  if (!route || route === "map" || route === "stations/map") return "stations/map";
  if (route === "table" || route === "stations/table") return "stations/table";
  throw new Error("Stations route must be map or table");
};

const stopsViewForRoute = (route?: string) => {
  if (!route || route === "map" || route === "stops/map") return "stops/map";
  if (route === "table" || route === "stops/table") return "stops/table";
  throw new Error("Stops route must be map or table");
};

const pathwayViewForRoute = (route?: string) => {
  if (
    !route ||
    route === "flow" ||
    route === "radial" ||
    route === "stations/pathways/flow/radial"
  ) {
    return "stations/pathways/flow/radial";
  }
  if (route === "map" || route === "directional" || route === "stations/pathways/map/directional") {
    return "stations/pathways/map/directional";
  }
  if (route === "table" || route === "start" || route === "stations/pathways/table/start") {
    return "stations/pathways/table/start";
  }
  if (route === "end" || route === "stations/pathways/table/end") {
    return "stations/pathways/table/end";
  }
  throw new Error("Pathway route must be flow, map, table, or end");
};

const wantsDashboardOutput = (args: Args) =>
  hasFlag(args.flags, "dashboard") ||
  hasFlag(args.flags, "open") ||
  typeof args.flags.route === "string" ||
  typeof args.flags.view === "string";

const dashboardParamsFromFlags = (args: Args) => {
  const params: Record<string, string> = {};
  const stationFilter = getFlagString(args.flags, "station-filter");
  const stopFilter = getFlagString(args.flags, "stop-filter");
  const mapFocus = getFlagString(args.flags, "map-focus");
  const selectedNode =
    getFlagString(args.flags, "selected-node") || getFlagString(args.flags, "node-id");
  if (stationFilter) params.cliStationFilter = stationFilter;
  if (stopFilter) params.cliStopFilter = stopFilter;
  if (mapFocus) params.cliMapFocus = mapFocus;
  if (selectedNode) {
    params.cliSelectedNode = selectedNode;
    params.selectedNodeId = selectedNode;
  }
  return params;
};

const ensureOutputMode = (args: Args) => {
  if (wantsDataOutput(args.flags) && wantsDashboardOutput(args)) {
    throw new Error(
      "Use either --data/--format for terminal output or --dashboard/--route for dashboard output",
    );
  }
};

const timeIntervalCondition = (value: string | undefined, column: string) => {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 2) {
    throw new Error("Use --time-interval <max> or --time-interval <min,max>");
  }
  const values = parts.map(Number);
  if (values.some((v) => !Number.isFinite(v))) {
    throw new Error("Use numeric seconds for --time-interval");
  }
  if (values.length === 2) {
    const [min, max] = values;
    if (min > max) throw new Error("--time-interval min must be less than or equal to max");
    return `${column} >= ${min} AND ${column} <= ${max}`;
  }
  return `${column} <= ${values[0]}`;
};

const commandImport = async (args: Args) => {
  const feedArg = args.positionals[0];
  if (!feedArg) throw new Error("Usage: gtfs-viz import <feed.zip>");
  try {
    await stopDaemon().catch(() => {});
    const metadata = await importDataset(feedArg);
    console.log(`Imported ${metadata.fileName}`);
    console.log(
      `Stops: ${metadata.counts.stops}  Stations: ${metadata.counts.stations}  Pathways: ${metadata.counts.pathways}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Import failed: ${path.basename(feedArg)}`);
    console.error(message);
    process.exit(1);
  }
};

const commandTables = async (args: Args) => {
  const dataset = await readDatasetState();
  const rows = await queryRows(
    dataset.dbPath,
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'main'
    ORDER BY table_name
  `,
  );
  printResult(
    { columns: rows.length > 0 ? Object.keys(rows[0]) : ["table_name"], rows },
    args.flags,
  );
};

const commandStations = async (args: Args) => {
  ensureOutputMode(args);
  if (wantsDashboardOutput(args)) {
    await openDashboardView(
      stationsViewForRoute(getRouteFlag(args)),
      dashboardParamsFromFlags(args),
    );
    return;
  }
  const dataset = await readDatasetState();
  const filters: string[] = [];
  const id = getFlagString(args.flags, "station-id") || getFlagString(args.flags, "id");
  const name = getFlagString(args.flags, "station-name") || getFlagString(args.flags, "name");
  const wheelchair = getFlagString(args.flags, "wheelchair");
  const pathways = getFlagString(args.flags, "pathways-status") || getFlagString(args.flags, "pathways");
  if (id) filters.push(`stop_id = ${sqlString(id)}`);
  if (name) filters.push(`LOWER(stop_name) LIKE LOWER(${sqlString(`%${name}%`)})`);
  if (wheelchair) filters.push(`wheelchair_status = ${sqlString(wheelchair)}`);
  if (pathways) filters.push(`pathways_status = ${sqlString(pathways)}`);
  const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
  const rows = await queryRows(dataset.dbPath, `SELECT * FROM StationsTable${where}`);
  printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
};

const commandStops = async (args: Args) => {
  ensureOutputMode(args);
  if (wantsDashboardOutput(args)) {
    await openDashboardView(stopsViewForRoute(getRouteFlag(args)), dashboardParamsFromFlags(args));
    return;
  }
  const dataset = await readDatasetState();
  const filters: string[] = [];
  const id = getFlagString(args.flags, "stop-id") || getFlagString(args.flags, "id");
  const name = getFlagString(args.flags, "stop-name") || getFlagString(args.flags, "name");
  const wheelchair = getFlagString(args.flags, "wheelchair");
  const locationType = getFlagString(args.flags, "location-type");
  if (id) filters.push(`stop_id = ${sqlString(id)}`);
  if (name) filters.push(`LOWER(stop_name) LIKE LOWER(${sqlString(`%${name}%`)})`);
  if (wheelchair) filters.push(`wheelchair_status = ${sqlString(wheelchair)}`);
  if (locationType) filters.push(`location_type_name = ${sqlString(locationType)}`);
  const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
  const rows = await queryRows(dataset.dbPath, `SELECT * FROM StopsTable${where}`);
  printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
};

const commandStatus = async () => {
  const dataset = await readDatasetState();
  const daemon = await isDaemonRunning();
  console.log(`Dataset: ${dataset.fileName}`);
  console.log(`Source: ${dataset.sourcePath}`);
  console.log(`DuckDB: ${dataset.dbPath}`);
  console.log(`Imported: ${dataset.importedAt}`);
  console.log(
    `Stops: ${dataset.counts.stops}  Stations: ${dataset.counts.stations}  Pathways: ${dataset.counts.pathways}`,
  );
  if (daemon) {
    console.log(`Session: running (port ${daemon.port})`);
    console.log(`Dashboard: http://127.0.0.1:${daemon.port}`);
  } else {
    console.log("Session: not running");
  }
};

const commandStopSession = async () => {
  const stopped = await stopDaemon();
  console.log(stopped ? "Session stopped." : "No running session found.");
};

const commandRestartSession = async () => {
  const stopped = await stopDaemon().catch(() => false);
  await rm(currentDataDir, { recursive: true, force: true }).catch(() => {});
  console.log(stopped ? "Session stopped." : "No running session found.");
  console.log("Removed local DuckDB data.");
  console.log("Run gtfs-viz import /path/to/feed.zip to start fresh.");
};

const commandClean = async () => {
  await stopDaemon().catch(() => {});
  await rm(dataRoot, { recursive: true, force: true }).catch(() => {});
  console.log("Stopped daemon and removed all local data.");
  console.log("Run gtfs-viz import /path/to/feed.zip to start fresh.");
};

const commandExport = async (args: Args) => {
  const ds = await readDatasetState();
  const outDir = getFlagString(args.flags, "output") || getFlagString(args.flags, "out") || getFlagString(args.flags, "o") || ".";
  const outPath = path.resolve(outDir);

  const includeStops = !hasFlag(args.flags, "no-stops");
  const includePathways = !hasFlag(args.flags, "no-pathways");

  if (!includeStops && !includePathways) {
    throw new Error("Nothing to export. Remove --no-stops or --no-pathways.");
  }

  // Check for pending edits
  const stopEdits = await queryRows(ds.dbPath, "SELECT COUNT(*) AS c FROM EditStopTable").catch(() => [{ c: 0 }]);
  const pathwayEdits = await queryRows(ds.dbPath, "SELECT COUNT(*) AS c FROM EditPathwayTable").catch(() => [{ c: 0 }]);
  const stopEditCount = Number(stopEdits[0]?.c || 0);
  const pathwayEditCount = Number(pathwayEdits[0]?.c || 0);

  if (stopEditCount === 0 && pathwayEditCount === 0 && !hasFlag(args.flags, "force")) {
    console.log("No edits to export. Use --force to export original data unchanged.");
    return;
  }

  await mkdir(outPath, { recursive: true });

  const exportFile = async (
    table: string,
    editTable: string,
    mergeId: string,
    removeColumns: string[],
    fileName: string,
  ) => {
    // Get original columns minus computed ones
    const colRows = await queryRows(
      ds.dbPath,
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`,
    );
    const allCols = colRows.map((r) => String(r.column_name));
    const orgCols = allCols.filter((c) => !removeColumns.includes(c));

    // Get edit table columns
    const editColRows = await queryRows(
      ds.dbPath,
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${editTable}' ORDER BY ordinal_position`,
    );
    const editCols = editColRows.map((r) => String(r.column_name));

    const mappedCols = orgCols.map((c) =>
      editCols.includes(c) ? `COALESCE(edt.${c}, NULL) AS ${c}` : `NULL AS ${c}`,
    );

    const mergeQuery = `
      SELECT ${orgCols.join(", ")}
      FROM (
        SELECT edt.row_id, ${mappedCols.join(", ")}
        FROM ${editTable} edt
        WHERE edt.status IN ('new', 'edit', 'new edit')
        UNION ALL
        SELECT st.row_id, ${orgCols.join(", ")}
        FROM ${table} st
        WHERE NOT EXISTS (
          SELECT 1 FROM ${editTable} edt
          WHERE edt.${mergeId} = st.${mergeId}
          AND edt.status IN ('edit', 'deleted', 'new edit')
        )
      ) combined
      ORDER BY row_id`;

    const filePath = path.join(outPath, fileName);
    await executeRows(
      ds.dbPath,
      `COPY (${mergeQuery}) TO '${filePath.replace(/'/g, "''")}' (FORMAT CSV, HEADER, DELIMITER ',')`,
    );
    return filePath;
  };

  const exported: string[] = [];

  if (includeStops) {
    const f = await exportFile(
      "stops", "EditStopTable", "stop_id",
      ["row_id", "location_type_name", "wheelchair_status"],
      "stops.txt",
    );
    console.log(`Exported stops.txt (${stopEditCount} edits applied)`);
    exported.push(f);
  }

  if (includePathways) {
    const pathwayCount = await queryRows(ds.dbPath, "SELECT COUNT(*) AS c FROM pathways").catch(() => [{ c: 0 }]);
    if (Number(pathwayCount[0]?.c || 0) > 0 || pathwayEditCount > 0) {
      const f = await exportFile(
        "pathways", "EditPathwayTable", "pathway_id",
        ["row_id", "pathway_mode_name", "direction_type"],
        "pathways.txt",
      );
      console.log(`Exported pathways.txt (${pathwayEditCount} edits applied)`);
      exported.push(f);
    } else {
      console.log("No pathways data to export.");
    }
  }

  if (exported.length > 0) {
    console.log(`Files written to ${outPath}`);
  }
};

const commandQuery = async (args: Args) => {
  ensureOutputMode(args);
  const dataset = await readDatasetState();
  const sql = getFlagString(args.flags, "sql");
  const name = getFlagString(args.flags, "name");
  if (!sql && !name) throw new Error("Provide --sql or --name");
  if (sql && name) throw new Error("Use only one of --sql or --name");
  const argsJson = getFlagString(args.flags, "args-json");
  const parsedArgs = argsJson ? JSON.parse(argsJson) : undefined;
  const dashboard = name ? dashboardViewForNamedQuery(name, parsedArgs) : undefined;
  if (name && dashboard && !wantsDataOutput(args.flags)) {
    const params = dashboardParamsFromFlags(args);
    if (dashboard.stationId) {
      params.cliSelectedStation = dashboard.stationId;
      params.selectedStationId = dashboard.stationId;
    }
    await openDashboardView(dashboard.view, params);
    return;
  }
  if (wantsDashboardOutput(args)) {
    if (!name) throw new Error("Dashboard output is only available for named queries");
    if (!dashboard) throw new Error(`Named query does not have a dashboard route: ${name}`);
  }
  const q = sql || sqlForNamedQuery(name!, parsedArgs);
  const rows = await queryRows(dataset.dbPath, q);
  printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
};

const commandStation = async (args: Args) => {
  ensureOutputMode(args);
  const st = await resolveStationFromArgs(args);
  if (wantsDataOutput(args.flags)) {
    const ds = await readDatasetState();
    const rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM get_station_info(${sqlString(st.stopId)})`,
    );
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }
  await openDashboardView(stationViewForRoute(getRouteFlag(args)), {
    ...dashboardParamsFromFlags(args),
    cliSelectedStation: st.stopId,
    selectedStationId: st.stopId,
  });
};

const commandStationConnections = async (args: Args) => {
  ensureOutputMode(args);
  const st = await resolveStationFromArgs(args);
  if (wantsDataOutput(args.flags)) {
    const ds = await readDatasetState();
    const rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM get_station_connections(${sqlString(st.stopId)})`,
    );
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }
  await openDashboardView(pathwayViewForRoute(getRouteFlag(args)), {
    ...dashboardParamsFromFlags(args),
    cliSelectedStation: st.stopId,
    selectedStationId: st.stopId,
  });
};

const commandStationPathways = async (args: Args) => {
  ensureOutputMode(args);
  const ds = await readDatasetState();
  let st: { stopId: string; stopName?: string };
  let nodeValue: string | undefined;

  try {
    st = await resolveStationFromArgs(args);
  } catch (stationError) {
    const stopInput = getPathwayStopSelectionInput(args);
    if (!stopInput) throw stationError;
    const stop = await resolveStopDetail(ds.dbPath, stopInput);
    if (stop.locationType === "Station") {
      st = { stopId: stop.stopId, stopName: stop.stopName };
    } else if (stop.parentStation) {
      st = { stopId: stop.parentStation };
      nodeValue = stop.stopId;
    } else {
      if (wantsDataOutput(args.flags)) {
        const rows = await queryRows(
          ds.dbPath,
          `SELECT * FROM StopsView WHERE stop_id = ${sqlString(stop.stopId)}`,
        );
        printResult(
          {
            stopId: stop.stopId,
            stopName: stop.stopName,
            columns: rows.length > 0 ? Object.keys(rows[0]) : [],
            rows,
          },
          args.flags,
        );
        return;
      }
      await openDashboardView(stopsViewForRoute(getRouteFlag(args)), {
        ...dashboardParamsFromFlags(args),
        cliSelectedStop: stop.stopId,
        selectedStopId: stop.stopId,
      });
      return;
    }
  }

  const nodeInput = getNodeSelectionInput(args.flags);
  if (nodeInput && !nodeValue) {
    nodeValue = (await resolveStationNode(ds.dbPath, st.stopId, nodeInput)).stopId;
  }
  if (wantsDataOutput(args.flags)) {
    const filter = nodeValue
      ? ` WHERE from_stop_id = ${sqlString(nodeValue)} OR to_stop_id = ${sqlString(nodeValue)}`
      : "";
    const rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM get_station_pathways(${sqlString(st.stopId)})${filter}`,
    );
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }
  const params: Record<string, string> = {
    ...dashboardParamsFromFlags(args),
    cliSelectedStation: st.stopId,
    selectedStationId: st.stopId,
  };
  if (nodeValue) {
    params.cliSelectedNode = nodeValue;
    params.selectedNodeId = nodeValue;
  }
  await openDashboardView(pathwayViewForRoute(getRouteFlag(args)), params);
};

const commandEditPathway = async (args: Args) => {
  ensureOutputMode(args);
  const st = await resolveStationFromArgs(args);
  const nodeInput = getNodeSelectionInput(args.flags);
  const ds = await readDatasetState();
  let nodeValue: string | undefined;
  if (nodeInput) {
    nodeValue = (await resolveStationNode(ds.dbPath, st.stopId, nodeInput)).stopId;
  }
  if (wantsDataOutput(args.flags)) {
    const filter = nodeValue
      ? ` WHERE from_stop_id = ${sqlString(nodeValue)} OR to_stop_id = ${sqlString(nodeValue)}`
      : "";
    const rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM get_station_pathways(${sqlString(st.stopId)})${filter}`,
    );
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }
  const params: Record<string, string> = {
    ...dashboardParamsFromFlags(args),
    cliSelectedStation: st.stopId,
    selectedStationId: st.stopId,
    editTarget: "pathway",
  };
  if (nodeValue) {
    params.cliSelectedNode = nodeValue;
    params.selectedNodeId = nodeValue;
  }
  await openDashboardView(pathwayViewForRoute(getRouteFlag(args)), params);
};

const commandEditStop = async (args: Args) => {
  ensureOutputMode(args);
  const ds = await readDatasetState();
  let st: { stopId: string; stopName?: string };
  let nodeValue: string | undefined;

  try {
    st = await resolveStationFromArgs(args);
  } catch (stationError) {
    const stopInput = getPathwayStopSelectionInput(args);
    if (!stopInput) throw stationError;
    const stop = await resolveStopDetail(ds.dbPath, stopInput);
    if (stop.locationType === "Station") {
      st = { stopId: stop.stopId, stopName: stop.stopName };
    } else if (stop.parentStation) {
      st = { stopId: stop.parentStation };
      nodeValue = stop.stopId;
    } else {
      if (wantsDataOutput(args.flags)) {
        const rows = await queryRows(
          ds.dbPath,
          `SELECT * FROM StopsView WHERE stop_id = ${sqlString(stop.stopId)}`,
        );
        printResult(
          {
            stopId: stop.stopId,
            stopName: stop.stopName,
            columns: rows.length > 0 ? Object.keys(rows[0]) : [],
            rows,
          },
          args.flags,
        );
        return;
      }
      await openDashboardView(stopsViewForRoute(getRouteFlag(args)), {
        ...dashboardParamsFromFlags(args),
        cliSelectedStop: stop.stopId,
        selectedStopId: stop.stopId,
        editTarget: "node",
      });
      return;
    }
  }

  const nodeInput = getNodeSelectionInput(args.flags);
  if (nodeInput && !nodeValue) {
    nodeValue = (await resolveStationNode(ds.dbPath, st.stopId, nodeInput)).stopId;
  }
  if (wantsDataOutput(args.flags)) {
    const rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM get_station_stops(${sqlString(st.stopId)})`,
    );
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }
  const params: Record<string, string> = {
    ...dashboardParamsFromFlags(args),
    cliSelectedStation: st.stopId,
    selectedStationId: st.stopId,
    editTarget: "node",
  };
  if (nodeValue) {
    params.cliSelectedNode = nodeValue;
    params.selectedNodeId = nodeValue;
  }
  await openDashboardView(pathwayViewForRoute(getRouteFlag(args)), params);
};

const commandEditTable = async (args: Args) => {
  const table = args.positionals[0] || getFlagString(args.flags, "table");
  const ds = await readDatasetState();
  if (table === "pathways" || table === "pathway" || table === "EditPathwayTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditPathwayTable");
    printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
  } else if (table === "stops" || table === "stop" || table === "EditStopTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditStopTable");
    printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
  } else if (!table) {
    console.log("EditPathwayTable:");
    const pathwayRows = await queryRows(ds.dbPath, "SELECT * FROM EditPathwayTable");
    printResult(
      {
        columns: pathwayRows.length > 0 ? Object.keys(pathwayRows[0]) : [],
        rows: pathwayRows,
      },
      args.flags,
    );
    console.log("\nEditStopTable:");
    const stopRows = await queryRows(ds.dbPath, "SELECT * FROM EditStopTable");
    printResult(
      {
        columns: stopRows.length > 0 ? Object.keys(stopRows[0]) : [],
        rows: stopRows,
      },
      args.flags,
    );
  } else {
    throw new Error("edit_table accepts: pathways, stops, or no argument for both");
  }
};

const commandAddConnection = async (args: Args) => {
  const ds = await readDatasetState();
  const from = getFlagString(args.flags, "from") || getFlagString(args.flags, "from-stop-id");
  const to = getFlagString(args.flags, "to") || getFlagString(args.flags, "to-stop-id");
  if (!from || !to) throw new Error("Provide --from <stop_id> and --to <stop_id>");
  const mode = Number(getFlagString(args.flags, "pathway-mode") || "1");
  const bidir = hasFlag(args.flags, "bidirectional") ? 1 : 0;
  const time = getFlagString(args.flags, "traversal-time");
  const len = getFlagString(args.flags, "length");
  const stairs = getFlagString(args.flags, "stair-count");
  const slope = getFlagString(args.flags, "max-slope");
  const width = getFlagString(args.flags, "min-width");
  const sign = getFlagString(args.flags, "signposted-as");
  const revSign = getFlagString(args.flags, "reversed-signposted-as");
  const pathwayId =
    getFlagString(args.flags, "pathway-id") || `pathway_cli_${Date.now()}`;

  const [row] = await queryRows(
    ds.dbPath,
    `SELECT COALESCE(MAX(row_id), 0) + 1 AS next_id FROM (SELECT row_id FROM pathways UNION ALL SELECT row_id FROM EditPathwayTable) combined`,
  );
  const rowId = Number(row?.next_id || 1);

  const sqlVal = (v: string | undefined) =>
    v !== undefined ? (Number.isFinite(Number(v)) ? v : sqlString(v)) : "NULL";

  await executeRows(
    ds.dbPath,
    `INSERT INTO EditPathwayTable (row_id, pathway_id, from_stop_id, to_stop_id, pathway_mode, is_bidirectional, traversal_time, length, stair_count, max_slope, min_width, signposted_as, reversed_signposted_as, status)
     VALUES (${rowId}, ${sqlString(pathwayId)}, ${sqlString(from)}, ${sqlString(to)}, ${mode}, ${bidir}, ${sqlVal(time)}, ${sqlVal(len)}, ${sqlVal(stairs)}, ${sqlVal(slope)}, ${sqlVal(width)}, ${sqlVal(sign)}, ${sqlVal(revSign)}, 'new')`,
  );
  await refreshPathwayNetwork(ds.dbPath);
  console.log(`Added connection ${pathwayId}: ${from} -> ${to}`);
};

const commandUpdateConnection = async (args: Args) => {
  const ds = await readDatasetState();
  const pathwayId = getFlagString(args.flags, "pathway-id");
  if (!pathwayId) throw new Error("Provide --pathway-id to identify the connection");

  const [current] = await queryRows(
    ds.dbPath,
    `SELECT * FROM PathwaysView WHERE pathway_id = ${sqlString(pathwayId)}`,
  );
  if (!current) throw new Error(`No connection found with pathway_id: ${pathwayId}`);

  const val = (flag: string, fallback: unknown) => {
    const v = getFlagString(args.flags, flag);
    if (v === undefined) return fallback;
    return Number.isFinite(Number(v)) ? Number(v) : v;
  };
  const sqlV = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    return sqlString(String(v));
  };

  const row = {
    row_id: current.row_id,
    pathway_id: pathwayId,
    from_stop_id: val("from", current.from_stop_id),
    to_stop_id: val("to", current.to_stop_id),
    pathway_mode: val("pathway-mode", current.pathway_mode),
    is_bidirectional: hasFlag(args.flags, "bidirectional")
      ? 1
      : val("is-bidirectional", current.is_bidirectional),
    traversal_time: val("traversal-time", current.traversal_time),
    length: val("length", current.length),
    stair_count: val("stair-count", current.stair_count),
    max_slope: val("max-slope", current.max_slope),
    min_width: val("min-width", current.min_width),
    signposted_as: val("signposted-as", current.signposted_as),
    reversed_signposted_as: val("reversed-signposted-as", current.reversed_signposted_as),
  };

  const status = String(current.status || "");
  if (status === "" || status === "edit") {
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditPathwayTable WHERE pathway_id = ${sqlString(pathwayId)};
       INSERT INTO EditPathwayTable (row_id, pathway_id, from_stop_id, to_stop_id, pathway_mode, is_bidirectional, traversal_time, length, stair_count, max_slope, min_width, signposted_as, reversed_signposted_as, status)
       VALUES (${sqlV(row.row_id)}, ${sqlV(row.pathway_id)}, ${sqlV(row.from_stop_id)}, ${sqlV(row.to_stop_id)}, ${sqlV(row.pathway_mode)}, ${sqlV(row.is_bidirectional)}, ${sqlV(row.traversal_time)}, ${sqlV(row.length)}, ${sqlV(row.stair_count)}, ${sqlV(row.max_slope)}, ${sqlV(row.min_width)}, ${sqlV(row.signposted_as)}, ${sqlV(row.reversed_signposted_as)}, 'edit')`,
    );
  } else {
    const newStatus = status === "new" || status === "new edit" ? "new edit" : status;
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditPathwayTable WHERE row_id = ${sqlV(row.row_id)};
       INSERT INTO EditPathwayTable (row_id, pathway_id, from_stop_id, to_stop_id, pathway_mode, is_bidirectional, traversal_time, length, stair_count, max_slope, min_width, signposted_as, reversed_signposted_as, status)
      VALUES (${sqlV(row.row_id)}, ${sqlV(row.pathway_id)}, ${sqlV(row.from_stop_id)}, ${sqlV(row.to_stop_id)}, ${sqlV(row.pathway_mode)}, ${sqlV(row.is_bidirectional)}, ${sqlV(row.traversal_time)}, ${sqlV(row.length)}, ${sqlV(row.stair_count)}, ${sqlV(row.max_slope)}, ${sqlV(row.min_width)}, ${sqlV(row.signposted_as)}, ${sqlV(row.reversed_signposted_as)}, ${sqlV(newStatus)})`,
    );
  }
  await refreshPathwayNetwork(ds.dbPath);
  console.log(`Updated connection ${pathwayId}`);
};

const commandDeleteConnection = async (args: Args) => {
  const ds = await readDatasetState();
  const pathwayId = getFlagString(args.flags, "pathway-id");
  if (!pathwayId) throw new Error("Provide --pathway-id to identify the connection");

  const [current] = await queryRows(
    ds.dbPath,
    `SELECT * FROM PathwaysView WHERE pathway_id = ${sqlString(pathwayId)}`,
  );
  if (!current) throw new Error(`No connection found with pathway_id: ${pathwayId}`);

  const status = String(current.status || "");
  const sqlV = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    return sqlString(String(v));
  };

  if (status === "new" || status === "new edit") {
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditPathwayTable WHERE pathway_id = ${sqlString(pathwayId)}`,
    );
  } else {
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditPathwayTable WHERE pathway_id = ${sqlString(pathwayId)};
       INSERT INTO EditPathwayTable (row_id, pathway_id, from_stop_id, to_stop_id, pathway_mode, is_bidirectional, traversal_time, length, stair_count, max_slope, min_width, signposted_as, reversed_signposted_as, status)
      VALUES (${sqlV(current.row_id)}, ${sqlV(current.pathway_id)}, ${sqlV(current.from_stop_id)}, ${sqlV(current.to_stop_id)}, ${sqlV(current.pathway_mode)}, ${sqlV(current.is_bidirectional)}, ${sqlV(current.traversal_time)}, ${sqlV(current.length)}, ${sqlV(current.stair_count)}, ${sqlV(current.max_slope)}, ${sqlV(current.min_width)}, ${sqlV(current.signposted_as)}, ${sqlV(current.reversed_signposted_as)}, 'deleted')`,
    );
  }
  await refreshPathwayNetwork(ds.dbPath);
  console.log(`Deleted connection ${pathwayId}`);
};

const commandAddNode = async (args: Args) => {
  const ds = await readDatasetState();
  const stopId = getFlagString(args.flags, "stop-id") || getFlagString(args.flags, "id");
  if (!stopId) throw new Error("Provide --stop-id for the new node");
  const stopName = getFlagString(args.flags, "stop-name") || getFlagString(args.flags, "name") || stopId;
  const lat = getFlagString(args.flags, "lat");
  const lon = getFlagString(args.flags, "lon");
  if (!lat || !lon) throw new Error("Provide --lat and --lon");
  const locationType = getFlagString(args.flags, "location-type") || "Generic Node";
  const parentStation = getFlagString(args.flags, "parent-station");
  const levelId = getFlagString(args.flags, "level-id");
  const wheelchair = getFlagString(args.flags, "wheelchair");
  const rowId = `edit_${stopId}`;

  const sqlV = (v: string | undefined) => (v !== undefined ? sqlString(v) : "NULL");

  await executeRows(
    ds.dbPath,
    `INSERT INTO EditStopTable (row_id, stop_id, stop_name, stop_lat, stop_lon, location_type_name, parent_station, level_id, wheelchair_status, status)
     VALUES (${sqlString(rowId)}, ${sqlString(stopId)}, ${sqlString(stopName)}, ${lat}, ${lon}, ${sqlString(locationType)}, ${sqlV(parentStation)}, ${sqlV(levelId)}, ${sqlV(wheelchair)}, 'new')`,
  );
  await refreshPathwayNetwork(ds.dbPath);
  console.log(`Added node ${stopId} (${locationType})`);
};

const commandUpdateNode = async (args: Args) => {
  const ds = await readDatasetState();
  const stopId = getFlagString(args.flags, "stop-id") || getFlagString(args.flags, "id");
  if (!stopId) throw new Error("Provide --stop-id to identify the node");

  const [current] = await queryRows(
    ds.dbPath,
    `SELECT * FROM StopsView WHERE stop_id = ${sqlString(stopId)}`,
  );
  if (!current) throw new Error(`No node found with stop_id: ${stopId}`);

  const val = (flag: string, fallback: unknown) => {
    const v = getFlagString(args.flags, flag);
    return v !== undefined ? v : fallback;
  };
  const sqlV = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    return sqlString(String(v));
  };

  const row = {
    row_id: current.row_id,
    stop_id: stopId,
    stop_name: val("stop-name", null) ?? val("name", current.stop_name),
    stop_lat: val("lat", current.stop_lat),
    stop_lon: val("lon", current.stop_lon),
    location_type_name: val("location-type", current.location_type_name),
    parent_station: val("parent-station", current.parent_station),
    level_id: val("level-id", current.level_id),
    wheelchair_status: val("wheelchair", current.wheelchair_status),
  };

  const status = String(current.status || "");
  if (status === "" || status === "edit") {
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditStopTable WHERE stop_id = ${sqlString(stopId)};
       INSERT INTO EditStopTable (row_id, stop_id, stop_name, stop_lat, stop_lon, location_type_name, parent_station, level_id, wheelchair_status, status)
       VALUES (${sqlV(row.row_id)}, ${sqlV(row.stop_id)}, ${sqlV(row.stop_name)}, ${sqlV(row.stop_lat)}, ${sqlV(row.stop_lon)}, ${sqlV(row.location_type_name)}, ${sqlV(row.parent_station)}, ${sqlV(row.level_id)}, ${sqlV(row.wheelchair_status)}, 'edit')`,
    );
  } else {
    const newStatus = status === "new" || status === "new edit" ? "new edit" : status;
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditStopTable WHERE row_id = ${sqlV(row.row_id)};
       INSERT INTO EditStopTable (row_id, stop_id, stop_name, stop_lat, stop_lon, location_type_name, parent_station, level_id, wheelchair_status, status)
      VALUES (${sqlV(row.row_id)}, ${sqlV(row.stop_id)}, ${sqlV(row.stop_name)}, ${sqlV(row.stop_lat)}, ${sqlV(row.stop_lon)}, ${sqlV(row.location_type_name)}, ${sqlV(row.parent_station)}, ${sqlV(row.level_id)}, ${sqlV(row.wheelchair_status)}, ${sqlV(newStatus)})`,
    );
  }
  await refreshPathwayNetwork(ds.dbPath);
  console.log(`Updated node ${stopId}`);
};

const commandDeleteNode = async (args: Args) => {
  const ds = await readDatasetState();
  const stopId = getFlagString(args.flags, "stop-id") || getFlagString(args.flags, "id");
  if (!stopId) throw new Error("Provide --stop-id to identify the node");

  const [current] = await queryRows(
    ds.dbPath,
    `SELECT * FROM StopsView WHERE stop_id = ${sqlString(stopId)}`,
  );
  if (!current) throw new Error(`No node found with stop_id: ${stopId}`);

  const status = String(current.status || "");
  const sqlV = (v: unknown) => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    return sqlString(String(v));
  };

  if (status === "new" || status === "new edit") {
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditStopTable WHERE stop_id = ${sqlString(stopId)}`,
    );
  } else {
    await executeRows(
      ds.dbPath,
      `DELETE FROM EditStopTable WHERE stop_id = ${sqlString(stopId)};
       INSERT INTO EditStopTable (row_id, stop_id, stop_name, stop_lat, stop_lon, location_type_name, parent_station, level_id, wheelchair_status, status)
      VALUES (${sqlV(current.row_id)}, ${sqlV(current.stop_id)}, ${sqlV(current.stop_name)}, ${sqlV(current.stop_lat)}, ${sqlV(current.stop_lon)}, ${sqlV(current.location_type_name)}, ${sqlV(current.parent_station)}, ${sqlV(current.level_id)}, ${sqlV(current.wheelchair_status)}, 'deleted')`,
    );
  }
  await refreshPathwayNetwork(ds.dbPath);
  console.log(`Deleted node ${stopId}`);
};

const commandStationRoutes = async (args: Args) => {
  ensureOutputMode(args);
  const st = await resolveStationFromArgs(args);
  const ds = await readDatasetState();
  const nodeInput = getNodeSelectionInput(args.flags);
  let nodeValue: string | undefined;
  if (nodeInput) {
    nodeValue = (await resolveStationNode(ds.dbPath, st.stopId, nodeInput)).stopId;
  }
  const timeInterval = getFlagString(args.flags, "time-interval");
  const connectionType = getFlagString(args.flags, "connection-type");

  if (wantsDataOutput(args.flags)) {
    let sql = `SELECT * FROM get_station_routes(${sqlString(st.stopId)})`;
    const filters: string[] = [];
    if (nodeValue) {
      filters.push(`(start_stop = ${sqlString(nodeValue)} OR end_stop = ${sqlString(nodeValue)})`);
    }
    if (connectionType) {
      filters.push(
        `(from_location_type_name = ${sqlString(connectionType)} OR to_location_type_name = ${sqlString(connectionType)})`,
      );
    }
    const timeFilter = timeIntervalCondition(timeInterval, "shortest_time");
    if (timeFilter) filters.push(timeFilter);
    if (filters.length > 0) {
      sql = `SELECT * FROM (${sql}) sub WHERE ${filters.join(" AND ")}`;
    }
    const rows = await queryRows(ds.dbPath, sql);
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }
  const params: Record<string, string> = {
    ...dashboardParamsFromFlags(args),
    cliSelectedStation: st.stopId,
    selectedStationId: st.stopId,
  };
  if (nodeValue) {
    params.cliSelectedNode = nodeValue;
    params.selectedNodeId = nodeValue;
  }
  await openDashboardView(pathwayViewForRoute(getRouteFlag(args)), params);
};

const commandStationShortestRoute = async (args: Args) => {
  ensureOutputMode(args);
  const st = await resolveStationFromArgs(args);
  const ds = await readDatasetState();

  const rows = await queryRows(
    ds.dbPath,
    `
    SELECT *
    FROM get_station_routes(${sqlString(st.stopId)})
    WHERE shortest_time IS NOT NULL
      AND from_location_type_name = ${sqlString("Exit/Entrance")}
      AND to_location_type_name = ${sqlString("Exit/Entrance")}
    ORDER BY shortest_time, start_stop, end_stop
    LIMIT 1`,
  );

  if (wantsDataOutput(args.flags)) {
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }

  const route = rows[0];
  const fromStop = route?.start_stop == null ? undefined : String(route.start_stop);
  const toStop = route?.end_stop == null ? undefined : String(route.end_stop);
  if (!fromStop || !toStop) return;

  await openDashboardView(pathwayViewForRoute(getRouteFlag(args)), {
    ...dashboardParamsFromFlags(args),
    cliSelectedStation: st.stopId,
    selectedStationId: st.stopId,
    cliFromStop: fromStop,
    cliToStop: toStop,
    fromStop,
    toStop,
  });
};

const commandStopInfo = async (args: Args) => {
  ensureOutputMode(args);
  const st = await resolveStopFromArgs(args) as { stopId: string; stopName?: string; stopLat?: number; stopLon?: number };
  if (wantsDataOutput(args.flags)) {
    const ds = await readDatasetState();
    const rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM StopsTable WHERE stop_id = ${sqlString(st.stopId)}`,
    );
    printResult(
      {
        stopId: st.stopId,
        stopName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      },
      args.flags,
    );
    return;
  }
  const params: Record<string, string> = {
    ...dashboardParamsFromFlags(args),
    cliSelectedStop: st.stopId,
    selectedStopId: st.stopId,
  };
  if (st.stopLat != null && st.stopLon != null) {
    params.mapFocus = `${st.stopLat},${st.stopLon},16`;
  }
  await openDashboardView(stopsViewForRoute(getRouteFlag(args)), params);
};

const commandView = async (args: Args) => {
  let view = getRouteFlag(args) || "auto";
  if (!supportedViews.has(view)) throw new Error(`Unsupported view: ${view}`);
  const params = dashboardParamsFromFlags(args);

  const stationInput = getStationSelectionInput(args.flags);
  const stopInput = getStopSelectionInput(args.flags);
  if (view === "auto" && stationInput) view = "stations/info";
  if (view === "auto" && stopInput) view = "stops/map";

  if (stationInput) {
    const ds = await readDatasetState();
    const st = await resolveSelection(ds.dbPath, "StationsTable", stationInput);
    params.cliSelectedStation = st.stopId;
    params.selectedStationId = st.stopId;
  }
  if (stopInput) {
    const ds = await readDatasetState();
    const st = await resolveSelection(ds.dbPath, "StopsTable", stopInput);
    params.cliSelectedStop = st.stopId;
    params.selectedStopId = st.stopId;
  }

  await openDashboardView(view, params);
};

const commandSkillPath = () => {
  console.log(path.join(packageRoot, "skills", "gtfs-viz", "SKILL.md"));
};

type SkillAgent = "claude" | "codex" | "opensource";

const normalizeSkillAgent = (value: string): SkillAgent => {
  const n = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (n === "claude" || n === "claude-code") return "claude";
  if (n === "codex") return "codex";
  if (n === "opensource" || n === "open-source" || n === "opencode" || n === "open-code")
    return "opensource";
  throw new Error("Choose --agent claude, --agent codex, or --agent opensource");
};

const defaultSkillRoot = (agent: SkillAgent) => {
  if (agent === "claude")
    return path.join(process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude"), "skills");
  if (agent === "codex")
    return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills");
  return path.join(os.homedir(), ".skills");
};

const commandInstallSkill = async (args: Args) => {
  const agentFlag = getFlagString(args.flags, "agent");
  let agent: SkillAgent | undefined;

  if (agentFlag) {
    agent = normalizeSkillAgent(agentFlag);
  } else if (!processStdin.isTTY) {
    throw new Error(
      "Pass --agent claude, --agent codex, or --agent opensource in non-interactive shells",
    );
  } else {
    const rl = readline.createInterface({
      input: processStdin,
      output: processStdout,
    });
    console.log("\nInstall GTFS Viz skill for:");
    console.log("  1. Claude Code (~/.claude/skills)");
    console.log("  2. Codex (~/.codex/skills)");
    console.log("  3. Open source (~/.skills)");
    const answer = await new Promise<string>((r) => rl.question("Choose 1-3: ", r));
    rl.close();
    if (answer.trim() === "1") agent = "claude";
    else if (answer.trim() === "2") agent = "codex";
    else if (answer.trim() === "3") agent = "opensource";
    else agent = normalizeSkillAgent(answer);
  }

  const targetRoot =
    getFlagString(args.flags, "target-dir") ||
    getFlagString(args.flags, "target") ||
    defaultSkillRoot(agent || "opensource");
  const sourceDir = path.join(packageRoot, "skills", "gtfs-viz");
  const targetDir = path.join(targetRoot, "gtfs-viz");
  const force = hasFlag(args.flags, "force");

  if (existsSync(targetDir) && !force)
    throw new Error(`${targetDir} already exists. Rerun with --force to replace it.`);
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetRoot, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`Installed GTFS Viz skill to ${targetDir}`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "__daemon__") {
    await runDaemon();
    return;
  }

  if (hasFlag(args.flags, "help") || args.command === "help") {
    if (args.command && args.command !== "help" && printCommandHelp(args.command)) {
      return;
    }
    const helpTarget = args.command === "help" ? args.positionals[0] : undefined;
    if (helpTarget && printCommandHelp(helpTarget)) {
      return;
    }
    printHelp();
    return;
  }
  if (args.command === "examples") {
    printExamples();
    return;
  }
  if (hasFlag(args.flags, "json"))
    throw new Error("--json is not supported. Use --format json for structured terminal output.");

  if (args.command === "import") {
    await commandImport(args);
    return;
  }
  if (args.command === "status") {
    await commandStatus();
    return;
  }
  if (args.command === "stop") {
    await commandStopSession();
    return;
  }
  if (args.command === "restart") {
    await commandRestartSession();
    return;
  }
  if (args.command === "clean") {
    await commandClean();
    return;
  }
  if (args.command === "tables") {
    await commandTables(args);
    return;
  }
  if (args.command === "stations") {
    await commandStations(args);
    return;
  }
  if (args.command === "stops") {
    await commandStops(args);
    return;
  }
  if (args.command === "skill-path") {
    commandSkillPath();
    return;
  }
  if (args.command === "install-skill" || args.command === "skills:install") {
    await commandInstallSkill(args);
    return;
  }
  if (args.command === "export") {
    await commandExport(args);
    return;
  }
  if (args.command === "query") {
    await commandQuery(args);
    return;
  }

  if (args.command === "station") {
    await commandStation(args);
    return;
  }
  if (args.command === "stop-info" || args.command === "stop_info") {
    await commandStopInfo(args);
    return;
  }
  if (args.command === "station_connections" || args.command === "station-connections") {
    await commandStationConnections(args);
    return;
  }
  if (
    args.command === "station_pathways" ||
    args.command === "station-pathways" ||
    args.command === "pathways"
  ) {
    await commandStationPathways(args);
    return;
  }
  if (args.command === "edit_pathway" || args.command === "edit-pathway") {
    await commandEditPathway(args);
    return;
  }
  if (args.command === "edit_stop" || args.command === "edit-stop") {
    await commandEditStop(args);
    return;
  }
  if (args.command === "edit_table" || args.command === "edit-table") {
    await commandEditTable(args);
    return;
  }
  if (args.command === "add_connection" || args.command === "add-connection") {
    await commandAddConnection(args);
    return;
  }
  if (args.command === "update_connection" || args.command === "update-connection") {
    await commandUpdateConnection(args);
    return;
  }
  if (args.command === "delete_connection" || args.command === "delete-connection") {
    await commandDeleteConnection(args);
    return;
  }
  if (args.command === "add_node" || args.command === "add-node") {
    await commandAddNode(args);
    return;
  }
  if (args.command === "update_node" || args.command === "update-node") {
    await commandUpdateNode(args);
    return;
  }
  if (args.command === "delete_node" || args.command === "delete-node") {
    await commandDeleteNode(args);
    return;
  }
  if (
    args.command === "station_routes" ||
    args.command === "station-routes" ||
    args.command === "routes"
  ) {
    await commandStationRoutes(args);
    return;
  }
  if (
    args.command === "station_shortest_route" ||
    args.command === "station-shortest-route" ||
    args.command === "shortest-route"
  ) {
    await commandStationShortestRoute(args);
    return;
  }
  if (args.command === "view" || args.command === "open" || args.command === "dashboard") {
    await commandView(args);
    return;
  }

  if (!args.command) {
    if (Object.keys(args.flags).length === 0) {
      const daemon = await isDaemonRunning();
      if (daemon) {
        console.log(`Session: port ${daemon.port}`);
        console.log(`Dataset: ${daemon.datasetFile}`);
        console.log(`Dashboard: http://127.0.0.1:${daemon.port}`);
        return;
      }
      printHelp();
      return;
    }
    await commandView(args);
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
