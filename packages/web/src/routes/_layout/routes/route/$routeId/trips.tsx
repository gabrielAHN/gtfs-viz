import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/routes/route/$routeId/trips")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/routes/service",
      search: { selectedRouteId: params.routeId },
    })
  },
})
