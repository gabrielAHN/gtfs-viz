import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeRows } from "../duckdb/runner.js";
import type {
  DatasetMetadata,
  SessionStatus,
  StatusValue,
} from "../session/metadata.js";
import { randomId } from "../session/metadata.js";

type QueryRecord = {
  id: string;
  status: "queued" | "running" | "complete" | "error";
  payload: { sql?: string; name?: string; args?: Record<string, unknown> };
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
};

import { realpathSync } from "node:fs";

const resolvePackageRoot = () => {
  try {
    const realScript = realpathSync(process.argv[1]);
    const dir = path.dirname(realScript);
    return dir.endsWith("dist") ? path.resolve(dir, "..") : path.resolve(dir, "..", "..");
  } catch {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  }
};
const packageRoot = resolvePackageRoot();
const repoRoot = path.resolve(packageRoot, "..", "..");
const packagedDashboard = path.resolve(packageRoot, "dashboard");
const repoDashboard = path.resolve(repoRoot, "dist");
const webDashboard = path.resolve(repoRoot, "packages", "web", "dist");

const getAppDist = () => {
  if (process.env.GTFS_VIZ_DASHBOARD_DIST) {
    return path.resolve(process.env.GTFS_VIZ_DASHBOARD_DIST);
  }
  if (existsSync(path.join(packagedDashboard, "index.html"))) return packagedDashboard;
  if (existsSync(path.join(webDashboard, "index.html"))) return webDashboard;
  return repoDashboard;
};

const contentTypeFor = (filePath: string) => {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
  };
  return types[ext] || "application/octet-stream";
};

const jsonResponse = (res: http.ServerResponse, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text),
      });
  res.end(text);
};

const textResponse = (res: http.ServerResponse, status: number, body: string) => {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
      });
  res.end(body);
};

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

const readBody = async (req: http.IncomingMessage) => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
};

const serveFile = async (res: http.ServerResponse, filePath: string) => {
  const fileStat = await stat(filePath);
  res.writeHead(200, {
    "content-type": contentTypeFor(filePath),
    "content-length": fileStat.size,
      });
  createReadStream(filePath).pipe(res);
};

const serveStatic = async (res: http.ServerResponse, urlPath: string) => {
  const appDist = getAppDist();
  const indexPath = path.join(appDist, "index.html");
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const requested = decoded === "/" ? "index.html" : decoded.slice(1);
  const normalized = path.normalize(requested);
  const filePath = path.resolve(appDist, normalized);
  const relativePath = path.relative(appDist, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    textResponse(res, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      await serveFile(res, filePath);
      return;
    }
  } catch {}

  await serveFile(res, indexPath);
};

export type ServerHandle = {
  server: ReturnType<typeof http.createServer>;
  navigate: (url: string) => void;
};

