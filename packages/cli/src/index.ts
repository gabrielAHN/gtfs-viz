import { createWriteStream, existsSync } from "node:fs";
import { access, copyFile, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { fileURLToPath } from "node:url";

import { dashboardViewForNamedQuery, sqlForNamedQuery } from "@gtfs-viz/duckdb-extension";

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
  "routes/info",
  "routes/map",
  "routes/service",
  "routes/table",
  "routes/trips",
  "trips/table",
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
       ),
       route_counts AS (
         SELECT
           COUNT(DISTINCT rsv.route_id) AS route_count,
           STRING_AGG(DISTINCT rsv.route_id || '|||' || rsv.route_name || '|||' || rsv.route_color_hex || '|||' || rsv.route_text_color_hex, '\n') AS route_links
         FROM RouteStopsView rsv
         WHERE rsv.station_id = station_id
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
         COALESCE(rc.route_count, 0) AS route_count,
         COALESCE(rc.route_links, '') AS route_links,
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
       CROSS JOIN route_counts rc
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
  const routesEntry = findGtfsEntry(entries, "routes.txt");
  const tripsEntry = findGtfsEntry(entries, "trips.txt");
  const stopTimesEntry = findGtfsEntry(entries, "stop_times.txt");
  const shapesEntry = findGtfsEntry(entries, "shapes.txt");
  const calendarEntry = findGtfsEntry(entries, "calendar.txt");
  const calendarDatesEntry = findGtfsEntry(entries, "calendar_dates.txt");
  if (!stopsEntry) throw new Error("GTFS zip is missing required stops.txt");

  await rm(currentDataDir, { recursive: true, force: true });
  await mkdir(currentExtractDir, { recursive: true });
  await copyFile(feedPath, currentFeedPath);

  const stopsPath = path.join(currentExtractDir, "stops.txt");
  const pathwaysPath = pathwaysEntry ? path.join(currentExtractDir, "pathways.txt") : undefined;
  const routesPath = routesEntry ? path.join(currentExtractDir, "routes.txt") : undefined;
  const tripsPath = tripsEntry ? path.join(currentExtractDir, "trips.txt") : undefined;
  const stopTimesPath = stopTimesEntry ? path.join(currentExtractDir, "stop_times.txt") : undefined;
  const shapesPath = shapesEntry ? path.join(currentExtractDir, "shapes.txt") : undefined;
  const calendarPath = calendarEntry ? path.join(currentExtractDir, "calendar.txt") : undefined;
  const calendarDatesPath = calendarDatesEntry
    ? path.join(currentExtractDir, "calendar_dates.txt")
    : undefined;
  await extractZipEntry(feedPath, stopsEntry, stopsPath);
  if (pathwaysEntry && pathwaysPath) await extractZipEntry(feedPath, pathwaysEntry, pathwaysPath);
  if (routesEntry && routesPath) await extractZipEntry(feedPath, routesEntry, routesPath);
  if (tripsEntry && tripsPath) await extractZipEntry(feedPath, tripsEntry, tripsPath);
  if (stopTimesEntry && stopTimesPath)
    await extractZipEntry(feedPath, stopTimesEntry, stopTimesPath);
  if (shapesEntry && shapesPath) await extractZipEntry(feedPath, shapesEntry, shapesPath);
  if (calendarEntry && calendarPath) await extractZipEntry(feedPath, calendarEntry, calendarPath);
  if (calendarDatesEntry && calendarDatesPath)
    await extractZipEntry(feedPath, calendarDatesEntry, calendarDatesPath);

  const importSqlContent = await buildImportSql({
    stopsPath,
    pathwaysPath,
    routesPath,
    tripsPath,
    stopTimesPath,
    shapesPath,
    calendarPath,
    calendarDatesPath,
  });
  const importSqlPath = path.join(currentDataDir, "import.sql");
  await writeFile(importSqlPath, importSqlContent);
  await executeSqlFile(currentDbPath, importSqlPath);

  const [counts] = await queryRows(
    currentDbPath,
    `SELECT (SELECT COUNT(*) FROM StopsTable) AS stops, (SELECT COUNT(*) FROM StationsTable) AS stations, (SELECT COUNT(*) FROM pathways) AS pathways, (SELECT COUNT(*) FROM RoutesTable) AS routes`,
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
      routes: Number(counts?.routes || 0),
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
    body: JSON.stringify({ url: targetUrl, sessionId: daemon.sessionId }),
  });
}

let _urlOnlyMode = false;

