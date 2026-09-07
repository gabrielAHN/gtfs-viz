import { createFileRoute, redirect } from "@tanstack/react-router"
import { isCliSession } from "@/lib/cli/isCliSession"
import { logger } from "@/lib/logger"

export const Route = createFileRoute("/_layout/stops/")({
  beforeLoad: async ({ context }: any) => {
    if (!isCliSession()) {
      const initialized = sessionStorage.getItem("gtfs_data_initialized") === "true"
      const hasStops = sessionStorage.getItem("gtfs_has_stops") === "true"

      if (!initialized || !hasStops) {
        throw redirect({ to: "/" })
      }

      const conn = context?.duckdb?.conn

      if (!conn) {
        logger.warn("DuckDB connection not available")
        return
      }

      try {
        await conn.query(`SELECT 1 FROM StopsTable LIMIT 1`)
      } catch (error) {
        logger.warn("StopsTable does not exist or has no data, redirecting to home")
        sessionStorage.removeItem("gtfs_data_initialized")
        sessionStorage.removeItem("gtfs_has_stops")
        throw redirect({ to: "/" })
      }
    }

    throw redirect({ to: "/stops/map" })
  },
})
