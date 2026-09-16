import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { BiChevronDown, BiChevronUp } from "react-icons/bi"
import { useDuckDB } from "@/context/duckdb.client"
import { cn } from "@/lib/utils"

type RouteChip = {
  route_id: string
  route_name?: string
  route_color_hex?: string
  route_text_color_hex?: string
}

const normalizeColor = (value: unknown, fallback: string) => {
  if (typeof value !== "string" || value.trim() === "") return fallback
  return value.startsWith("#") ? value : `#${value}`
}

export const parseRouteLinks = (value: unknown): RouteChip[] => {
  if (typeof value !== "string" || value.trim() === "") return []
  return value
    .split(/\n|\\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [route_id, , route_color_hex, route_text_color_hex] = entry.split("|||")
      // route_name is at index 2 in old format, but use route_id for display
      const parts = entry.split("|||")
      return {
        route_id: parts[0],
        route_name: parts[1] || parts[0],
        route_color_hex: parts[2],
        route_text_color_hex: parts[3],
      }
    })
    .filter((route) => Boolean(route.route_id))
}

const COLLAPSE_THRESHOLD = 3

export function RouteChips({
  routes,
  className,
  collapsible = false,
}: {
  routes: RouteChip[]
  className?: string
  collapsible?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const shouldCollapse = collapsible && routes.length > COLLAPSE_THRESHOLD
  const visibleRoutes = shouldCollapse && !expanded ? routes.slice(0, COLLAPSE_THRESHOLD) : routes
  const hiddenCount = shouldCollapse && !expanded ? routes.length - COLLAPSE_THRESHOLD : 0

  if (routes.length === 0) {
    return <span className="text-xs text-muted-foreground">No routes</span>
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap gap-1.5">
        {visibleRoutes.map((route) => {
          const backgroundColor = normalizeColor(route.route_color_hex, "#4f46e5")
          const color = normalizeColor(route.route_text_color_hex, "#ffffff")
          return (
            <Link
              key={route.route_id}
              to="/routes/map"
              search={{ routeId: route.route_id, selectedRouteId: route.route_id }}
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor, color }}
            >
              <span className="truncate">{route.route_name || route.route_id}</span>
            </Link>
          )
        })}
      </div>
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>
              <BiChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <BiChevronDown className="h-3.5 w-3.5" />+{hiddenCount} more route
              {hiddenCount > 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </div>
  )
}

export function RouteChipsFromLinks({
  value,
  collapsible,
}: {
  value: unknown
  collapsible?: boolean
}) {
  return <RouteChips routes={parseRouteLinks(value)} collapsible={collapsible} />
}

export function RouteChipsForStop({
  stopId,
  stationId,
  collapsible = true,
}: {
  stopId?: string
  stationId?: string
  collapsible?: boolean
}) {
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const initialized = duckDB?.initialized ?? false
  const hasStopTimes = duckDB?.hasStopTimes ?? false
  const id = stationId || stopId
  const queryName = stationId ? "station-service-routes" : "stop-service-routes"

  const { data = [] } = useQuery({
    queryKey: ["routeChips", queryName, id],
    queryFn: async () => {
      if (!conn || !id) return []
      const escaped = String(id).replace(/'/g, "''")
      const sql = stationId
        ? `SELECT route_id, route_name, route_color_hex, route_text_color_hex FROM get_station_service_routes('${escaped}')`
        : `SELECT route_id, route_name, route_color_hex, route_text_color_hex FROM get_stop_service_routes('${escaped}')`
      const result = await conn.query(sql)
      return result.toArray()
    },
    enabled: Boolean(conn && initialized && id && hasStopTimes),
    staleTime: Infinity,
  })

  if (!hasStopTimes) {
    return (
      <span className="text-xs text-muted-foreground">Routes unavailable (no stop_times.txt)</span>
    )
  }

  return <RouteChips routes={data as RouteChip[]} collapsible={collapsible} />
}
