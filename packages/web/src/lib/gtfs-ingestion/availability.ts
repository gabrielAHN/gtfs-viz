export type GTFSDataAvailability = {
  stations: number
  stops: number
  pathways: number
  routes: number
  hasStations: boolean
  hasStops: boolean
  hasRoutes: boolean
  hasTrips: boolean
  hasStopTimes: boolean
  hasShapes: boolean
  hasCalendar: boolean
}

const toNumber = (value: unknown) => Number(value || 0)

const toBoolean = (value: unknown) => value === true || value === "true" || value === 1

async function tableHasRows(conn: any, tableName: string): Promise<boolean> {
  try {
    const result = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name = '${tableName}'`,
    )
    if (toNumber(result.toArray()[0]?.n) === 0) return false
    const countResult = await conn.query(`SELECT COUNT(*) AS n FROM ${tableName} LIMIT 1`)
    return toNumber(countResult.toArray()[0]?.n) > 0
  } catch {
    return false
  }
}

export async function fetchGTFSDataAvailability(conn: any): Promise<GTFSDataAvailability> {
  const result = await conn.query("SELECT * FROM get_gtfs_data_availability()")
  const row = result.toArray()[0] || {}

  const [hasTrips, hasStopTimes, hasShapes, hasCalendar] = await Promise.all([
    tableHasRows(conn, "trips"),
    tableHasRows(conn, "stop_times"),
    tableHasRows(conn, "shapes"),
    tableHasRows(conn, "calendar"),
  ])

  return {
    stations: toNumber(row.stations),
    stops: toNumber(row.stops),
    pathways: toNumber(row.pathways),
    routes: toNumber(row.routes),
    hasStations: toBoolean(row.has_stations),
    hasStops: toBoolean(row.has_stops),
    hasRoutes: toBoolean(row.has_routes),
    hasTrips,
    hasStopTimes,
    hasShapes,
    hasCalendar,
  }
}

const FILE_KEYS = [
  "gtfs_has_stations",
  "gtfs_has_stops",
  "gtfs_has_routes",
  "gtfs_has_trips",
  "gtfs_has_stop_times",
  "gtfs_has_shapes",
  "gtfs_has_calendar",
] as const

export function writeGTFSAvailabilityToStorage(availability: GTFSDataAvailability) {
  sessionStorage.setItem("gtfs_data_initialized", "true")

  const flags: Record<string, boolean> = {
    gtfs_has_stations: availability.hasStations,
    gtfs_has_stops: availability.hasStops,
    gtfs_has_routes: availability.hasRoutes,
    gtfs_has_trips: availability.hasTrips,
    gtfs_has_stop_times: availability.hasStopTimes,
    gtfs_has_shapes: availability.hasShapes,
    gtfs_has_calendar: availability.hasCalendar,
  }

  for (const key of FILE_KEYS) {
    if (flags[key]) sessionStorage.setItem(key, "true")
    else sessionStorage.removeItem(key)
  }
}

export function clearGTFSAvailabilityStorage() {
  sessionStorage.removeItem("gtfs_data_initialized")
  for (const key of FILE_KEYS) sessionStorage.removeItem(key)
}
