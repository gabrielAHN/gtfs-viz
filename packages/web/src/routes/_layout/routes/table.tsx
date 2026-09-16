import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"
import { Skeleton } from "@/components/ui/skeleton"
import { TabHeader } from "@/components/ui/tab-header"
import { BiMap, BiTable } from "react-icons/bi"
import RoutesHeader from "@/client/Routes/AllRoutes/Header"
import RouteTable from "@/client/Routes/AllRoutes/RouteTable"
import PageFooter from "@/components/PageFooter"
import EntityForm from "@/components/forms/EntityForm"
import { buildRouteNameOptions, routeMatchesNameFilter } from "@/client/Routes/routeFilters"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import {
  fetchServiceRouteShapesData,
  fetchServiceRoutesData,
} from "@/lib/duckdb/DataFetching/fetchRouteData"
import { fetchStationsData } from "@/lib/duckdb/DataFetching/fetchGTFSData"
import { mutationDeleteRouteFn } from "@/lib/duckdb/DataEditing/editRoutes"
import { refreshRoutesTables } from "@/lib/extensions"
import { tablePaginationSearch } from "@/lib/tablePagination"

type RoutesTableSearchParams = {
  routeId?: string
  routeName?: string
  routeType?: string[]
  selectedRouteId?: string
  page?: number
  pageSize?: number
}

export const Route = createFileRoute("/_layout/routes/table")({
  component: RoutesTablePage,
  validateSearch: (search: Record<string, unknown>): RoutesTableSearchParams => {
    return {
      routeId: search.routeId as string | undefined,
      routeName: search.routeName as string | undefined,
      routeType: Array.isArray(search.routeType)
        ? (search.routeType as string[])
        : search.routeType
          ? [search.routeType as string]
          : undefined,
      selectedRouteId: search.selectedRouteId as string | undefined,
      ...tablePaginationSearch(search),
    }
  },
})

