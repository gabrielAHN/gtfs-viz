import {
  buildCliApiUrl,
  getStoredCliLaunchProfile,
  readCliLaunchProfileFromUrl,
  type CliLaunchProfile,
} from "./launchProfile";

type QueryRow = Record<string, unknown> & {
  toJSON: () => Record<string, unknown>;
};

const createQueryRow = (row: Record<string, unknown>): QueryRow => {
  const queryRow = { ...row } as QueryRow;
  Object.defineProperty(queryRow, "toJSON", {
    value: () => row,
    enumerable: false,
  });
  return queryRow;
};

const createQueryResult = (rows: Record<string, unknown>[]) => {
  const queryRows = rows.map(createQueryRow);
  return {
    toArray: () => queryRows,
  };
};

export const getCliNativeLaunchProfile = () =>
  readCliLaunchProfileFromUrl() || getStoredCliLaunchProfile();

export const isCliNativeLaunch = () => Boolean(getCliNativeLaunchProfile());

export const createCliNativeConnection = (profile: CliLaunchProfile) => ({
  __gtfsVizCliNative: true,
  query: async (sql: string) => {
    const response = await fetch(buildCliApiUrl(profile, "/sql"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `CLI DuckDB query failed with HTTP ${response.status}`);
    }

    return createQueryResult(Array.isArray(body.rows) ? body.rows : []);
  },
  close: async () => {},
});

export const fetchCliNativeDataset = async (profile: CliLaunchProfile) => {
  const response = await fetch(buildCliApiUrl(profile, "/dataset"));
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `CLI dataset status failed with HTTP ${response.status}`);
  }
  return body as {
    status: "ready";
    counts: {
      stops: number;
      stations: number;
      pathways: number;
    };
  };
};
