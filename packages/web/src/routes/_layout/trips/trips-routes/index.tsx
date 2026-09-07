import { createFileRoute, redirect } from "@tanstack/react-router"
import { isCliSession } from "@/lib/cli/isCliSession"

export const Route = createFileRoute("/_layout/trips/trips-routes/")({
  beforeLoad: () => {
    if (!isCliSession()) {
      const initialized = sessionStorage.getItem("gtfs_data_initialized") === "true"
      const hasTrips = sessionStorage.getItem("gtfs_has_trips") === "true"

      if (!initialized || !hasTrips) {
        throw redirect({ to: "/" })
      }
    }

    throw redirect({ to: "/trips/table" })
  },
})
