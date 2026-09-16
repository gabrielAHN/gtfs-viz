import { createFileRoute, redirect } from "@tanstack/react-router"
import { isCliSession } from "@/lib/cli/isCliSession"
import Intro from "@/client/Intro"

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (isCliSession()) {
      throw redirect({ to: "/routes/table" })
    }
  },
  component: Intro,
})
