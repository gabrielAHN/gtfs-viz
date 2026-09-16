import { useMemo, useCallback, useState } from "react"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { useRouter, useRouterState } from "@tanstack/react-router"
import { useDuckDB } from "@/context/duckdb.client"
import { logger } from "@/lib/logger"

import {
  mutationAddStationFn,
  mutationEditStationFn,
  mutationUpgradeToStationFn,
  mutationDowngradeToStopFn,
} from "@/lib/duckdb/DataEditing/editingFn"
import { mutationAddRouteFn, mutationEditRouteFn } from "@/lib/duckdb/DataEditing/editRoutes"
import {
  createStationsTable,
  createStopsTable,
  createStopsView,
  recreatePathwaysView,
  recreateStopsView,
  refreshRoutesTables,
} from "@/lib/extensions"

import {
  getStopStationFields,
  getStopStationDefaults,
  getStopStationHeader,
  STOP_STATION_QUERY_KEYS,
} from "./stopStationConfig"
import { getRouteFields, getRouteDefaults, ROUTE_QUERY_KEYS } from "./routeConfig"

type UseEntityFormProps = {
  type: "station" | "stop" | "route"
  mode: "add" | "edit"
  Data: any[]
  ClickInfo: any
  onSuccess?: () => void
  onFormMutatingChange?: (isMutating: boolean) => void
  parentStation?: string
  onZoomToLocation?: (lat: number, lon: number) => void
  showConversionActions?: boolean
  showLevelField?: boolean
}