async function openDashboardView(
  view: string,
  params: Record<string, string>,
): Promise<void> {
  const { daemon, fresh } = await ensureDaemon();
  const url = buildDashboardUrl(`http://127.0.0.1:${daemon.port}`, daemon.sessionId, view, params);

  if (!_urlOnlyMode) {
    if (fresh) {
      openBrowser(url);
    } else {
      await navigateDaemon(daemon, url);
    }
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
  const positional = args.positionals.filter((p) => !VIEW_NAMES.has(p)).join(" ").trim();
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

async function resolveStopFromArgs(args: Args): Promise<{ stopId: string; stopName?: string; stopLat?: number; stopLon?: number }> {
  const positional = args.positionals.filter((p) => !VIEW_NAMES.has(p)).join(" ").trim();
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
  try {
    return await resolveSelection(ds.dbPath, "StopsTable", si);
  } catch {
    // Fall back to StationsTable so station names (e.g. "Alewife") also resolve
    return resolveSelection(ds.dbPath, "StationsTable", si);
  }
}

const getServiceRouteSelectionInput = (flags: Record<string, string | boolean>) =>
  getSelectionInput(flags, [
    ["route-id", "id"],
    ["route-name", "name"],
    ["selected-route", "any"],
  ]);

const routeSelectionExpressions = (input: SelectionInput) => {
  const value = sqlString(input.value);
  const iId = input.mode !== "name";
  const iNm = input.mode !== "id";
  return {
    idE: iId ? `route_id = ${value}` : "FALSE",
    idL: iId ? `LOWER(route_id) = LOWER(${value})` : "FALSE",
    nmE: iNm
      ? `(route_name = ${value} OR route_short_name = ${value} OR route_long_name = ${value})`
      : "FALSE",
    nmL: iNm
      ? `(LOWER(route_name) = LOWER(${value}) OR LOWER(route_short_name) = LOWER(${value}) OR LOWER(route_long_name) = LOWER(${value}))`
      : "FALSE",
    idC: iId ? `LOWER(route_id) LIKE '%' || LOWER(${value}) || '%'` : "FALSE",
    nmC: iNm
      ? `(LOWER(route_name) LIKE '%' || LOWER(${value}) || '%' OR LOWER(route_short_name) LIKE '%' || LOWER(${value}) || '%' OR LOWER(route_long_name) LIKE '%' || LOWER(${value}) || '%')`
      : "FALSE",
  };
};

const resolveServiceRouteSelection = async (dbPath: string, input: SelectionInput) => {
  const { idE, idL, nmE, nmL, idC, nmC } = routeSelectionExpressions(input);
  const rows = await queryRows(
    dbPath,
    `
    WITH c AS (SELECT route_id, route_name, route_short_name, route_long_name,
      CASE WHEN ${idE} THEN 1 WHEN ${idL} THEN 2 WHEN ${nmE} THEN 3 WHEN ${nmL} THEN 4 WHEN ${idC} THEN 5 WHEN ${nmC} THEN 6 ELSE NULL END AS r
      FROM RoutesTable WHERE ${idE} OR ${idL} OR ${nmE} OR ${nmL} OR ${idC} OR ${nmC}),
    b AS (SELECT * FROM c WHERE r = (SELECT MIN(r) FROM c))
    SELECT route_id, route_name, route_short_name, route_long_name FROM b ORDER BY route_name, route_id LIMIT 6`,
  );

  if (rows.length === 0) throw new Error(`No route matched "${input.value}" from --${input.flag}`);
  if (rows.length > 1) {
    const fmt = rows.map((r) => `${r.route_id} (${r.route_name || ""})`).join(", ");
    throw new Error(`Multiple routes matched: ${fmt}. Use --route-id with exact ID.`);
  }
  const row = rows[0];
  return {
    routeId: String(row.route_id),
    routeName: typeof row.route_name === "string" ? row.route_name : undefined,
  };
};

async function resolveServiceRouteFromArgs(
  args: Args,
): Promise<{ routeId: string; routeName?: string }> {
  const positional = args.positionals.filter((p) => !VIEW_NAMES.has(p)).join(" ").trim();
  const flags = { ...args.flags };
  const id = getFlagString(flags, "id") || getFlagString(flags, "route-id");
  const name = getFlagString(flags, "name") || getFlagString(flags, "route-name");
  const selected = getFlagString(flags, "selected-route") || positional || undefined;
  if (id) flags["route-id"] = id;
  else if (name) flags["route-name"] = name;
  else if (selected) flags["selected-route"] = selected;
  const input = getServiceRouteSelectionInput(flags);
  if (!input) throw new Error("Provide a route value");
  const ds = await readDatasetState();
  return resolveServiceRouteSelection(ds.dbPath, input);
}

const getPathwayStopSelectionInput = (args: Args) => {
  const positional = args.positionals.filter((p) => !VIEW_NAMES.has(p)).join(" ").trim();
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

const VIEW_NAMES = new Set([
  "map", "table", "info", "service", "trips", "flow", "radial",
  "directional", "start", "end",
]);

const getViewFlag = (args: Args) => {
  const explicit = getFlagString(args.flags, "view");
  if (explicit) return explicit;
  // Allow view name as positional: `routes --id R1 service`
  for (const p of args.positionals) {
    if (VIEW_NAMES.has(p)) return p;
  }
  // Infer service view from --service/--service-id/--trip/--trip-id/--compare flags
  if (
    getFlagString(args.flags, "service-id") || getFlagString(args.flags, "service") ||
    getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "trip") ||
    getFlagString(args.flags, "compare")
  ) {
    return "service";
  }
  return undefined;
};

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

const serviceRoutesViewForRoute = (route?: string, routeId?: string) => {
  // When a specific route ID is provided and no explicit view, show route info
  if (!route && routeId) return "routes/info";
  if (!route || route === "map" || route === "routes/map") return "routes/map";
  if (route === "table" || route === "routes/table") return "routes/table";
  if (route === "info" || route === "route-info") {
    if (!routeId) return "routes/map";
    return "routes/info";
  }
  if (
    route === "service" ||
    route === "route-service" ||
    route === "trips" ||
    route === "route-trips"
  ) {
    if (!routeId) return "routes/map";
    return "routes/service";
  }
  throw new Error("Routes route must be map, table, info, service, or trips");
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

const wantsUrlOnly = (args: Args) => hasFlag(args.flags, "url-only");

const wantsDashboardOutput = (args: Args) =>
  hasFlag(args.flags, "dashboard") ||
  hasFlag(args.flags, "open") ||
  hasFlag(args.flags, "url") ||
  hasFlag(args.flags, "url-only");


const dashboardParamsFromFlags = (args: Args) => {
  const params: Record<string, string> = {};
  const stationFilter = getFlagString(args.flags, "station-filter");
  const stopFilter = getFlagString(args.flags, "stop-filter");
  const routeFilter = getFlagString(args.flags, "route-filter");
  const mapFocus = getFlagString(args.flags, "map-focus");
  const selectedRoute =
    getFlagString(args.flags, "selected-route") || getFlagString(args.flags, "route-id");
  const selectedNode =
    getFlagString(args.flags, "selected-node") || getFlagString(args.flags, "node-id");
  if (stationFilter) params.cliStationFilter = stationFilter;
  if (stopFilter) params.cliStopFilter = stopFilter;
  if (routeFilter) params.cliRouteFilter = routeFilter;
  if (mapFocus) params.cliMapFocus = mapFocus;
  if (selectedRoute) {
    params.cliSelectedRoute = selectedRoute;
    params.selectedRouteId = selectedRoute;
  }
  if (selectedNode) {
    params.cliSelectedNode = selectedNode;
    params.selectedNodeId = selectedNode;
  }
  return params;
};

const ensureOutputMode = (args: Args) => {
  if (wantsDataOutput(args.flags) && wantsDashboardOutput(args)) {
    throw new Error(
      "Use either --data/--format for terminal output or --url/--dashboard for web output",
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
      `Stops: ${metadata.counts.stops}  Stations: ${metadata.counts.stations}  Pathways: ${metadata.counts.pathways}  Routes: ${metadata.counts.routes}`,
    );
    // Start session so dashboard is accessible without opening browser
    const daemon = await spawnDaemon();
    console.log(`Dashboard: ${daemon.dashboardUrl}`);
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
  const id = getFlagString(args.flags, "station-id") || getFlagString(args.flags, "id") || getPositionalId(args);
  if (wantsDataOutput(args.flags)) {
    const dataset = await readDatasetState();
    const filters: string[] = [];
    const name = getFlagString(args.flags, "station-name") || getFlagString(args.flags, "name");
    const wheelchair = getFlagString(args.flags, "wheelchair");
    const pathways =
      getFlagString(args.flags, "pathways-status") || getFlagString(args.flags, "pathways");
    if (id) filters.push(`stop_id = ${sqlString(id)}`);
    if (name) filters.push(`LOWER(stop_name) LIKE LOWER(${sqlString(`%${name}%`)})`);
    if (wheelchair) filters.push(`wheelchair_status = ${sqlString(wheelchair)}`);
    if (pathways) filters.push(`pathways_status = ${sqlString(pathways)}`);
    const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
    const rows = await queryRows(dataset.dbPath, `SELECT * FROM StationsTable${where}`);
    printOrNone(rows, args);
    return;
  }
  if (id) {
    const dataset = await readDatasetState();
    const rows = await queryRows(dataset.dbPath, `SELECT stop_id FROM StationsTable WHERE stop_id = ${sqlString(id)} LIMIT 1`);
    if (rows.length === 0) {
      console.log(`No station found with ID "${id}".`);
      return;
    }
  }
  const params = dashboardParamsFromFlags(args);
  if (id) {
    params.cliSelectedStation = id;
    params.selectedStationId = id;
  }
  await openDashboardView(stationsViewForRoute(getViewFlag(args)), params);
};

const commandStops = async (args: Args) => {
  ensureOutputMode(args);
  const id = getFlagString(args.flags, "stop-id") || getFlagString(args.flags, "id") || getPositionalId(args);
  if (wantsDataOutput(args.flags)) {
    const dataset = await readDatasetState();
    const filters: string[] = [];
    const name = getFlagString(args.flags, "stop-name") || getFlagString(args.flags, "name");
    const wheelchair = getFlagString(args.flags, "wheelchair");
    const locationType = getFlagString(args.flags, "location-type");
    if (id) filters.push(`stop_id = ${sqlString(id)}`);
    if (name) filters.push(`LOWER(stop_name) LIKE LOWER(${sqlString(`%${name}%`)})`);
    if (wheelchair) filters.push(`wheelchair_status = ${sqlString(wheelchair)}`);
    if (locationType) filters.push(`location_type_name = ${sqlString(locationType)}`);
    const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
    const rows = await queryRows(dataset.dbPath, `SELECT * FROM StopsTable${where}`);
    printOrNone(rows, args);
    return;
  }
  if (id) {
    const dataset = await readDatasetState();
    const rows = await queryRows(dataset.dbPath, `SELECT stop_id FROM StopsTable WHERE stop_id = ${sqlString(id)} LIMIT 1`);
    if (rows.length === 0) {
      console.log(`No stop found with ID "${id}".`);
      return;
    }
  }
  const params = dashboardParamsFromFlags(args);
  if (id) {
    params.cliSelectedStop = id;
    params.selectedStopId = id;
  }
  await openDashboardView(stopsViewForRoute(getViewFlag(args)), params);
};

const addRouteServiceParams = (args: Args, params: Record<string, string>) => {
  const serviceId = getFlagString(args.flags, "service-id") || getFlagString(args.flags, "service");
  const tripId = getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "trip");
  const compare = getFlagString(args.flags, "compare");
  if (serviceId) params.selectedServiceId = serviceId;
  if (compare) {
    const allIds = compare.split(",").map((s) => s.trim()).filter(Boolean);
    if (tripId && !allIds.includes(tripId)) allIds.unshift(tripId);
    params.compareTripIds = allIds.join(",");
  } else if (tripId) {
    params.selectedTripId = tripId;
  }
};

/** Verify --service and --trip exist for the given route before opening dashboard. Returns false if invalid. */
const verifyRouteServiceFlags = async (args: Args, routeId: string): Promise<boolean> => {
  const serviceId = getFlagString(args.flags, "service-id") || getFlagString(args.flags, "service");
  const tripId = getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "trip");
  if (!serviceId && !tripId) return true;

  const ds = await readDatasetState();
  if (serviceId) {
    const rows = await queryRows(
      ds.dbPath,
      `SELECT service_id FROM trips WHERE route_id = ${sqlString(routeId)} AND service_id = ${sqlString(serviceId)} LIMIT 1`,
    );
    if (rows.length === 0) {
      console.log(`No service "${serviceId}" found for route "${routeId}".`);
      return false;
    }
  }
  if (tripId) {
    const q = serviceId
      ? `SELECT trip_id FROM trips WHERE trip_id = ${sqlString(tripId)} AND route_id = ${sqlString(routeId)} AND service_id = ${sqlString(serviceId)} LIMIT 1`
      : `SELECT trip_id FROM trips WHERE trip_id = ${sqlString(tripId)} AND route_id = ${sqlString(routeId)} LIMIT 1`;
    const rows = await queryRows(ds.dbPath, q);
    if (rows.length === 0) {
      console.log(`No trip "${tripId}" found for route "${routeId}"${serviceId ? ` service "${serviceId}"` : ""}.`);
      return false;
    }
  }
  return true;
};

const MAX_COMPARE_TRIPS = 5;

const printRouteServiceData = async (args: Args, routeId: string) => {
  const view = getViewFlag(args);
  const serviceId = getFlagString(args.flags, "service-id") || getFlagString(args.flags, "service");
  const tripId = getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "trip");
  const compareRaw = getFlagString(args.flags, "compare");

  if (view === "service") {
    const ds = await readDatasetState();

    // --compare trip1,trip2,... — side-by-side stop_times (requires --service)
    if (compareRaw) {
      if (!serviceId) {
        console.log("--compare requires --service to scope trips within a service.");
        return true;
      }
      const tripIds = compareRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (tripIds.length === 0) {
        console.log("Provide comma-separated trip IDs: --compare trip1,trip2");
        return true;
      }
      if (tripIds.length > MAX_COMPARE_TRIPS) {
        console.log(`Maximum ${MAX_COMPARE_TRIPS} trips can be compared.`);
        return true;
      }
      // Verify all trips belong to this route + service
      for (const tid of tripIds) {
        const check = await queryRows(
          ds.dbPath,
          `SELECT trip_id FROM trips WHERE trip_id = ${sqlString(tid)} AND route_id = ${sqlString(routeId)} AND service_id = ${sqlString(serviceId)} LIMIT 1`,
        );
        if (check.length === 0) {
          console.log(`Trip "${tid}" not found in route "${routeId}" service "${serviceId}".`);
          return true;
        }
      }
      // Build a combined view: stop_sequence + stop_id, then one column per trip with arrival times
      const allRows: Record<string, unknown>[] = [];
      for (const tid of tripIds) {
        const rows = await queryRows(
          ds.dbPath,
          `SELECT stop_sequence, stop_id, arrival_time, departure_time FROM stop_times WHERE trip_id = ${sqlString(tid)} ORDER BY stop_sequence`,
        );
        if (rows.length === 0) {
          console.log(`No stop_times found for trip "${tid}".`);
          return true;
        }
        for (const row of rows) {
          const key = Number(row.stop_sequence);
          if (!allRows[key]) {
            allRows[key] = { stop_sequence: row.stop_sequence, stop_id: row.stop_id };
          }
          (allRows[key] as any)[`${tid}_arr`] = row.arrival_time;
          (allRows[key] as any)[`${tid}_dep`] = row.departure_time;
        }
      }
      const combined = Object.values(allRows).filter(Boolean).sort(
        (a: any, b: any) => Number(a.stop_sequence) - Number(b.stop_sequence),
      );
      printOrNone(combined as Record<string, unknown>[], args);
      return true;
    }

    if (tripId) {
      const rows = await queryRows(
        ds.dbPath,
        `SELECT st.* FROM stop_times st WHERE st.trip_id = ${sqlString(tripId)} ORDER BY st.stop_sequence`,
      );
      printOrNone(rows, args);
    } else if (serviceId) {
      const rows = await queryRows(
        ds.dbPath,
        `SELECT t.trip_id, t.trip_headsign, t.trip_short_name, t.direction_id, t.shape_id
         FROM trips t WHERE t.route_id = ${sqlString(routeId)} AND t.service_id = ${sqlString(serviceId)}
         ORDER BY t.trip_id`,
      );
      printOrNone(rows, args);
    } else {
      const rows = await queryRows(
        ds.dbPath,
        `SELECT c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday, c.start_date, c.end_date, COUNT(DISTINCT t.trip_id) AS trip_count
         FROM calendar c
         JOIN trips t ON t.service_id = c.service_id
         WHERE t.route_id = ${sqlString(routeId)}
         GROUP BY c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday, c.start_date, c.end_date
         ORDER BY trip_count DESC`,
      );
      printOrNone(rows, args);
    }
    return true;
  }
  return false;
};

// Get first positional that isn't a view name (for use as ID)
const getPositionalId = (args: Args) => {
  for (const p of args.positionals) {
    if (!VIEW_NAMES.has(p)) return p;
  }
  return undefined;
};

const printOrNone = (rows: Record<string, unknown>[], args: Args) => {
  if (rows.length === 0) {
    console.log("No results found.");
    return;
  }
  // Union of all keys across all rows (handles compare where trips have different stop_sequences)
  const colSet = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) colSet.add(key);
  printResult({ columns: Array.from(colSet), rows }, args.flags);
};

