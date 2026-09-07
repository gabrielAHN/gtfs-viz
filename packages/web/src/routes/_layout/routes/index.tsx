import { createFileRoute, redirect } from "@tanstack/react-router"
import { isCliSession } from "@/lib/cli/isCliSession"

export const Route = createFileRoute("/_layout/routes/")({
  beforeLoad: () => {
    if (!isCliSession()) {
      const initialized = sessionStorage.getItem("gtfs_data_initialized") === "true"
      const hasRoutes = sessionStorage.getItem("gtfs_has_routes") === "true"

      if (!initialized || !hasRoutes) {
        throw redirect({ to: "/" })
      }
    }

    const hasShapes = sessionStorage.getItem("gtfs_has_shapes") === "true"
    throw redirect({ to: hasShapes ? "/routes/map" : "/routes/table" })
  },
})
