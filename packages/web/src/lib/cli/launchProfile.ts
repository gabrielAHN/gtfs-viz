export type CliLaunchProfile = {
  source: string
  sessionId: string
  apiBase: string
  view: string
  selectedStationId?: string
  selectedStopId?: string
  selectedRouteId?: string
  selectedNodeId?: string
  fromStopId?: string
  toStopId?: string
  stationFilter?: string
  stopFilter?: string
  routeFilter?: string
  mapFocus?: string
}

type LaunchTarget = {
  to:
    | "/stations/info"
    | "/stations/map"
    | "/stations/pathways/flow/radial"
    | "/stations/pathways/map/directional"
    | "/stations/pathways/table/start"
    | "/stations/pathways/table/end"
    | "/stations/table"
    | "/routes/map"
    | "/routes/table"
    | "/stops/map"
    | "/stops/table"
  search: Record<string, unknown>
}

const storageKey = "gtfs_viz_cli_launch_profile"

const getWindow = () => {
  if (typeof window === "undefined") return null
  return window
}

const readProfileFromSearch = (search: string): CliLaunchProfile | null => {
  const params = new URLSearchParams(search)
  const source = params.get("gtfsSource")
  const sessionId = params.get("cliSession")
  const apiBase = params.get("cliApi")

  if (!source || !sessionId || !apiBase) {
    return null
  }

  return {
    source,
    sessionId,
    apiBase,
    view: params.get("cliView") || "auto",
    selectedStationId:
      params.get("cliSelectedStation") || params.get("selectedStationId") || undefined,
    selectedStopId: params.get("cliSelectedStop") || params.get("selectedStopId") || undefined,
    selectedRouteId: params.get("cliSelectedRoute") || params.get("selectedRouteId") || undefined,
    selectedNodeId: params.get("cliSelectedNode") || params.get("selectedNodeId") || undefined,
    fromStopId: params.get("cliFromStop") || params.get("fromStop") || undefined,
    toStopId: params.get("cliToStop") || params.get("toStop") || undefined,
    stationFilter: params.get("cliStationFilter") || undefined,
    stopFilter: params.get("cliStopFilter") || undefined,
    routeFilter: params.get("cliRouteFilter") || undefined,
    mapFocus: params.get("cliMapFocus") || undefined,
  }
}

export const readCliLaunchProfileFromUrl = () => {
  const currentWindow = getWindow()
  if (!currentWindow) return null

  const profile = readProfileFromSearch(currentWindow.location.search)
  if (profile) {
    currentWindow.sessionStorage.setItem(storageKey, JSON.stringify(profile))
  }
  return profile
}

export const getStoredCliLaunchProfile = () => {
  const currentWindow = getWindow()
  if (!currentWindow) return null

  const profile = readProfileFromSearch(currentWindow.location.search)
  if (profile) {
    currentWindow.sessionStorage.setItem(storageKey, JSON.stringify(profile))
    return profile
  }

  const stored = currentWindow.sessionStorage.getItem(storageKey)
  if (!stored) return null

  try {
    return JSON.parse(stored) as CliLaunchProfile
  } catch {
    currentWindow.sessionStorage.removeItem(storageKey)
    return null
  }
}

export const buildCliApiUrl = (profile: CliLaunchProfile, path: string) => {
  const currentWindow = getWindow()
  const base = currentWindow?.location.origin || "http://127.0.0.1"
  const apiBase = profile.apiBase.endsWith("/") ? profile.apiBase.slice(0, -1) : profile.apiBase
  const apiPath = path.startsWith("/") ? path : `/${path}`
  return new URL(`${apiBase}${apiPath}`, base).toString()
}

export const postCliStatus = async (
  profile: CliLaunchProfile | null,
  status: string,
  message?: string,
  error?: string,
) => {
  if (!profile) return
  await fetch(buildCliApiUrl(profile, "/status"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sessionId: profile.sessionId,
      status,
      message,
      error,
    }),
  }).catch(() => {})
}

