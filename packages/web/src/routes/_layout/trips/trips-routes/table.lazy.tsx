import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"
import { Skeleton } from "@/components/ui/skeleton"
import PageFooter from "@/components/PageFooter"
import AllTrips from "@/client/Trips/AllTrips"
import { fetchAllTripsData, fetchTripsTimeBounds } from "@/lib/duckdb/DataFetching/fetchRouteData"

export const Route = createLazyFileRoute("/_layout/trips/trips-routes/table")({
  component: TripsTablePage,
})

function TripsTablePage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const initialized = duckDB?.initialized ?? false
  const hasStopTimes = duckDB?.hasStopTimes ?? false

  const { data: allTrips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ["fetchAllTripsData"],
    queryFn: async () => fetchAllTripsData(conn),
    enabled: !!conn && initialized,
    staleTime: 30_000,
  })

  const { data: timeBounds, isLoading: boundsLoading } = useQuery({
    queryKey: ["fetchTripsTimeBounds"],
    queryFn: async () => fetchTripsTimeBounds(conn),
    enabled: !!conn && initialized && hasStopTimes,
    staleTime: Infinity,
  })

  const isLoading = tripsLoading || (hasStopTimes && boundsLoading)
  const tripTimeBounds: [number, number] = timeBounds
    ? [timeBounds.minTime, timeBounds.maxTime]
    : [0, 86400]

  const updateSearch = (next: Partial<Record<string, unknown>>) => {
    navigate({
      to: "/trips/table",
      search: (prev) => ({ ...prev, ...next }),
      resetScroll: false,
    })
  }

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="space-y-4 mt-2">
            {/* Filter inputs — responsive grid */}
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 ${hasStopTimes ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-2 mb-1`}
            >
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              {hasStopTimes && <Skeleton className="h-10 w-full rounded-md" />}
            </div>
            {/* Reset button */}
            <Skeleton className="h-10 w-full md:w-28 rounded-md" />
            {/* Table */}
            <div className="rounded-md border overflow-hidden">
              <div className="border-b px-4 py-3">
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1 min-w-[60px] max-w-[100px] rounded" />
                  ))}
                </div>
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  {Array.from({ length: 6 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 flex-1 min-w-[40px] max-w-[100px] rounded" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <AllTrips
            allTrips={allTrips}
            tripTimeBounds={tripTimeBounds}
            hasStopTimes={hasStopTimes}
            search={search}
            updateSearch={updateSearch}
          />
        )}
        <PageFooter />
      </div>
    </div>
  )
}
