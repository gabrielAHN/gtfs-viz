import { useQuery } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"
import { executeQuery } from "@/lib/duckdb/QueryHelper"
import { ensureRerouteEditColumns } from "@/lib/duckdb/DataEditing/rerouteTrip"

export interface EditsOverview {
  trips: Record<string, any>[]
  stopTimes: Record<string, any>[]
  calendar: Record<string, any>[]
  calendarDates: Record<string, any>[]
  stops: Record<string, any>[]
  pathways: Record<string, any>[]
  routes: Record<string, any>[]
  /** service_id → a route_id serving it, for deep-linking into /routes/service */
  serviceRoute: Record<string, string>
}

/**
 * Reads every Edit*Table once and buckets the rows by change category.
 * Shared by ChangeSummary and CategoryView. Short staleTime so CLI-applied edits
 * appear shortly after they land in the shared DuckDB.
 */
export function useEditsOverview() {
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const initialized = duckDB?.initialized ?? false

  return useQuery<EditsOverview>({
    queryKey: ["editsOverview"],
    enabled: !!conn && initialized,
    staleTime: 1000,
    queryFn: async () => {
      await ensureRerouteEditColumns(conn)
      // Sequential (not Promise.all) — duckdb-wasm connections run one query at a time.
      const q = async (sql: string) => {
        try {
          return await executeQuery(conn, sql)
        } catch {
          return [] as Record<string, any>[]
        }
      }
      const trips = await q(
        "SELECT trip_id, route_id, service_id, trip_headsign, direction_id, status FROM EditTripsTable",
      )
      const stopTimes = await q(
        `WITH summary AS (
           SELECT trip_id,
                  COUNT(*) FILTER (WHERE status = 'new') AS added,
                  COUNT(*) FILTER (WHERE status = 'new edit') AS retimed,
                  COUNT(*) FILTER (WHERE status = 'deleted') AS removed,
                  COUNT(*) FILTER (
                    WHERE edit_type IS NULL OR edit_type <> 'reroute'
                  ) AS non_reroute_rows,
                  MAX(edit_type) FILTER (WHERE edit_type = 'reroute') AS edit_type,
                  MAX(edit_source_trip_id) FILTER (WHERE edit_type = 'reroute') AS edit_source_trip_id,
                  MAX(edit_from_stop_name) FILTER (WHERE edit_type = 'reroute') AS edit_from_stop_name,
                  MAX(edit_to_stop_name) FILTER (WHERE edit_type = 'reroute') AS edit_to_stop_name
           FROM EditStopTimesTable
           GROUP BY trip_id
         )
         SELECT summary.*,
                COALESCE(route.route_short_name, route.route_name, donor.route_id) AS reroute_route_name
         FROM summary
         LEFT JOIN trips donor ON donor.trip_id = summary.edit_source_trip_id
         LEFT JOIN RoutesView route ON route.route_id = donor.route_id
         ORDER BY summary.trip_id`,
      )
      const calendar = await q(
        "SELECT service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, status FROM EditCalendarTable ORDER BY service_id",
      )
      const calendarDates = await q(
        "SELECT row_id, service_id, date, exception_type, status FROM EditCalendarDatesTable ORDER BY service_id, date",
      )
      const stops = await q(
        "SELECT stop_id, stop_name, location_type_name, status FROM EditStopTable ORDER BY stop_id",
      )
      const pathways = await q(
        "SELECT pathway_id, from_stop_id, to_stop_id, status FROM EditPathwayTable ORDER BY pathway_id",
      )
      const routes = await q(
        "SELECT route_id, route_short_name, route_long_name, status FROM EditRouteTable ORDER BY route_id",
      )
      const svcRoutes = await q(
        "SELECT DISTINCT service_id, route_id FROM TripsTable WHERE service_id IS NOT NULL AND route_id IS NOT NULL",
      )
      const serviceRoute: Record<string, string> = {}
      for (const r of svcRoutes) serviceRoute[String(r.service_id)] = String(r.route_id)

      return { trips, stopTimes, calendar, calendarDates, stops, pathways, routes, serviceRoute }
    },
  })
}
