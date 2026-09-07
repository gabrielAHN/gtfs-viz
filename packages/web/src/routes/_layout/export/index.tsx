import { lazy } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { isCliSession } from "@/lib/cli/isCliSession"
import { tablePaginationSearch } from "@/lib/tablePagination"

const Export = lazy(() => import("@/client/Export"))

type ExportSearchParams = {
  view?: "category" | "table"
  selectedTripId?: string
  compareView?: "table" | "map"
  stopsPage?: number
  stopsPageSize?: number
  pathwaysPage?: number
  pathwaysPageSize?: number
  routesPage?: number
  routesPageSize?: number
  tripsPage?: number
  tripsPageSize?: number
  calendarPage?: number
  calendarPageSize?: number
  calendar_datesPage?: number
  calendar_datesPageSize?: number
}

export const Route = createFileRoute("/_layout/export/")({
  component: ExportPage,
  validateSearch: (search: Record<string, unknown>): ExportSearchParams => ({
    view: search.view === "table" ? "table" : undefined,
    selectedTripId: typeof search.selectedTripId === "string" ? search.selectedTripId : undefined,
    compareView: search.compareView === "map" ? "map" : undefined,
    ...tablePaginationSearch(search, "stops"),
    ...tablePaginationSearch(search, "pathways"),
    ...tablePaginationSearch(search, "routes"),
    ...tablePaginationSearch(search, "trips"),
    ...tablePaginationSearch(search, "calendar"),
    ...tablePaginationSearch(search, "calendar_dates"),
  }),
  beforeLoad: () => {
    if (isCliSession()) return

    const initialized = sessionStorage.getItem("gtfs_data_initialized") === "true"
    if (!initialized) {
      throw redirect({ to: "/" })
    }
  },
})

function ExportPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  return (
    <div className="p-4">
      <Export
        view={search.view ?? "category"}
        selectedTripId={search.selectedTripId}
        compareView={search.compareView ?? "table"}
        onViewChange={(view) => {
          void navigate({
            to: "/export",
            search: (previous) => ({
              ...previous,
              view: view === "table" ? "table" : undefined,
            }),
            replace: true,
            resetScroll: false,
          })
        }}
      />
    </div>
  )
}