const escapeSql = (value: string) => value.replace(/'/g, "''")

const resolveFilterSearch = async (
  conn: any,
  table: "StationsTable" | "StopsTable",
  value: string,
) => {
  try {
    const result = await conn.query(`
      SELECT stop_id, stop_name
      FROM ${table}
      WHERE stop_id = '${escapeSql(value)}'
         OR stop_name = '${escapeSql(value)}'
      LIMIT 1
    `)
    const row = result.toArray()[0]
    if (row?.stop_id === value) return { stopId: value }
    if (row?.stop_name === value) return { stopName: value }
  } catch {}
  return { stopId: value }
}

const resolveRouteFilterSearch = async (conn: any, value: string) => {
  try {
    const result = await conn.query(`
      SELECT route_id, route_name
      FROM RoutesTable
      WHERE route_id = '${escapeSql(value)}'
         OR route_name = '${escapeSql(value)}'
         OR route_short_name = '${escapeSql(value)}'
         OR route_long_name = '${escapeSql(value)}'
      LIMIT 1
    `)
    const row = result.toArray()[0]
    if (row?.route_id === value) return { routeId: value }
    if (row?.route_name === value) return { routeName: value }
  } catch {}
  return { routeId: value }
}

const resolveSelectedId = async (
  conn: any,
  table: "StationsTable" | "StopsTable",
  value: string,
) => {
  try {
    const escaped = escapeSql(value)
    const result = await conn.query(`
      SELECT stop_id
      FROM ${table}
      WHERE stop_id = '${escaped}'
         OR LOWER(stop_id) = LOWER('${escaped}')
         OR stop_name = '${escaped}'
         OR LOWER(stop_name) = LOWER('${escaped}')
         OR LOWER(stop_id) LIKE '%' || LOWER('${escaped}') || '%'
         OR LOWER(stop_name) LIKE '%' || LOWER('${escaped}') || '%'
      ORDER BY
        CASE
          WHEN stop_id = '${escaped}' THEN 1
          WHEN LOWER(stop_id) = LOWER('${escaped}') THEN 2
          WHEN stop_name = '${escaped}' THEN 3
          WHEN LOWER(stop_name) = LOWER('${escaped}') THEN 4
          WHEN LOWER(stop_id) LIKE '%' || LOWER('${escaped}') || '%' THEN 5
          ELSE 6
        END,
        stop_name,
        stop_id
      LIMIT 1
    `)
    const row = result.toArray()[0]
    if (row?.stop_id) return row.stop_id
  } catch {}
  return value
}

const resolveSelectedRouteId = async (conn: any, value: string) => {
  try {
    const escaped = escapeSql(value)
    const result = await conn.query(`
      SELECT route_id
      FROM RoutesTable
      WHERE route_id = '${escaped}'
         OR LOWER(route_id) = LOWER('${escaped}')
         OR route_name = '${escaped}'
         OR LOWER(route_name) = LOWER('${escaped}')
         OR route_short_name = '${escaped}'
         OR LOWER(route_short_name) = LOWER('${escaped}')
         OR route_long_name = '${escaped}'
         OR LOWER(route_long_name) = LOWER('${escaped}')
         OR LOWER(route_id) LIKE '%' || LOWER('${escaped}') || '%'
         OR LOWER(route_name) LIKE '%' || LOWER('${escaped}') || '%'
      ORDER BY
        CASE
          WHEN route_id = '${escaped}' THEN 1
          WHEN LOWER(route_id) = LOWER('${escaped}') THEN 2
          WHEN route_name = '${escaped}' THEN 3
          WHEN LOWER(route_name) = LOWER('${escaped}') THEN 4
          WHEN LOWER(route_id) LIKE '%' || LOWER('${escaped}') || '%' THEN 5
          ELSE 6
        END,
        route_name,
        route_id
      LIMIT 1
    `)
    const row = result.toArray()[0]
    if (row?.route_id) return row.route_id
  } catch {}
  return value
}

export const resolveCliLaunchTarget = async ({
  conn,
  profile,
  hasStations,
}: {
  conn: any
  profile: CliLaunchProfile | null
  hasStations: boolean
}): Promise<LaunchTarget> => {
  const hasRoutes = sessionStorage.getItem("gtfs_has_routes") === "true"
  const hasShapes = sessionStorage.getItem("gtfs_has_shapes") === "true"
  const requestedView = profile?.view || "auto"
  const view =
    requestedView === "auto"
      ? profile?.selectedRouteId
        ? hasShapes
          ? "routes/map"
          : "routes/table"
        : hasRoutes && hasShapes
          ? "routes/map"
          : hasRoutes
            ? "routes/table"
            : hasStations
              ? "stations/map"
              : "stops/map"
      : requestedView

  const to = `/${view}` as LaunchTarget["to"]
  const search: Record<string, unknown> = {}

  if (view.startsWith("stations/")) {
    if (profile?.selectedStationId) {
      search.selectedStationId = await resolveSelectedId(
        conn,
        "StationsTable",
        profile.selectedStationId,
      )
    }
    if (profile?.stationFilter) {
      Object.assign(search, await resolveFilterSearch(conn, "StationsTable", profile.stationFilter))
    }
    if (view.startsWith("stations/pathways/") && profile?.selectedNodeId) {
      search.selectedNodeId = profile.selectedNodeId
    }
    if (view.startsWith("stations/pathways/") && profile?.fromStopId) {
      search.fromStop = profile.fromStopId
    }
    if (view.startsWith("stations/pathways/") && profile?.toStopId) {
      search.toStop = profile.toStopId
    }
  }

  if (view.startsWith("stops/")) {
    if (profile?.selectedStopId) {
      search.selectedStopId = await resolveSelectedId(conn, "StopsTable", profile.selectedStopId)
    }
    if (profile?.stopFilter) {
      Object.assign(search, await resolveFilterSearch(conn, "StopsTable", profile.stopFilter))
    }
  }

  if (view.startsWith("routes/")) {
    if (profile?.selectedRouteId) {
      search.selectedRouteId = await resolveSelectedRouteId(conn, profile.selectedRouteId)
    }
    if (profile?.routeFilter) {
      Object.assign(search, await resolveRouteFilterSearch(conn, profile.routeFilter))
    }
  }

  if ((view.endsWith("/map") || view.includes("/map/")) && profile?.mapFocus) {
    search.mapFocus = profile.mapFocus
  }

  return { to, search }
}
