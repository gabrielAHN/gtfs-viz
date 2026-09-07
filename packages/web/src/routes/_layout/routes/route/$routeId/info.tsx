import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/routes/route/$routeId/info")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/routes/info",
      search: { selectedRouteId: params.routeId },
    })
  },
})
