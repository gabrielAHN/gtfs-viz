import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import Header from "@/client/Header"
import { isCliSession } from "@/lib/cli/isCliSession"

export const Route = createFileRoute("/_layout")({
  beforeLoad: () => {
    if (isCliSession()) return

    const isInitialized = sessionStorage.getItem("gtfs_data_initialized") === "true"
    if (!isInitialized) {
      throw redirect({ to: "/" })
    }
  },
  component: LayoutComponent,
})

function LayoutComponent() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  )
}
