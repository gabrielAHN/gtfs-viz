import { useEffect } from "react";
import { useDuckDB } from "@/context/duckdb.client";
import {
  buildCliApiUrl,
  getStoredCliLaunchProfile,
  postCliStatus,
  type CliLaunchProfile,
} from "./launchProfile";

type QueryRequest = {
  queryId: string;
  sql?: string;
  name?: string;
  args?: Record<string, unknown>;
};

const convertValues = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(convertValues);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      output[key] = convertValues(value[key]);
    }
    return output;
  }
  return value;
};

const escapeSql = (value: string) => value.replace(/'/g, "''");

const getStationId = (args: Record<string, unknown> | undefined) => {
  const value = args?.stationId || args?.stopId;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Named query requires args-json with stationId");
  }
  return value;
};

const sqlForNamedQuery = (request: QueryRequest) => {
  const name = request.name;
  if (name === "stations") return "SELECT * FROM StationsTable";
  if (name === "stops") return "SELECT * FROM StopsTable";

  const stationId = escapeSql(getStationId(request.args));

  if (name === "station-info") {
    return `SELECT * FROM get_station_info('${stationId}')`;
  }
  if (name === "station-stops") {
    return `SELECT * FROM get_station_stops('${stationId}')`;
  }
  if (name === "station-pathways" || name === "station_pathways") {
    return `SELECT * FROM get_station_pathways('${stationId}')`;
  }
  if (name === "station_connections" || name === "station-connections") {
    return `SELECT * FROM get_station_connections('${stationId}')`;
  }
  if (name === "pathway-aggregates") {
    return `SELECT * FROM get_pathway_aggregates('${stationId}')`;
  }

  throw new Error(`Unknown named query: ${name}`);
};

const executeQuery = async (conn: any, request: QueryRequest) => {
  const sql = request.sql || sqlForNamedQuery(request);
  const result = await conn.query(sql);
  const rows = result.toArray().map((row: any) => convertValues(row.toJSON ? row.toJSON() : row));
  const fields = result.schema?.fields || [];
  const columns =
    fields.length > 0
      ? fields.map((field: any) => field.name)
      : rows.length > 0
        ? Object.keys(rows[0])
        : [];
  return { columns, rows };
};

const postQueryResult = async (
  profile: CliLaunchProfile,
  request: QueryRequest,
  result?: unknown,
  error?: string,
) => {
  await fetch(buildCliApiUrl(profile, `/queries/${request.queryId}/result`), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ result, error }),
  });
};

export default function CliQueryBridge() {
  const duckdb = useDuckDB();
  const conn = duckdb?.conn;
  const initialized = duckdb?.initialized;

  useEffect(() => {
    const profile = getStoredCliLaunchProfile();
    if (!profile || !conn || !initialized) return;

    let cancelled = false;
    let running = false;

    postCliStatus(profile, "ready", "Dashboard ready for queries");

    const poll = async () => {
      if (cancelled || running) return;
      running = true;
      let request: QueryRequest | null = null;

      try {
        const response = await fetch(buildCliApiUrl(profile, "/queries/next"));
        if (response.status === 204) {
          running = false;
          return;
        }
        if (!response.ok) {
          running = false;
          return;
        }

        request = await response.json();
        const result = await executeQuery(conn, request);
        await postQueryResult(profile, request, result);
      } catch (error) {
        if (request) {
          const message = error instanceof Error ? error.message : String(error);
          await postQueryResult(profile, request, undefined, message).catch(() => {});
        }
      } finally {
        running = false;
      }
    };

    const intervalId = window.setInterval(poll, 500);
    void poll();

    // Poll for CLI-driven navigation
    const pollNavigate = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(buildCliApiUrl(profile, "/navigate"));
        if (res.status === 200) {
          const data = await res.json();
          if (data?.url && typeof data.url === "string") {
            window.location.href = data.url;
          }
        }
      } catch {}
    };
    const navIntervalId = window.setInterval(pollNavigate, 800);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearInterval(navIntervalId);
    };
  }, [conn, initialized]);

  return null;
}