const commandRoutes = async (args: Args) => {
  ensureOutputMode(args);
  const id = getFlagString(args.flags, "route-id") || getFlagString(args.flags, "id") || getPositionalId(args);
  if (wantsDataOutput(args.flags)) {
    if (id && (await printRouteServiceData(args, id))) return;
    const dataset = await readDatasetState();
    const filters: string[] = [];
    const name = getFlagString(args.flags, "route-name") || getFlagString(args.flags, "name");
    const type = getFlagString(args.flags, "type") || getFlagString(args.flags, "route-type");
    if (id) filters.push(`route_id = ${sqlString(id)}`);
    if (name) {
      filters.push(
        `(LOWER(route_name) LIKE LOWER(${sqlString(`%${name}%`)}) OR LOWER(route_short_name) LIKE LOWER(${sqlString(`%${name}%`)}) OR LOWER(route_long_name) LIKE LOWER(${sqlString(`%${name}%`)}))`,
      );
    }
    if (type) {
      const numericType = Number(type);
      if (Number.isFinite(numericType)) filters.push(`route_type = ${numericType}`);
      else filters.push(`route_type_name = ${sqlString(type)}`);
    }
    const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";
    const rows = await queryRows(dataset.dbPath, `SELECT * FROM RoutesTable${where}`);
    printOrNone(rows, args);
    return;
  }
  // Verify route exists before opening dashboard
  if (id) {
    const dataset = await readDatasetState();
    const rows = await queryRows(dataset.dbPath, `SELECT route_id FROM RoutesTable WHERE route_id = ${sqlString(id)} LIMIT 1`);
    if (rows.length === 0) {
      console.log(`No route found with ID "${id}".`);
      return;
    }
    if (!(await verifyRouteServiceFlags(args, id))) return;
  }
  const params = dashboardParamsFromFlags(args);
  if (id) {
    params.cliSelectedRoute = id;
    params.selectedRouteId = id;
  }
  addRouteServiceParams(args, params);
  // When comparing trips or selecting a specific trip, use trips/table which supports those params
  const compareRaw = getFlagString(args.flags, "compare");
  const tripId = getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "trip");
  if (compareRaw || tripId) {
    if (id) params.routeId = id; // trips/table uses routeId for filtering
    const view = getViewFlag(args);
    if (view === "timeline" || view === "map") params.view = view;
    await openDashboardView("trips/table", params);
  } else {
    await openDashboardView(serviceRoutesViewForRoute(getViewFlag(args), id), params);
  }
};