export function useEntityForm({
  type,
  mode,
  Data,
  ClickInfo,
  onSuccess,
  onFormMutatingChange,
  parentStation,
  onZoomToLocation,
  showConversionActions = true,
  showLevelField = false,
}: UseEntityFormProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const routerState = useRouterState()
  const duckDB = useDuckDB()
  const conn = duckDB?.conn

  const isRoute = type === "route"
  const isStation = type === "station"
  const isChildNode = !!parentStation
  const isAddMode = mode === "add"
  const isEditMode = mode === "edit"
  const stopStationType = isRoute ? "stop" : type

  const [isFormMutating, setIsFormMutating] = useState(false)

  // --- Shared callbacks ---

  const invalidateQueries = useCallback(() => {
    const keys = isRoute ? ROUTE_QUERY_KEYS : STOP_STATION_QUERY_KEYS
    keys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] })
    })
  }, [queryClient, isRoute])

  const refreshProcedures = useCallback(async () => {
    if (isRoute) {
      await refreshRoutesTables(conn)
    } else {
      if (isChildNode) {
        await recreateStopsView(conn)
      } else {
        await createStopsView(conn)
      }
      await createStationsTable(conn)
      await createStopsTable(conn)
      if (isChildNode) {
        await recreatePathwaysView(conn)
      }
    }
  }, [conn, isRoute, isChildNode])

  const handleMutationStateChange = useCallback(
    (isPending: boolean) => {
      setIsFormMutating(isPending)
      onFormMutatingChange?.(isPending)
    },
    [onFormMutatingChange],
  )

  // --- Navigation after success ---

  const navigateAfterRouteSuccess = useCallback(
    (routeId: string) => {
      const currentPath = routerState.location.pathname
      const targetRoute = currentPath.includes("/routes/info")
        ? "/routes/info"
        : currentPath.includes("/routes/service") || currentPath.includes("/routes/trips")
          ? "/routes/service"
          : currentPath.includes("/routes/table")
            ? "/routes/table"
            : currentPath.includes("/routes/route/")
              ? "/routes/info"
              : "/routes/map"
      router.navigate({
        to: targetRoute,
        search: (prev) => ({ ...prev, selectedRouteId: routeId }),
      })
    },
    [router, routerState.location.pathname],
  )

  const navigateAfterStopStationSuccess = useCallback(
    (result: { stopId: string; lat?: number; lon?: number }) => {
      if (!result.stopId) return

      const currentPath = routerState.location.pathname
      const isPart = !!parentStation
      const searchParam = isPart
        ? "selectedNodeId"
        : isStation
          ? "selectedStationId"
          : "selectedStopId"

      let targetRoute = currentPath

      if (currentPath.includes("/pathways/flow")) {
        targetRoute = "/stations/pathways/flow/column"
      } else if (currentPath.includes("/parts")) {
        if (currentPath.includes("/map")) {
          targetRoute = "/stations/parts/map"
        } else if (currentPath.includes("/table")) {
          targetRoute = "/stations/parts/table"
        } else {
          targetRoute = "/stations/parts/map"
        }
      } else if (currentPath.includes("/info")) {
        targetRoute = isStation ? "/stations/info" : "/stops/map"
      } else if (currentPath.includes("/pathways")) {
        targetRoute = currentPath
      } else if (currentPath.includes("/flow")) {
        targetRoute = "/stations/pathways/flow/column"
      } else if (currentPath.includes("/map")) {
        targetRoute = `${isStation ? "/stations" : "/stops"}/map`
      } else if (currentPath.includes("/table")) {
        targetRoute = `${isStation ? "/stations" : "/stops"}/table`
      } else {
        targetRoute = `${isStation ? "/stations" : "/stops"}/map`
      }

      logger.log(`Navigating to ${targetRoute} with ${searchParam}: ${result.stopId}`)

      router.navigate({
        to: targetRoute,
        search: (prev) => ({
          ...prev,
          [searchParam]: result.stopId,
          ...(currentPath.includes("/flow") ? { selectedPathwayId: undefined } : {}),
        }),
      })

      if (currentPath.includes("/map") && result.lat && result.lon && onZoomToLocation) {
        setTimeout(() => {
          onZoomToLocation(result.lat!, result.lon!)
        }, 100)
      }
    },
    [routerState, router, isStation, parentStation, onZoomToLocation],
  )

  // --- Mutation functions ---
  // Refresh/invalidation runs inside mutationFn so mutation.isPending
  // stays true during the entire save cycle (DB write + table refresh).

  const mutationFn = useCallback(
    async (formData: any) => {
      let result: any
      if (isRoute) {
        result = isAddMode
          ? await mutationAddRouteFn({ conn, formData })
          : await mutationEditRouteFn({ conn, formData, SelectRoute: ClickInfo })
      } else if (isAddMode) {
        await mutationAddStationFn({ conn, formData })
        result = {
          stopId: formData.stopId,
          lat: parseFloat(formData.lat),
          lon: parseFloat(formData.lon),
        }
      } else {
        await mutationEditStationFn({ conn, formData, SelectStation: ClickInfo })
        result = {
          stopId: formData.stopId || ClickInfo?.stop_id,
          lat: parseFloat(formData.lat) || parseFloat(ClickInfo?.stop_lat),
          lon: parseFloat(formData.lon) || parseFloat(ClickInfo?.stop_lon),
        }
      }

      await refreshProcedures()
      invalidateQueries()
      return result
    },
    [conn, ClickInfo, isRoute, isAddMode, refreshProcedures, invalidateQueries],
  )

  const handleMutationSuccess = useCallback(
    (result: any) => {
      onSuccess?.()

      if (isRoute) {
        if (result?.routeId) navigateAfterRouteSuccess(result.routeId)
      } else {
        if (result?.stopId) navigateAfterStopStationSuccess(result)
      }
    },
    [onSuccess, isRoute, navigateAfterRouteSuccess, navigateAfterStopStationSuccess],
  )

  // --- Upgrade/downgrade mutations (stop/station only, always called for hooks rules) ---

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      await mutationUpgradeToStationFn({ conn, SelectStation: ClickInfo })
    },
    onSuccess: async () => {
      await refreshProcedures()
      invalidateQueries()
      onSuccess?.()

      const stationId = ClickInfo?.stop_id
      const lat = parseFloat(ClickInfo?.stop_lat)
      const lon = parseFloat(ClickInfo?.stop_lon)

      if (stationId) {
        const currentPath = routerState.location.pathname
        const isMapRoute = currentPath.includes("/map")
        const isTableRoute = currentPath.includes("/table")
        const routeSuffix = isMapRoute ? "/map" : isTableRoute ? "/table" : "/map"

        logger.log(`Navigating to /stations${routeSuffix} with selectedStationId: ${stationId}`)
        router.navigate({
          to: `/stations${routeSuffix}`,
          search: (prev) => ({ ...prev, selectedStationId: stationId }),
        })

        if (isMapRoute && lat && lon && onZoomToLocation) {
          setTimeout(() => {
            onZoomToLocation(lat, lon)
          }, 100)
        }
      }
    },
  })

  const downgradeMutation = useMutation({
    mutationFn: async () => {
      await mutationDowngradeToStopFn({ conn, SelectStation: ClickInfo })
    },
    onSuccess: async () => {
      await refreshProcedures()
      invalidateQueries()
      onSuccess?.()

      const stopId = ClickInfo?.stop_id
      const lat = parseFloat(ClickInfo?.stop_lat)
      const lon = parseFloat(ClickInfo?.stop_lon)

      if (stopId) {
        const currentPath = routerState.location.pathname
        const isMapRoute = currentPath.includes("/map")
        const isTableRoute = currentPath.includes("/table")
        const routeSuffix = isMapRoute ? "/map" : isTableRoute ? "/table" : "/map"

        logger.log(`Navigating to /stops${routeSuffix} with selectedStopId: ${stopId}`)
        router.navigate({
          to: `/stops${routeSuffix}`,
          search: (prev) => ({ ...prev, selectedStopId: stopId }),
        })

        if (isMapRoute && lat && lon && onZoomToLocation) {
          setTimeout(() => {
            onZoomToLocation(lat, lon)
          }, 100)
        }
      }
    },
  })

  // --- Build config from pure functions ---

  const inputData = useMemo(() => {
    if (isRoute) {
      return getRouteFields({ mode, conn, ClickInfo, Data })
    }
    return getStopStationFields({
      mode,
      type: stopStationType as "station" | "stop",
      conn,
      ClickInfo,
      Data,
      parentStation,
      showLevelField,
    })
  }, [isRoute, mode, conn, ClickInfo, Data, stopStationType, parentStation, showLevelField])

  const defaultValues = useMemo(() => {
    if (isRoute) {
      return getRouteDefaults({ mode, ClickInfo, Data })
    }
    return getStopStationDefaults({
      mode,
      type: stopStationType as "station" | "stop",
      ClickInfo,
      parentStation,
    })
  }, [isRoute, mode, ClickInfo, Data, stopStationType, parentStation])

  const header = isRoute
    ? isAddMode
      ? "Add Route"
      : "Edit Route"
    : getStopStationHeader(stopStationType as "station" | "stop", mode, parentStation)

  // --- Custom actions (upgrade/downgrade for stop/station only) ---

  const customActions = useMemo(() => {
    if (isRoute || !isEditMode || !showConversionActions) return undefined

    const canUpgrade = !isStation && ClickInfo?.location_type_name === "Stop"
    const canDowngrade = isStation && ClickInfo?.location_type_name === "Station"

    return (
      <>
        {!isStation && (
          <button
            type="button"
            onClick={() => upgradeMutation.mutate()}
            disabled={upgradeMutation.isPending || !canUpgrade || isFormMutating}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canUpgrade ? "Only stops with type 'Stop' can be upgraded to stations" : ""}
          >
            {upgradeMutation.isPending ? "Upgrading..." : "Upgrade to Station"}
          </button>
        )}
        {isStation && (
          <button
            type="button"
            onClick={() => downgradeMutation.mutate()}
            disabled={downgradeMutation.isPending || !canDowngrade || isFormMutating}
            className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canDowngrade ? "Only stations with type 'Station' can be downgraded" : ""}
          >
            {downgradeMutation.isPending ? "Downgrading..." : "Downgrade to Stop"}
          </button>
        )}
      </>
    )
  }, [
    isRoute,
    isEditMode,
    showConversionActions,
    isStation,
    ClickInfo,
    upgradeMutation,
    downgradeMutation,
    isFormMutating,
  ])

  return {
    inputData,
    mutationFn,
    header,
    buttonLabel: isAddMode ? ("Create" as const) : ("Edit" as const),
    onSuccess: handleMutationSuccess,
    onReset: invalidateQueries,
    defaultValues,
    customActions,
    disableInputs: upgradeMutation.isPending || downgradeMutation.isPending || isFormMutating,
    validationMode: "onChange" as const,
    onMutationStateChange: handleMutationStateChange,
  }
}
