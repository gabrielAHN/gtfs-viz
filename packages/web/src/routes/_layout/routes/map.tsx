import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { isCliSession } from "@/lib/cli/isCliSession"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"
import { Skeleton } from "@/components/ui/skeleton"
import { TabHeader } from "@/components/ui/tab-header"
import { BiMap, BiTable } from "react-icons/bi"
import RoutesHeader from "@/client/Routes/AllRoutes/Header"
import RoutesMap from "@/client/Routes/AllRoutes/RoutesMap"
import PageFooter from "@/components/PageFooter"
import EntityForm from "@/components/forms/EntityForm"
import { buildRouteNameOptions, routeMatchesNameFilter } from "@/client/Routes/routeFilters"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import {
  fetchServiceRouteShapesData,
  fetchRouteShapePaths,
  shapeRowsToPaths,
  fetchServiceRouteStopsData,
  fetchServiceRoutesData,
  bandedRouteIds,
  routeShapeLanesReady,
  prepareRouteShapeLanes,
  finishRouteShapeBands,
} from "@/lib/duckdb/DataFetching/fetchRouteData"
import { parseRouteLineValue } from "@/components/forms/RouteLineInput/routeLine"
import { fetchStationsData } from "@/lib/duckdb/DataFetching/fetchGTFSData"
import { mutationDeleteRouteFn } from "@/lib/duckdb/DataEditing/editRoutes"
import { refreshRoutesTables } from "@/lib/extensions"

type RoutesMapSearchParams = {
  routeId?: string
  routeName?: string
  routeType?: string[]
  brand?: string[]
  selectedRouteId?: string
  mapFocus?: string
}

export const Route = createFileRoute("/_layout/routes/map")({
  component: RoutesMapPage,
  validateSearch: (search: Record<string, unknown>): RoutesMapSearchParams => {
    return {
      routeId: search.routeId as string | undefined,
      routeName: search.routeName as string | undefined,
      routeType: Array.isArray(search.routeType)
        ? (search.routeType as string[])
        : search.routeType
          ? [search.routeType as string]
          : undefined,
      brand: Array.isArray(search.brand)
        ? (search.brand as string[])
        : search.brand
          ? [search.brand as string]
          : undefined,
      selectedRouteId: search.selectedRouteId as string | undefined,
      mapFocus: search.mapFocus as string | undefined,
    }
  },
  beforeLoad: ({ search }) => {
    if (isCliSession()) return
    const hasShapes = sessionStorage.getItem("gtfs_has_shapes") === "true"
    if (!hasShapes) {
      throw redirect({
        to: "/routes/table",
        search: {
          routeId: (search as any).routeId || (search as any).selectedRouteId,
          routeName: (search as any).routeName,
          routeType: (search as any).routeType,
          selectedRouteId: (search as any).selectedRouteId,
        },
      })
    }
  },
})

const ToggleTabs = [
  { value: "map", label: "Map", icon: <BiMap />, path: "/routes/map" },
  { value: "table", label: "Table", icon: <BiTable />, path: "/routes/table" },
]

const routeBrand = (r: any): string => String(r?.agency_id ?? "").trim()

function RoutesMapPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { conn } = useDuckDB() ?? {}
  const queryClient = useQueryClient()

  const [ClickInfo, setClickInfo] = useState<any>()
  const [Open, setOpen] = useState<{ formType: string | null; state: boolean }>({
    formType: null,
    state: false,
  })
  const [viewState, setViewState] = useState<any>()
  const [cleanup, setCleanup] = useState(false)
  const clearingSelectionRef = useRef(false)

  const routeId = search.routeId
  const routeName = search.routeName
  const routeType = search.routeType
  const brand = search.brand

  useEffect(() => {
    if (!search.mapFocus) return
    const [latitude, longitude, zoom] = search.mapFocus
      .split(",")
      .map((value) => Number(value.trim()))
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(zoom)) {
      setViewState({ latitude, longitude, zoom })
    }
  }, [search.mapFocus])

  const { data: allRoutes = [], isLoading: allRoutesLoading } = useQuery({
    queryKey: ["fetchRoutesData", "RoutesTable"],
    queryFn: async () => {
      return fetchServiceRoutesData(conn)
    },
    enabled: !!conn,
    staleTime: Infinity,
  })

  const filteredData = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId)
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName))
    if (routeType && routeType.length > 0) {
      filtered = filtered.filter((r: any) => routeType.includes(r.route_type_name))
    }
    if (brand && brand.length > 0) {
      filtered = filtered.filter((r: any) => brand.includes(routeBrand(r)))
    }
    return filtered
  }, [allRoutes, routeId, routeName, routeType, brand])

  const routeIds = useMemo(
    () => filteredData.map((route: any) => String(route.route_id)),
    [filteredData],
  )

  const allRouteIds = useMemo(
    () => allRoutes.map((route: any) => String(route.route_id)).filter(Boolean),
    [allRoutes],
  )

  const shouldFetchShapes = routeIds.length > 0

  const [shapeChunks, setShapeChunks] = useState<any[][]>([])
  const [shapeProgress, setShapeProgress] = useState<{
    done: number
    total: number
    phase: string
  } | null>(null)
  const shapeChunkCacheRef = useRef<Map<string, any[]>>(new Map())
  const bandsAttemptedRef = useRef<Set<string>>(new Set())
  const interactionRef = useRef(0)
  const noteInteraction = useCallback(() => {
    interactionRef.current = performance.now()
  }, [])
  const routeIdsKey = routeIds.join("")
  const routeTypeKey = (routeType || []).join("")
  useEffect(() => {
    if (!conn || !shouldFetchShapes) {
      setShapeChunks([])
      setShapeProgress(null)
      return
    }
    let cancelled = false
    const CHUNK_SIZE = 12
    const rank = (name?: string) => {
      const n = (name || "").toLowerCase()
      if (n.includes("bus") || n.includes("trolley")) return 2
      if (n.includes("ferry") || n.includes("boat") || n.includes("water")) return 1
      return 0
    }
    const ordered = [...filteredData]
      .sort(
        (a: any, b: any) =>
          rank(a.route_type_name) - rank(b.route_type_name) ||
          String(a.route_id).localeCompare(String(b.route_id)),
      )
      .map((r: any) => String(r.route_id))
    const chunks: string[][] = []
    for (let i = 0; i < ordered.length; i += CHUNK_SIZE)
      chunks.push(ordered.slice(i, i + CHUNK_SIZE))

    ;(async () => {
      setShapeProgress({
        done: 0,
        total: chunks.length,
        phase: cleanup ? "Optimizing corridors…" : "Loading routes…",
      })
      let offset = false
      let banded = new Set<string>()
      if (cleanup) {
        banded = await bandedRouteIds(conn)
        if (cancelled) return
        const attempted = bandsAttemptedRef.current
        const needed = ordered.filter((id) => !banded.has(id) && !attempted.has(id))
        if (needed.length > 0 && !(await routeShapeLanesReady(conn))) {
          const ok = await prepareRouteShapeLanes(conn, (done, total) => {
            if (!cancelled) setShapeProgress({ done, total, phase: "Optimizing corridors…" })
          })
          if (cancelled) return
          offset = ok
          if (ok) banded = new Set()
        } else {
          offset = true
        }
      }
      const cache = shapeChunkCacheRef.current
      const phase = cleanup && offset ? "Optimizing route shapes…" : "Loading routes…"
      if (cleanup && offset) setShapeProgress({ done: 0, total: chunks.length, phase })
      const produce = async (i: number): Promise<any[]> => {
        if (cleanup && offset) {
          const attempted = bandsAttemptedRef.current
          const missing = chunks[i].filter((id) => !banded.has(id) && !attempted.has(id))
          if (missing.length > 0) {
            try {
              await finishRouteShapeBands(conn, missing)
            } catch {}
            if (cancelled) return []
            missing.forEach((id) => attempted.add(id))
          }
        }
        const key = `${offset ? "band" : "raw"}|${routeTypeKey}|${chunks[i].join(",")}`
        let recs = cache.get(key)
        if (!recs) {
          try {
            recs = await fetchRouteShapePaths(conn, chunks[i], { offset })
          } catch {
            recs = []
          }
          if (cancelled) return []
          if (recs.length > 0) cache.set(key, recs)
        }
        return recs
      }
      const QUIET_MS = 200
      const MAX_WAIT_MS = 2500
      const waitForQuiet = async () => {
        const started = performance.now()
        for (;;) {
          if (cancelled) return
          const now = performance.now()
          const since = now - interactionRef.current
          if (since >= QUIET_MS || now - started >= MAX_WAIT_MS) return
          await new Promise((r) => setTimeout(r, Math.min(Math.max(QUIET_MS - since, 20) + 5, 120)))
        }
      }
      let next: Promise<any[]> = produce(0)
      for (let i = 0; i < chunks.length; i++) {
        const recs = await next
        if (cancelled) return
        next = i + 1 < chunks.length ? produce(i + 1) : Promise.resolve([])
        await waitForQuiet()
        if (cancelled) return
        const first = i === 0
        setShapeChunks((prev) => (first ? [recs] : [...prev, recs]))
        setShapeProgress({ done: i + 1, total: chunks.length, phase })
      }
      if (!cancelled) setShapeProgress(null)
    })().catch(() => {
      if (!cancelled) setShapeProgress(null)
    })
    return () => {
      cancelled = true
    }
  }, [conn, shouldFetchShapes, routeIdsKey, routeTypeKey, cleanup])
  const shapeRowsLoading = shapeProgress !== null && shapeChunks.length === 0

  const { data: stopRows = [] } = useQuery({
    queryKey: ["fetchRouteStops", routeIds],
    queryFn: async () => {
      return fetchServiceRouteStopsData(conn, routeIds)
    },
    enabled: !!conn && routeIds.length > 0,
    staleTime: Infinity,
  })

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

  const drawnShapeRows = useMemo(() => {
    return filteredData.flatMap((route: any) => {
      const points = parseRouteLineValue(route.shape_points_json)
      return points.map((point, index) => ({
        route_id: route.route_id,
        route_name: route.route_name,
        route_color_hex: route.route_color_hex,
        route_text_color_hex: route.route_text_color_hex,
        route_type_name: route.route_type_name,
        shape_id: `drawn_${route.route_id}`,
        shape_pt_lat: point.lat,
        shape_pt_lon: point.lon,
        shape_pt_sequence: index,
        shape_dist_traveled: null,
      }))
    })
  }, [filteredData])

  const drawnShapePaths = useMemo(() => shapeRowsToPaths(drawnShapeRows), [drawnShapeRows])

  const mapShapeChunks = useMemo(() => {
    if (drawnShapePaths.length === 0) return shapeChunks
    const drawnRouteIds = new Set(drawnShapePaths.map((rec: any) => String(rec.route_id)))
    return [
      ...shapeChunks.map((chunk) =>
        chunk.filter((rec: any) => !drawnRouteIds.has(String(rec.route_id))),
      ),
      drawnShapePaths,
    ]
  }, [drawnShapePaths, shapeChunks])

  const hasShapeGeometry = useMemo(() => {
    return mapShapeChunks.some((chunk) => chunk.some((rec: any) => (rec?.lons?.length ?? 0) > 1))
  }, [mapShapeChunks])

  const hasStopGeometry = useMemo(() => {
    return stopRows.some((row: any) => {
      return Number.isFinite(Number(row.stop_lon)) && Number.isFinite(Number(row.stop_lat))
    })
  }, [stopRows])

  const routeGeometryLoading = shouldFetchShapes && shapeRowsLoading
  const routeMapReady = filteredData.length === 0 || hasShapeGeometry || hasStopGeometry

  // Cross-filtered options: each dropdown filters by the OTHER active filters
  const byBrand = (r: any) => !brand || brand.length === 0 || brand.includes(routeBrand(r))
  const byType = (r: any) =>
    !routeType || routeType.length === 0 || routeType.includes(r.route_type_name)

  const routesForIdFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName))
    filtered = filtered.filter((r: any) => byType(r) && byBrand(r))
    return filtered
  }, [allRoutes, routeName, routeType, brand])

  const routesForNameFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId)
    filtered = filtered.filter((r: any) => byType(r) && byBrand(r))
    return filtered
  }, [allRoutes, routeId, routeType, brand])

  const routesForTypeFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId)
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName))
    filtered = filtered.filter((r: any) => byBrand(r))
    return filtered
  }, [allRoutes, routeId, routeName, brand])

  const routesForBrandFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : []
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId)
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName))
    filtered = filtered.filter((r: any) => byType(r))
    return filtered
  }, [allRoutes, routeId, routeName, routeType])

  const showBrand = useMemo(() => {
    const brands = new Set<string>()
    ;(Array.isArray(allRoutes) ? allRoutes : []).forEach((r: any) => {
      const b = routeBrand(r)
      if (b) brands.add(b)
    })
    return brands.size > 1
  }, [allRoutes])

  const availableBrands = useMemo(() => {
    return Array.from(new Set(routesForBrandFilter.map((r: any) => routeBrand(r)).filter(Boolean)))
      .sort()
      .map((b) => ({ label: String(b), value: String(b) }))
  }, [routesForBrandFilter])

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

    if (
      String(ClickInfo?.route_id) !== String(selected.route_id) ||
      ClickInfo?.status !== selected.status ||
      ClickInfo?.route_name !== selected.route_name ||
      ClickInfo?.route_color_hex !== selected.route_color_hex
    ) {
      setClickInfo(selected)
    }
  }, [search.selectedRouteId, filteredData, ClickInfo])

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

  const hasActiveFilters = Boolean(
    routeId || routeName || (routeType && routeType.length > 0) || (brand && brand.length > 0),
  )

  const updateSearch = (next: Partial<RoutesMapSearchParams>) => {
    navigate({
      to: "/routes/map",
      search: (prev) => ({ ...prev, ...next }),
      resetScroll: false,
    })
  }

  const clearFilters = () => {
    navigate({
      to: "/routes/map",
      search: (prev) => ({
        ...prev,
        routeId: undefined,
        routeName: undefined,
        routeType: undefined,
        brand: undefined,
        selectedRouteId: undefined,
      }),
      resetScroll: false,
    })
    setClickInfo(undefined)
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
            brand: prev.brand,
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
          showBrand={showBrand}
          RouteBrandData={availableBrands}
          RouteBrandDropDown={brand || []}
          setRouteBrandDropDown={(values) =>
            updateSearch({ brand: values.length ? values : undefined })
          }
          onResetFilters={clearFilters}
          isResetDisabled={!hasActiveFilters}
        />
        {allRoutesLoading || routeGeometryLoading ? (
          <div className="relative h-[74vh] w-full overflow-hidden flex items-center justify-center">
            <Skeleton className="h-full w-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-sm border bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm">
                Loading routes...
              </div>
            </div>
          </div>
        ) : !routeMapReady ? (
          <div className="relative h-[74vh] w-full border rounded overflow-hidden flex items-center justify-center">
            <div className="text-sm text-muted-foreground">
              No route geometry available for the current filters.
            </div>
          </div>
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
            <div className="relative h-[74vh] w-full overflow-hidden">
              {shapeProgress && (
                <div className="pointer-events-none absolute left-2 top-10 z-20 flex items-center gap-2 rounded-md border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent" />
                  {shapeProgress.phase}
                  {shapeProgress.total > 1 ? ` ${shapeProgress.done}/${shapeProgress.total}` : ""}
                </div>
              )}
              <RoutesMap
                routes={filteredData}
                routeIds={routeIds}
                shapeChunks={mapShapeChunks}
                stopRows={stopRows}
                cleanup={cleanup}
                setCleanup={setCleanup}
                ClickInfo={ClickInfo}
                setClickInfo={(route: any) => {
                  clearingSelectionRef.current = !route
                  setClickInfo(route)
                  if (route) {
                    updateSearch({ selectedRouteId: route.route_id })
                  } else {
                    updateSearch({ selectedRouteId: undefined })
                  }
                }}
                externalViewState={viewState}
                onInteraction={noteInteraction}
                onEdit={(route: any) => {
                  setClickInfo(route)
                  setOpen({ formType: "edit", state: true })
                }}
                onDelete={(route: any) => deleteMutation.mutate(route)}
                isDeleting={deleteMutation.isPending}
              />
            </div>
          </>
        )}
        <PageFooter />
      </div>
    </div>
  )
}
