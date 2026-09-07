import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/routes/trips")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/routes/service",
      search,
    })
  },
})
