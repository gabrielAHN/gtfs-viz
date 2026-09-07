import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"
import { Skeleton } from "@/components/ui/skeleton"
import { TabHeader } from "@/components/ui/tab-header"
import PageFooter from "@/components/PageFooter"
import { BiCalendar, BiInfoCircle } from "react-icons/bi"
import { fetchServiceRouteInfoData } from "@/lib/duckdb/DataFetching/fetchRouteData"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import { EditIndicator } from "@/components/ui/EditIndicator"

export const Route = createFileRoute("/_layout/routes/route/$routeId")({
  component: RouteLayout,
})

function RouteLayout() {
  const { routeId } = Route.useParams()
  const { conn, initialized } = useDuckDB()

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["fetchServiceRouteInfoData", routeId],
    queryFn: async () => fetchServiceRouteInfoData(conn, routeId),
    enabled: !!conn && !!routeId && initialized,
    retry: false,
  })

  if (isLoading || isFetching) {
    return (
      <div className="p-4">
        <Skeleton className="mx-auto mb-6 h-12 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4">Error loading route information.</div>
  }

  if (!data) {
    return <div className="p-4">No route information available.</div>
  }

  const routeColor = getRouteTypeColor(data.route_type_name)
  const ToggleTabs = [
    {
      value: "info",
      label: "Info",
      icon: <BiInfoCircle />,
      path: "/routes/info",
    },
    {
      value: "service",
      label: "Service",
      icon: <BiCalendar />,
      path: "/routes/service",
    },
  ]

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center justify-center gap-3 text-4xl font-bold">
        <EditIndicator status={data?.status} className="h-8 w-8" />
        <span className="h-5 w-14 rounded-sm border" style={{ backgroundColor: routeColor }} />
        <span>{data.route_name || data.route_id}</span>
      </div>
      <TabHeader
        tabs={ToggleTabs}
        searchParams={(prev) => ({ ...prev, selectedRouteId: routeId })}
        customActiveCheck={(pathname, tab) => pathname.endsWith(`/${tab.value}`)}
        className="mb-4"
      />
      <Outlet context={{ routeData: data }} />
      <PageFooter />
    </div>
  )
}