function RoutesTablePage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const hasShapes = duckDB?.hasShapes ?? false

  const ToggleTabs = [
    ...(hasShapes ? [{ value: "map", label: "Map", icon: <BiMap />, path: "/routes/map" }] : []),
    { value: "table", label: "Table", icon: <BiTable />, path: "/routes/table" },
  ]

  const [ClickInfo, setClickInfo] = useState<any>()
  const [Open, setOpen] = useState<{ formType: string | null; state: boolean }>({
    formType: null,
    state: false,
  })
  const [tableSorting, setTableSorting] = useState([])
  const [clearSortingTrigger, setClearSortingTrigger] = useState(0)
  const clearingSelectionRef = useRef(false)

  const routeId = search.routeId
  const routeName = search.routeName
  const routeType = search.routeType

  const { data: allRoutes = [], isLoading: allRoutesLoading } = useQuery({
    queryKey: ["fetchRoutesData", "RoutesTable"],
    queryFn: async () => {
      return fetchServiceRoutesData(conn)
    },
    enabled: !!conn,
    staleTime: Infinity,
  })

  const routesForIdFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName))
    if (routeType && routeType.length > 0)
      filtered = filtered.filter((r: any) => routeType.includes(r.route_type_name))
    return filtered
  }, [allRoutes, routeName, routeType])

  const routesForNameFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId)
    if (routeType && routeType.length > 0)
      filtered = filtered.filter((r: any) => routeType.includes(r.route_type_name))
    return filtered
  }, [allRoutes, routeId, routeType])

  const routesForTypeFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId)
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName))
    return filtered
  }, [allRoutes, routeId, routeName])

  const availableRouteIds = useMemo(() => {
    return routesForIdFilter
      .filter((r: any) => r.route_id)
      .map((r: any) => ({
        label: String(r.route_id),
        value: String(r.route_id),
        color: r.route_color_hex || getRouteTypeColor(r.route_type_name),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [routesForIdFilter])

  const availableRouteNames = useMemo(
    () => buildRouteNameOptions(routesForNameFilter),
    [routesForNameFilter],
  )

  const availableRouteTypes = useMemo(() => {
    return Array.from(
      new Set(routesForTypeFilter.map((route: any) => route.route_type_name).filter(Boolean)),
    )
      .sort()
      .map((type) => ({
        label: String(type),
        value: String(type),
        color: getRouteTypeColor(String(type)),
      }))
  }, [routesForTypeFilter])

  const filteredData = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId)
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName))
    if (routeType && routeType.length > 0) {
      filtered = filtered.filter((r: any) => routeType.includes(r.route_type_name))
    }
    return filtered
  }, [allRoutes, routeId, routeName, routeType])

  const allRouteIds = useMemo(
    () => allRoutes.map((route: any) => String(route.route_id)).filter(Boolean),
    [allRoutes],
  )

  // Form data — single route shapes for edit, stops/stations for map context
  const formOpen = Open.state
  const editRouteId = ClickInfo?.route_id

  const { data: editRouteShapes = [] } = useQuery({
    queryKey: ["fetchRouteShapes", editRouteId, "route-edit"],
    queryFn: async () => fetchServiceRouteShapesData(conn, [editRouteId]),
    enabled: !!conn && !!editRouteId,
    staleTime: Infinity,
  })

  const { data: allStops = [] } = useQuery({
    queryKey: ["fetchStopsData", "StopsTable", "route-form"],
    queryFn: () => fetchStationsData({ conn, table: "StopsTable" }),
    enabled: !!conn && formOpen,
    staleTime: Infinity,
  })

  const { data: allStations = [] } = useQuery({
    queryKey: ["fetchStationsData", "StationsTable", "route-form"],
    queryFn: () => fetchStationsData({ conn, table: "StationsTable" }),
    enabled: !!conn && formOpen,
    staleTime: Infinity,
  })

  const routeFormData = useMemo(
    () => [...editRouteShapes, ...allStops, ...allStations],
    [editRouteShapes, allStations, allStops],
  )

  useEffect(() => {
    if (!search.selectedRouteId) {
      clearingSelectionRef.current = false
      if (ClickInfo) setClickInfo(undefined)
      return
    }

    if (clearingSelectionRef.current) return

    const selected = filteredData.find(
      (route: any) => String(route.route_id) === String(search.selectedRouteId),
    )

    if (!selected) {
      if (ClickInfo) setClickInfo(undefined)
      return
    }

    if (String(ClickInfo?.route_id) !== String(selected.route_id)) {
      setClickInfo(selected)
    }
  }, [search.selectedRouteId, filteredData, ClickInfo])

  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async (route: any) => {
      return mutationDeleteRouteFn({ conn, SelectRoute: route })
    },
    onSuccess: async () => {
      await refreshRoutesTables(conn)
      ;["fetchRoutesData", "fetchRouteShapes", "fetchRouteStops", "routeChips"].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      )
      setClickInfo(undefined)
      updateSearch({ selectedRouteId: undefined })
    },
  })

  const hasActiveFilters = Boolean(routeId || routeName || (routeType && routeType.length > 0))

  const updateSearch = (next: Partial<RoutesTableSearchParams>) => {
    navigate({
      to: "/routes/table",
      search: (prev) => ({ ...prev, ...next }),
      resetScroll: false,
    })
  }

  const clearFilters = () => {
    navigate({
      to: "/routes/table",
      search: (prev) => ({
        ...prev,
        routeId: undefined,
        routeName: undefined,
        routeType: undefined,
        selectedRouteId: undefined,
      }),
      resetScroll: false,
    })
    setClickInfo(undefined)
    setClearSortingTrigger((prev) => prev + 1)
  }

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4">
        <TabHeader
          tabs={ToggleTabs}
          searchParams={(prev) => ({
            routeId: prev.routeId,
            routeName: prev.routeName,
            routeType: prev.routeType,
            selectedRouteId: prev.selectedRouteId,
          })}
        />
        <RoutesHeader
          setOpen={setOpen}
          RouteIdData={availableRouteIds}
          RouteIdDropdown={routeId || ""}
          setRouteIdDropdown={(value) => updateSearch({ routeId: value || undefined })}
          RouteNameData={availableRouteNames}
          RouteNameDropDown={routeName || ""}
          setRouteNameDropDown={(value) => updateSearch({ routeName: value || undefined })}
          RouteTypeData={availableRouteTypes}
          RouteTypeDropDown={routeType || []}
          setRouteTypeDropDown={(values) =>
            updateSearch({ routeType: values.length ? values : undefined })
          }
          onResetFilters={clearFilters}
          isResetDisabled={!hasActiveFilters && tableSorting.length === 0}
        />
        {allRoutesLoading ? (
          <Skeleton className="h-[74vh] w-full" />
        ) : (
          <>
            <EntityForm
              Data={routeFormData}
              OpenValue={Open}
              setOpenValue={setOpen}
              ClickInfo={ClickInfo}
              setClickInfo={setClickInfo}
              type="route"
            />
            <RouteTable
              data={filteredData}
              ClickInfo={ClickInfo}
              setClickInfo={(route: any) => {
                const nextRoute = ClickInfo?.route_id === route?.route_id ? undefined : route
                clearingSelectionRef.current = !nextRoute
                setClickInfo(nextRoute)
                updateSearch({ selectedRouteId: nextRoute?.route_id || undefined })
              }}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              onSortingChange={setTableSorting}
              clearSortingTrigger={clearSortingTrigger}
              onEdit={() => setOpen({ formType: "edit", state: true })}
              onDelete={(route: any) => deleteMutation.mutate(route)}
              isDeleting={deleteMutation.isPending}
              hasStopTimes={duckDB?.hasStopTimes ?? false}
            />
          </>
        )}
        <PageFooter />
      </div>
    </div>
  )
}
