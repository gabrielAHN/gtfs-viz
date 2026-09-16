import {
  buildCliApiUrl,
  getStoredCliLaunchProfile,
  readCliLaunchProfileFromUrl,
  type CliLaunchProfile,
} from "./launchProfile"

type QueryRow = Record<string, unknown> & {
  toJSON: () => Record<string, unknown>
}

const createQueryRow = (row: Record<string, unknown>): QueryRow => {
  const queryRow = { ...row } as QueryRow
  Object.defineProperty(queryRow, "toJSON", {
    value: () => row,
    enumerable: false,
  })
  return queryRow
}

const createQueryResult = (rows: Record<string, unknown>[]) => {
  const queryRows = rows.map(createQueryRow)
  return {
    numRows: queryRows.length,
    getChild: (name: string) =>
      rows.some((row) => Object.prototype.hasOwnProperty.call(row, name))
        ? { get: (index: number) => rows[index]?.[name] }
        : null,
    toArray: () => queryRows,
  }
}

export const getCliNativeLaunchProfile = () =>
  readCliLaunchProfileFromUrl() || getStoredCliLaunchProfile()

export const isCliNativeLaunch = () => Boolean(getCliNativeLaunchProfile())

const isMissingSpatialExtensionError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return (
    /extension\s+["']?spatial["']?[\s\S]*(?:not (?:found|installed)|install it first)/i.test(
      message,
    ) ||
    /(?:not (?:found|installed)|install it first)[\s\S]*extension\s+["']?spatial["']?/i.test(
      message,
    )
  )
}

export const queryWithSpatial = async (conn: any, sql: string) => {
  if (!conn?.__gtfsVizCliNative) return conn.query(sql)
  try {
    return await conn.query(`LOAD spatial;\n${sql}`)
  } catch (error) {
    if (!isMissingSpatialExtensionError(error)) throw error
    return conn.query(`INSTALL spatial;\nLOAD spatial;\n${sql}`)
  }
}

export const createCliNativeConnection = (profile: CliLaunchProfile) => ({
  __gtfsVizCliNative: true,
  query: async (sql: string) => {
    const response = await fetch(buildCliApiUrl(profile, "/sql"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql, sessionId: profile.sessionId }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.error || `CLI DuckDB query failed with HTTP ${response.status}`)
    }

    return createQueryResult(Array.isArray(body.rows) ? body.rows : [])
  },
  close: async () => {},
})

export const fetchCliNativeDataset = async (profile: CliLaunchProfile) => {
  const response = await fetch(buildCliApiUrl(profile, "/dataset"))
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || `CLI dataset status failed with HTTP ${response.status}`)
  }
  return body as {
    status: "ready"
    counts: {
      stops: number
      stations: number
      pathways: number
      routes?: number
    }
  }
}