export const createServer = (
  sessionId: string,
  dataset: DatasetMetadata,
  initialStatus: SessionStatus,
): ServerHandle => {
  let currentStatus = initialStatus;
  let sqlQueue = Promise.resolve();
  const queries = new Map<string, QueryRecord>();
  let pendingNavigate: string | null = null;

  const runSql = (sql: string) => {
    const current = sqlQueue.then(() => executeRows(dataset.dbPath, sql));
    sqlQueue = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  };

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const host = req.headers.host || "127.0.0.1";
      const url = new URL(req.url || "/", `http://${host}`);

      if (url.pathname === "/__gtfs_viz/feed.zip" && req.method === "GET") {
        res.writeHead(200, {
          "content-type": "application/zip",
          "content-disposition": 'inline; filename="feed.zip"',
                  });
        createReadStream(dataset.feedPath).pipe(res);
        return;
      }

      if (url.pathname === "/__gtfs_viz/api/dataset" && req.method === "GET") {
        jsonResponse(res, 200, dataset);
        return;
      }

      if (url.pathname === "/__gtfs_viz/api/sql" && req.method === "POST") {
        const body = await readBody(req);
        if (body.sessionId !== sessionId) {
          jsonResponse(res, 403, { error: "Invalid session" });
          return;
        }
        if (typeof body.sql !== "string" || (body.sql as string).trim().length === 0) {
          jsonResponse(res, 400, { error: "Missing SQL" });
          return;
        }
        const rows = await runSql(body.sql as string);
        jsonResponse(res, 200, { rows });
        return;
      }

      if (url.pathname === "/__gtfs_viz/api/status" && req.method === "GET") {
        jsonResponse(res, 200, currentStatus);
        return;
      }

      if (url.pathname === "/__gtfs_viz/api/status" && req.method === "POST") {
        const body = await readBody(req);
        if (body.sessionId !== sessionId) {
          jsonResponse(res, 409, { error: "Session mismatch" });
          return;
        }
        currentStatus = {
          sessionId,
          status: String(body.status || currentStatus.status) as StatusValue,
          message: typeof body.message === "string" ? body.message : undefined,
          error: typeof body.error === "string" ? body.error : undefined,
          updatedAt: new Date().toISOString(),
        };
        jsonResponse(res, 200, currentStatus);
        return;
      }

      // Navigate endpoint — browser polls GET, CLI pushes via POST
      if (url.pathname === "/__gtfs_viz/api/navigate" && req.method === "GET") {
        if (pendingNavigate) {
          const target = pendingNavigate;
          pendingNavigate = null;
          jsonResponse(res, 200, { url: target });
        } else {
          res.writeHead(204, { "access-control-allow-origin": "*" });
          res.end();
        }
        return;
      }

      if (url.pathname === "/__gtfs_viz/api/navigate" && req.method === "POST") {
        const body = await readBody(req);
        if (body.sessionId !== sessionId) {
          jsonResponse(res, 403, { error: "Invalid session" });
          return;
        }
        if (typeof body.url === "string") {
          pendingNavigate = body.url as string;
          jsonResponse(res, 200, { ok: true });
        } else {
          jsonResponse(res, 400, { error: "Missing url" });
        }
        return;
      }

      if (url.pathname === "/__gtfs_viz/api/query" && req.method === "POST") {
        const body = await readBody(req);
        const id = randomId();
        const record: QueryRecord = {
          id,
          status: "queued",
          payload: {
            sql: typeof body.sql === "string" ? body.sql : undefined,
            name: typeof body.name === "string" ? body.name : undefined,
            args: body.args && typeof body.args === "object"
              ? (body.args as Record<string, unknown>)
              : undefined,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queries.set(id, record);
        jsonResponse(res, 202, { queryId: id });
        return;
      }

      const queryMatch = url.pathname.match(/^\/__gtfs_viz\/api\/query\/([^/]+)$/);
      if (queryMatch && req.method === "GET") {
        const record = queries.get(queryMatch[1]);
        if (!record) {
          jsonResponse(res, 404, { error: "Query not found" });
          return;
        }
        jsonResponse(res, 200, record);
        return;
      }

      if (url.pathname === "/__gtfs_viz/api/queries/next" && req.method === "GET") {
        const record = Array.from(queries.values()).find((query) => query.status === "queued");
        if (!record) {
          res.writeHead(204, { "access-control-allow-origin": "*" });
          res.end();
          return;
        }
        record.status = "running";
        record.updatedAt = new Date().toISOString();
        jsonResponse(res, 200, { queryId: record.id, ...record.payload });
        return;
      }

      const resultMatch = url.pathname.match(/^\/__gtfs_viz\/api\/queries\/([^/]+)\/result$/);
      if (resultMatch && req.method === "POST") {
        const record = queries.get(resultMatch[1]);
        if (!record) {
          jsonResponse(res, 404, { error: "Query not found" });
          return;
        }
        const body = await readBody(req);
        record.status = body.error ? "error" : "complete";
        record.updatedAt = new Date().toISOString();
        record.result = body.result;
        record.error = typeof body.error === "string" ? body.error : undefined;
        jsonResponse(res, 200, record);
        return;
      }

      // Redirect any page without CLI params to include them so the app detects CLI mode
      const isHtmlPage = !url.pathname.startsWith("/__gtfs_viz/") && !url.pathname.startsWith("/assets/") && !url.pathname.match(/\.\w{2,4}$/);
      if (isHtmlPage && !url.searchParams.has("cliSession")) {
        const targetPath = url.pathname === "/" ? "/routes/table" : url.pathname;
        const redirectUrl = new URL(url.toString());
        redirectUrl.pathname = targetPath;
        redirectUrl.searchParams.set("gtfsSource", "/__gtfs_viz/feed.zip");
        redirectUrl.searchParams.set("cliSession", sessionId);
        redirectUrl.searchParams.set("cliApi", "/__gtfs_viz/api");
        redirectUrl.searchParams.set("cliView", targetPath.slice(1));
        res.writeHead(302, { Location: redirectUrl.pathname + redirectUrl.search });
        res.end();
        return;
      }

      await serveStatic(res, url.pathname);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      jsonResponse(res, 500, { error: message });
    }
  });

  return {
    server,
    navigate: (url: string) => { pendingNavigate = url; },
  };
};

export const listen = (server: http.Server, host: string, port: number) =>
  new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(address.port);
      } else {
        reject(new Error("Unable to determine listening port"));
      }
    });
  });

export const validateAppDist = async () => {
  const appDist = getAppDist();
  try {
    await stat(path.join(appDist, "index.html"));
  } catch {
    throw new Error("Dashboard build not found. Run yarn build first.");
  }
};