const commandRoute = async (args: Args) => {
  ensureOutputMode(args);
  const route = await resolveServiceRouteFromArgs(args);
  if (wantsDataOutput(args.flags)) {
    if (await printRouteServiceData(args, route.routeId)) return;
    const ds = await readDatasetState();
    const rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM get_route_info(${sqlString(route.routeId)})`,
    );
    printOrNone(rows, args);
    return;
  }
  if (!(await verifyRouteServiceFlags(args, route.routeId))) return;
  const params = dashboardParamsFromFlags(args);
  params.cliSelectedRoute = route.routeId;
  params.selectedRouteId = route.routeId;
  addRouteServiceParams(args, params);
  const compareRaw = getFlagString(args.flags, "compare");
  const tripId = getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "trip");
  if (compareRaw || tripId) {
    params.routeId = route.routeId; // trips/table uses routeId for filtering
    const view = getViewFlag(args);
    if (view === "timeline" || view === "map") params.view = view;
    await openDashboardView("trips/table", params);
  } else {
    await openDashboardView(serviceRoutesViewForRoute(getViewFlag(args), route.routeId), params);
  }
};

const commandTrips = async (args: Args) => {
  ensureOutputMode(args);
  const routeId = getFlagString(args.flags, "route-id") || getFlagString(args.flags, "route") || getFlagString(args.flags, "id");
  const serviceId = getFlagString(args.flags, "service-id") || getFlagString(args.flags, "service");
  const tripId = getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "trip") || getPositionalId(args);
  const compareRaw = getFlagString(args.flags, "compare");

  if (wantsDataOutput(args.flags)) {
    const ds = await readDatasetState();

    // --compare trip1,trip2,... — side-by-side stop times
    if (compareRaw) {
      const tripIds = compareRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (tripIds.length === 0) {
        console.log("Provide comma-separated trip IDs: --compare trip1,trip2");
        return;
      }
      if (tripIds.length > MAX_COMPARE_TRIPS) {
        console.log(`Maximum ${MAX_COMPARE_TRIPS} trips can be compared.`);
        return;
      }
      const allRows: Record<string, unknown>[] = [];
      for (const tid of tripIds) {
        const rows = await queryRows(
          ds.dbPath,
          `SELECT st.stop_sequence, st.stop_id, s.stop_name, st.arrival_time, st.departure_time
           FROM stop_times st LEFT JOIN stops s ON s.stop_id = st.stop_id
           WHERE st.trip_id = ${sqlString(tid)} ORDER BY st.stop_sequence`,
        );
        if (rows.length === 0) { console.log(`No stop_times for trip "${tid}".`); return; }
        for (const row of rows) {
          const key = Number(row.stop_sequence);
          if (!allRows[key]) allRows[key] = { stop_sequence: row.stop_sequence, stop_id: row.stop_id, stop_name: row.stop_name };
          (allRows[key] as any)[`${tid}_arr`] = row.arrival_time;
          (allRows[key] as any)[`${tid}_dep`] = row.departure_time;
        }
      }
      printOrNone(Object.values(allRows).filter(Boolean).sort((a: any, b: any) => Number(a.stop_sequence) - Number(b.stop_sequence)) as Record<string, unknown>[], args);
      return;
    }

    const filters: string[] = [];
    if (routeId) filters.push(`t.route_id = ${sqlString(routeId)}`);
    if (serviceId) filters.push(`t.service_id = ${sqlString(serviceId)}`);
    if (tripId) filters.push(`t.trip_id = ${sqlString(tripId)}`);
    const where = filters.length > 0 ? ` WHERE ${filters.join(" AND ")}` : "";

    if (tripId && !routeId) {
      const rows = await queryRows(
        ds.dbPath,
        `SELECT st.stop_sequence, st.stop_id, s.stop_name, st.arrival_time, st.departure_time
         FROM stop_times st LEFT JOIN stops s ON s.stop_id = st.stop_id
         WHERE st.trip_id = ${sqlString(tripId)} ORDER BY st.stop_sequence`,
      );
      printOrNone(rows, args);
    } else {
      const rows = await queryRows(
        ds.dbPath,
        `SELECT t.trip_id, t.route_id, t.service_id, t.trip_headsign, t.direction_id, t.shape_id,
                COUNT(st.stop_id) AS stop_count
         FROM trips t LEFT JOIN stop_times st ON st.trip_id = t.trip_id
         ${where}
         GROUP BY t.trip_id, t.route_id, t.service_id, t.trip_headsign, t.direction_id, t.shape_id
         ORDER BY t.route_id, t.service_id, t.trip_id`,
      );
      printOrNone(rows, args);
    }
    return;
  }

  // Dashboard mode
  const params = dashboardParamsFromFlags(args);
  if (routeId) { params.selectedRouteId = routeId; params.cliSelectedRoute = routeId; params.routeId = routeId; }
  if (tripId && !compareRaw) params.selectedTripId = tripId;
  if (serviceId) params.selectedServiceId = serviceId;
  const view = getViewFlag(args);
  if (view === "timeline" || view === "map") params.view = view;
  if (compareRaw) {
    const allIds = compareRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (tripId && !allIds.includes(tripId)) allIds.unshift(tripId);
    params.compareTripIds = allIds.join(",");
  }
  await openDashboardView("trips/table", params);
};

const commandTrip = async (args: Args) => {
  ensureOutputMode(args);
  const tripId = getFlagString(args.flags, "trip-id") || getFlagString(args.flags, "id") || getPositionalId(args);
  if (!tripId) throw new Error("Trip ID is required. Usage: gtfs-viz trip <trip-id>");
  const compareRaw = getFlagString(args.flags, "compare");

  if (wantsDataOutput(args.flags)) {
    const ds = await readDatasetState();
    const view = getViewFlag(args);

    // --compare: side-by-side with other trips
    if (compareRaw) {
      const otherIds = compareRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const allIds = [tripId, ...otherIds];
      const allRows: Record<string, unknown>[] = [];
      for (const tid of allIds) {
        const rows = await queryRows(
          ds.dbPath,
          `SELECT st.stop_sequence, st.stop_id, s.stop_name, st.arrival_time, st.departure_time
           FROM stop_times st LEFT JOIN stops s ON s.stop_id = st.stop_id
           WHERE st.trip_id = ${sqlString(tid)} ORDER BY st.stop_sequence`,
        );
        for (const row of rows) {
          const key = Number(row.stop_sequence);
          if (!allRows[key]) allRows[key] = { stop_sequence: row.stop_sequence, stop_id: row.stop_id, stop_name: row.stop_name };
          (allRows[key] as any)[`${tid}_arr`] = row.arrival_time;
          (allRows[key] as any)[`${tid}_dep`] = row.departure_time;
        }
      }
      printOrNone(Object.values(allRows).filter(Boolean).sort((a: any, b: any) => Number(a.stop_sequence) - Number(b.stop_sequence)) as Record<string, unknown>[], args);
      return;
    }

    if (view === "info") {
      const rows = await queryRows(ds.dbPath, `SELECT t.* FROM trips t WHERE t.trip_id = ${sqlString(tripId)}`);
      printOrNone(rows, args);
    } else {
      const rows = await queryRows(
        ds.dbPath,
        `SELECT st.stop_sequence, st.stop_id, s.stop_name, st.arrival_time, st.departure_time, s.stop_lat, s.stop_lon
         FROM stop_times st LEFT JOIN stops s ON s.stop_id = st.stop_id
         WHERE st.trip_id = ${sqlString(tripId)} ORDER BY st.stop_sequence`,
      );
      printOrNone(rows, args);
    }
    return;
  }

  // Dashboard mode
  const ds = await readDatasetState();
  const tripRows = await queryRows(ds.dbPath, `SELECT route_id, service_id FROM trips WHERE trip_id = ${sqlString(tripId)} LIMIT 1`);
  if (tripRows.length === 0) { console.log(`No trip found with ID "${tripId}".`); return; }
  const params = dashboardParamsFromFlags(args);
  const resolvedRoute = String(tripRows[0].route_id);
  params.selectedRouteId = resolvedRoute;
  params.cliSelectedRoute = resolvedRoute;
  params.routeId = resolvedRoute;
  if (tripRows[0].service_id) params.selectedServiceId = String(tripRows[0].service_id);
  const view = getViewFlag(args);
  if (view === "timeline" || view === "map") params.view = view;
  if (compareRaw) {
    const allIds = compareRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!allIds.includes(tripId)) allIds.unshift(tripId);
    params.compareTripIds = allIds.join(",");
  } else {
    params.selectedTripId = tripId;
  }
  await openDashboardView("trips/table", params);
};

const commandCalendar = async (args: Args) => {
  ensureOutputMode(args);
  const serviceId = getFlagString(args.flags, "service-id") || getFlagString(args.flags, "service") || getFlagString(args.flags, "id") || getPositionalId(args);
  const routeId = getFlagString(args.flags, "route-id") || getFlagString(args.flags, "route");

  if (wantsDataOutput(args.flags)) {
    const ds = await readDatasetState();
    if (serviceId) {
      // Show calendar + dates for a specific service
      const cal = await queryRows(ds.dbPath, `SELECT * FROM calendar WHERE service_id = ${sqlString(serviceId)}`);
      if (cal.length > 0) {
        console.log("Calendar:");
        printOrNone(cal, args);
      }
      const dates = await queryRows(ds.dbPath, `SELECT * FROM calendar_dates WHERE service_id = ${sqlString(serviceId)} ORDER BY date`);
      if (dates.length > 0) {
        console.log("\nCalendar Dates:");
        printOrNone(dates, args);
      }
      if (cal.length === 0 && dates.length === 0) console.log(`No calendar data for service "${serviceId}".`);
    } else {
      // List services with trip counts
      const filters: string[] = [];
      if (routeId) filters.push(`t.route_id = ${sqlString(routeId)}`);
      const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await queryRows(
        ds.dbPath,
        `SELECT c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday,
                c.start_date, c.end_date, COUNT(DISTINCT t.trip_id) AS trip_count
         FROM calendar c
         LEFT JOIN trips t ON t.service_id = c.service_id ${where ? `AND ${filters.join(" AND ")}` : ""}
         GROUP BY c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday, c.start_date, c.end_date
         ORDER BY trip_count DESC`,
      );
      printOrNone(rows, args);
    }
    return;
  }
  // Dashboard — open service view
  const params = dashboardParamsFromFlags(args);
  if (routeId) { params.selectedRouteId = routeId; params.cliSelectedRoute = routeId; params.routeId = routeId; }
  if (serviceId) params.selectedServiceId = serviceId;
  await openDashboardView("routes/service", params);
};

const commandShapes = async (args: Args) => {
  ensureOutputMode(args);
  const shapeId = getFlagString(args.flags, "shape-id") || getFlagString(args.flags, "shape") || getFlagString(args.flags, "id") || getPositionalId(args);
  const routeId = getFlagString(args.flags, "route-id") || getFlagString(args.flags, "route");

  if (!wantsDataOutput(args.flags)) {
    const params = dashboardParamsFromFlags(args);
    if (routeId) { params.selectedRouteId = routeId; params.cliSelectedRoute = routeId; params.routeId = routeId; }
    await openDashboardView("routes/map", params);
    return;
  }
  const ds = await readDatasetState();
  if (shapeId) {
    const rows = await queryRows(
      ds.dbPath,
      `SELECT shape_pt_sequence, shape_pt_lat, shape_pt_lon, shape_dist_traveled
       FROM shapes WHERE shape_id = ${sqlString(shapeId)} ORDER BY shape_pt_sequence`,
    );
    printOrNone(rows, args);
  } else {
    const filters: string[] = [];
    if (routeId) filters.push(`t.route_id = ${sqlString(routeId)}`);
    const joinClause = filters.length > 0 ? `JOIN trips t ON t.shape_id = s.shape_id WHERE ${filters.join(" AND ")}` : "";
    const rows = await queryRows(
      ds.dbPath,
      `SELECT s.shape_id, COUNT(*) AS point_count, MIN(s.shape_pt_lat) AS min_lat, MAX(s.shape_pt_lat) AS max_lat,
              MIN(s.shape_pt_lon) AS min_lon, MAX(s.shape_pt_lon) AS max_lon
       FROM shapes s ${joinClause}
       GROUP BY s.shape_id ORDER BY s.shape_id`,
    );
    printOrNone(rows, args);
  }
};

const commandStatus = async () => {
  const dataset = await readDatasetState();
  const daemon = await isDaemonRunning();
  console.log(`Dataset: ${dataset.fileName}`);
  console.log(`Source: ${dataset.sourcePath}`);
  console.log(`DuckDB: ${dataset.dbPath}`);
  console.log(`Imported: ${dataset.importedAt}`);
  console.log(
    `Stops: ${dataset.counts.stops}  Stations: ${dataset.counts.stations}  Pathways: ${dataset.counts.pathways}  Routes: ${dataset.counts.routes || 0}`,
  );

  // Show file availability
  try {
    const tables = ["trips", "stop_times", "shapes", "calendar", "calendar_dates"];
    const available: string[] = [];
    const missing: string[] = [];
    for (const t of tables) {
      const rows = await queryRows(dataset.dbPath, `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = '${t}'`).catch(() => [{ n: 0 }]);
      const count = await queryRows(dataset.dbPath, `SELECT COUNT(*) AS n FROM ${t}`).catch(() => [{ n: 0 }]);
      if (Number(rows[0]?.n) > 0 && Number(count[0]?.n) > 0) {
        available.push(t);
      } else {
        missing.push(t);
      }
    }
    if (available.length > 0) console.log(`Files: ${available.join(", ")}`);
    if (missing.length > 0) console.log(`Missing: ${missing.join(", ")}`);
  } catch {
    // status check is best-effort
  }

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
  const outDir =
    getFlagString(args.flags, "output") ||
    getFlagString(args.flags, "out") ||
    getFlagString(args.flags, "o") ||
    ".";
  const outPath = path.resolve(outDir);

  const includeStops = !hasFlag(args.flags, "no-stops");
  const includePathways = !hasFlag(args.flags, "no-pathways");
  const includeRoutes = !hasFlag(args.flags, "no-routes");

  if (!includeStops && !includePathways && !includeRoutes) {
    throw new Error("Nothing to export. Remove --no-stops, --no-pathways, or --no-routes.");
  }

  // Check for pending edits
  const stopEdits = await queryRows(ds.dbPath, "SELECT COUNT(*) AS c FROM EditStopTable").catch(
    () => [{ c: 0 }],
  );
  const pathwayEdits = await queryRows(
    ds.dbPath,
    "SELECT COUNT(*) AS c FROM EditPathwayTable",
  ).catch(() => [{ c: 0 }]);
  const routeEdits = await queryRows(
    ds.dbPath,
    "SELECT COUNT(*) AS c FROM EditRouteTable",
  ).catch(() => [{ c: 0 }]);
  const stopEditCount = Number(stopEdits[0]?.c || 0);
  const pathwayEditCount = Number(pathwayEdits[0]?.c || 0);
  const routeEditCount = Number(routeEdits[0]?.c || 0);

  if (stopEditCount === 0 && pathwayEditCount === 0 && routeEditCount === 0 && !hasFlag(args.flags, "force")) {
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
      "stops",
      "EditStopTable",
      "stop_id",
      ["row_id", "location_type_name", "wheelchair_status", "geom"],
      "stops.txt",
    );
    console.log(`Exported stops.txt (${stopEditCount} edits applied)`);
    exported.push(f);
  }

  if (includePathways) {
    const pathwayCount = await queryRows(ds.dbPath, "SELECT COUNT(*) AS c FROM pathways").catch(
      () => [{ c: 0 }],
    );
    if (Number(pathwayCount[0]?.c || 0) > 0 || pathwayEditCount > 0) {
      const f = await exportFile(
        "pathways",
        "EditPathwayTable",
        "pathway_id",
        ["row_id", "pathway_mode_name", "direction_type"],
        "pathways.txt",
      );
      console.log(`Exported pathways.txt (${pathwayEditCount} edits applied)`);
      exported.push(f);
    } else {
      console.log("No pathways data to export.");
    }
  }

  if (includeRoutes) {
    const routeCount = await queryRows(ds.dbPath, "SELECT COUNT(*) AS c FROM routes").catch(
      () => [{ c: 0 }],
    );
    if (Number(routeCount[0]?.c || 0) > 0 || routeEditCount > 0) {
      const f = await exportFile(
        "routes",
        "EditRouteTable",
        "route_id",
        ["row_id", "route_name", "route_type_name", "route_color_hex", "route_text_color_hex", "shape_points_json", "status"],
        "routes.txt",
      );
      console.log(`Exported routes.txt (${routeEditCount} edits applied)`);
      exported.push(f);
    } else {
      console.log("No routes data to export.");
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
    if (dashboard.routeId) {
      params.cliSelectedRoute = dashboard.routeId;
      params.selectedRouteId = dashboard.routeId;
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
  await openDashboardView(stationViewForRoute(getViewFlag(args)), {
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
  await openDashboardView(pathwayViewForRoute(getViewFlag(args)), {
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
      await openDashboardView(stopsViewForRoute(getViewFlag(args)), {
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
  await openDashboardView(pathwayViewForRoute(getViewFlag(args)), params);
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
  await openDashboardView(pathwayViewForRoute(getViewFlag(args)), params);
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
      await openDashboardView(stopsViewForRoute(getViewFlag(args)), {
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
  await openDashboardView(pathwayViewForRoute(getViewFlag(args)), params);
};

const commandEditTable = async (args: Args) => {
  const table = args.positionals[0] || getFlagString(args.flags, "table");
  const ds = await readDatasetState();
  if (table === "pathways" || table === "pathway" || table === "EditPathwayTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditPathwayTable");
    printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
  } else if (table === "routes" || table === "route" || table === "EditRouteTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditRouteTable");
    printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
  } else if (table === "stops" || table === "stop" || table === "EditStopTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditStopTable");
    printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
  } else if (table === "stop_times" || table === "stop-times" || table === "EditStopTimesTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditStopTimesTable");
    printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
  } else if (table === "calendar" || table === "EditCalendarTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditCalendarTable");
    printResult({ columns: rows.length > 0 ? Object.keys(rows[0]) : [], rows }, args.flags);
  } else if (table === "trips" || table === "EditTripsTable") {
    const rows = await queryRows(ds.dbPath, "SELECT * FROM EditTripsTable");
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
    console.log("\nEditRouteTable:");
    const routeRows = await queryRows(ds.dbPath, "SELECT * FROM EditRouteTable");
    printResult(
      {
        columns: routeRows.length > 0 ? Object.keys(routeRows[0]) : [],
        rows: routeRows,
      },
      args.flags,
    );
    console.log("\nEditStopTable:");
    const stopRows = await queryRows(ds.dbPath, "SELECT * FROM EditStopTable");
    printResult({ columns: stopRows.length > 0 ? Object.keys(stopRows[0]) : [], rows: stopRows }, args.flags);
    try {
      console.log("\nEditStopTimesTable:");
      const stRows = await queryRows(ds.dbPath, "SELECT * FROM EditStopTimesTable");
      printResult({ columns: stRows.length > 0 ? Object.keys(stRows[0]) : [], rows: stRows }, args.flags);
    } catch { /* table may not exist */ }
    try {
      console.log("\nEditCalendarTable:");
      const calRows = await queryRows(ds.dbPath, "SELECT * FROM EditCalendarTable");
      printResult({ columns: calRows.length > 0 ? Object.keys(calRows[0]) : [], rows: calRows }, args.flags);
    } catch { /* table may not exist */ }
    try {
      console.log("\nEditTripsTable:");
      const tripRows = await queryRows(ds.dbPath, "SELECT * FROM EditTripsTable");
      printResult({ columns: tripRows.length > 0 ? Object.keys(tripRows[0]) : [], rows: tripRows }, args.flags);
    } catch { /* table may not exist */ }
  } else {
    throw new Error("edit_table accepts: pathways, routes, stops, stop_times, calendar, trips, or no argument for all");
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
  const pathwayId = getFlagString(args.flags, "pathway-id") || `pathway_cli_${Date.now()}`;

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
  const stopName =
    getFlagString(args.flags, "stop-name") || getFlagString(args.flags, "name") || stopId;
  const latStr = getFlagString(args.flags, "lat");
  const lonStr = getFlagString(args.flags, "lon");
  if (!latStr || !lonStr) throw new Error("Provide --lat and --lon");
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    throw new Error("--lat and --lon must be valid numbers");
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
    await executeRows(ds.dbPath, `DELETE FROM EditStopTable WHERE stop_id = ${sqlString(stopId)}`);
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
  await openDashboardView(pathwayViewForRoute(getViewFlag(args)), params);
};

const commandStationShortestRoute = async (args: Args) => {
  ensureOutputMode(args);
  const st = await resolveStationFromArgs(args);
  const ds = await readDatasetState();

  // Prefer entrance-to-entrance; fall back to any route with a time
  let rows = await queryRows(
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

  if (rows.length === 0) {
    rows = await queryRows(
      ds.dbPath,
      `
      SELECT *
      FROM get_station_routes(${sqlString(st.stopId)})
      WHERE shortest_time IS NOT NULL
      ORDER BY shortest_time, start_stop, end_stop
      LIMIT 1`,
    );
  }

  if (wantsDataOutput(args.flags)) {
    printResult(
      {
        stationId: st.stopId,
        stationName: st.stopName,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
        ...(rows.length === 0 ? { message: "No timed routes found for this station" } : {}),
      },
      args.flags,
    );
    return;
  }

  const route = rows[0];
  const fromStop = route?.start_stop == null ? undefined : String(route.start_stop);
  const toStop = route?.end_stop == null ? undefined : String(route.end_stop);
  if (!fromStop || !toStop) return;

  await openDashboardView(pathwayViewForRoute(getViewFlag(args)), {
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
  const st = (await resolveStopFromArgs(args)) as {
    stopId: string;
    stopName?: string;
    stopLat?: number;
    stopLon?: number;
  };
  if (wantsDataOutput(args.flags)) {
    const ds = await readDatasetState();
    let rows = await queryRows(
      ds.dbPath,
      `SELECT * FROM StopsTable WHERE stop_id = ${sqlString(st.stopId)}`,
    );
    // If no stop row, try StationsTable (resolveStopFromArgs may have fallen back)
    if (rows.length === 0) {
      rows = await queryRows(
        ds.dbPath,
        `SELECT * FROM StationsTable WHERE stop_id = ${sqlString(st.stopId)}`,
      );
    }
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
  await openDashboardView(stopsViewForRoute(getViewFlag(args)), params);
};

const commandView = async (args: Args) => {
  let view = getViewFlag(args) || "auto";
  if (!supportedViews.has(view)) throw new Error(`Unsupported view: ${view}`);
  const params = dashboardParamsFromFlags(args);

  const stationInput = getStationSelectionInput(args.flags);
  const stopInput = getStopSelectionInput(args.flags);
  const routeInput = getServiceRouteSelectionInput(args.flags);
  if (view === "auto" && stationInput) view = "stations/info";
  if (view === "auto" && stopInput) view = "stops/map";
  if (view === "auto" && routeInput) view = "routes/map";

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
  if (routeInput) {
    const ds = await readDatasetState();
    const route = await resolveServiceRouteSelection(ds.dbPath, routeInput);
    params.cliSelectedRoute = route.routeId;
    params.selectedRouteId = route.routeId;
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

  const skillMdPath = path.join(targetDir, "SKILL.md");
  let skillMd = await readFile(skillMdPath, "utf-8");

  const compatibilityByAgent: Record<SkillAgent, string> = {
    claude: "Designed for Claude Code. Requires Node.js 18+ and DuckDB CLI on PATH or DUCKDB_BIN.",
    codex: "Designed for Codex. Requires Node.js 18+ and DuckDB CLI on PATH or DUCKDB_BIN.",
    opensource: "Requires Node.js 18+ and DuckDB CLI on PATH or DUCKDB_BIN.",
  };
  const allowedToolsByAgent: Record<SkillAgent, string | null> = {
    claude: "Bash(gtfs-viz:*) Bash(duckdb:*) Read",
    codex: null,
    opensource: null,
  };

  skillMd = skillMd.replace(
    /^compatibility:.*$/m,
    `compatibility: ${compatibilityByAgent[agent!]}`,
  );
  const allowedTools = allowedToolsByAgent[agent!];
  if (allowedTools) {
    skillMd = skillMd.replace(/^(metadata:)/m, `allowed-tools: ${allowedTools}\n$1`);
  }

  await writeFile(skillMdPath, skillMd, "utf-8");
  console.log(`Installed GTFS Viz skill to ${targetDir}`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "__daemon__") {
    await runDaemon();
    return;
  }

  if (hasFlag(args.flags, "help") || args.command === "help") {
    // View-specific help: e.g. `routes --view service -h` or `routes service -h`
    const view = getViewFlag(args);
    if (args.command && view && args.command !== "help") {
      const viewKey = `${args.command}:${view}`;
      if (printCommandHelp(viewKey)) return;
    }
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
  _urlOnlyMode = wantsUrlOnly(args);

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
  if (
    args.command === "routes" ||
    args.command === "service_routes" ||
    args.command === "service-routes"
  ) {
    await commandRoutes(args);
    return;
  }
  if (args.command === "route") {
    await commandRoute(args);
    return;
  }
  if (args.command === "trips") {
    await commandTrips(args);
    return;
  }
  if (args.command === "trip") {
    await commandTrip(args);
    return;
  }
  if (args.command === "calendar" || args.command === "services") {
    await commandCalendar(args);
    return;
  }
  if (args.command === "shapes") {
    await commandShapes(args);
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
  if (args.command === "station_routes" || args.command === "station-routes") {
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
