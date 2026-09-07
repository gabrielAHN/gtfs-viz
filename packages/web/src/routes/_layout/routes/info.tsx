import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { BiCalendar, BiInfoCircle } from "react-icons/bi"
import { Skeleton } from "@/components/ui/skeleton"
import { TabHeader } from "@/components/ui/tab-header"
import PageFooter from "@/components/PageFooter"
import { EditIndicator } from "@/components/ui/EditIndicator"
import { useDuckDB } from "@/context/duckdb.client"
import RouteInfo from "@/client/Routes/SelectedRoutes/RouteInfo"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import {
  fetchServiceRouteInfoData,
  fetchServiceRouteShapesData,
  fetchServiceRouteStopsData,
} from "@/lib/duckdb/DataFetching/fetchRouteData"
import { fetchStationsData } from "@/lib/duckdb/DataFetching/fetchGTFSData"

type RouteInfoSearchParams = {
  selectedRouteId?: string
}

export const Route = createFileRoute("/_layout/routes/info")({
  component: RouteInfoPage,
  validateSearch: (search: Record<string, unknown>): RouteInfoSearchParams => {
    return {
      selectedRouteId: search.selectedRouteId as string | undefined,
    }
  },
})

function RouteInfoPage() {
  const search = Route.useSearch()
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const initialized = duckDB?.initialized ?? false
  const hasTrips = duckDB?.hasTrips ?? false

  const ToggleTabs = [
    { value: "info", label: "Info", icon: <BiInfoCircle />, path: "/routes/info" },
    {
      value: "service",
      label: "Service",
      icon: <BiCalendar />,
      path: "/routes/service",
      disabled: !hasTrips,
      disabledReason: "trips.txt was not imported",
    },
  ]
  const routeId = search.selectedRouteId

  const {
    data: routeData,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["fetchServiceRouteInfoData", routeId],
    queryFn: async () => fetchServiceRouteInfoData(conn, routeId!),
    enabled: !!conn && !!routeId && initialized,
    retry: false,
  })

  const { data: routeStops = [] } = useQuery({
    queryKey: ["fetchRouteStops", routeId],
    queryFn: async () => fetchServiceRouteStopsData(conn, [routeId!]),
    enabled: !!conn && !!routeId && initialized,
    staleTime: Infinity,
  })

  const { data: routeShapes = [] } = useQuery({
    queryKey: ["fetchRouteShapes", routeId, "route-edit"],
    queryFn: async () => fetchServiceRouteShapesData(conn, [routeId!]),
    enabled: !!conn && !!routeId && initialized,
    staleTime: Infinity,
  })

  const { data: allStops = [] } = useQuery({
    queryKey: ["fetchStopsData", "StopsTable", "route-form"],
    queryFn: () =>
      fetchStationsData({
        conn,
        table: "StopsTable",
      }),
    enabled: !!conn && initialized,
    staleTime: Infinity,
  })

  const { data: allStations = [] } = useQuery({
    queryKey: ["fetchStationsData", "StationsTable", "route-form"],
    queryFn: () =>
      fetchStationsData({
        conn,
        table: "StationsTable",
      }),
    enabled: !!conn && initialized,
    staleTime: Infinity,
  })

  const routeFormData = [...routeShapes, ...routeStops, ...allStops, ...allStations]

  if (!routeId) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          No route selected. Please select a route from the routes list.
        </div>
      </div>
    )
  }

  if (!conn || !initialized || isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mx-auto mb-6 h-12 w-2/3" />
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !routeData) {
    return <div className="p-4">Error loading route information.</div>
  }

  const routeColor = routeData.route_color_hex || getRouteTypeColor(routeData.route_type_name)

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center justify-center gap-3 text-4xl font-bold">
        <EditIndicator status={routeData?.status} className="h-8 w-8" />
        <span className="h-5 w-14 rounded-sm border" style={{ backgroundColor: routeColor }} />
        <span>{routeData.route_name || routeData.route_id}</span>
      </div>
      <TabHeader
        tabs={ToggleTabs}
        searchParams={(prev) => ({ ...prev, selectedRouteId: routeId })}
        customActiveCheck={(pathname, tab) => pathname.startsWith(`/routes/${tab.value}`)}
        className="mb-4"
      />
      <RouteInfo route={routeData} routeStops={routeFormData} />
      <PageFooter />
    </div>
  )
}
