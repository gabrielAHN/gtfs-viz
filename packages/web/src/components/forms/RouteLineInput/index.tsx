import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFormContext } from "react-hook-form"
import { BiHide, BiMap, BiReset, BiTrash, BiUndo } from "react-icons/bi"
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import MapContainer from "@/components/maps/MapContainer"
import DeckglMap from "@/components/maps/DeckglMap.lazy"
import { fitBoundsToPoints, DEFAULT_BOUNDS } from "@/functions/mapComponent/fitBounds"
import { parseRouteLineValue, serializeRouteLineValue } from "./routeLine"
import { useThemeContext } from "@/context/theme.client"
import { useDuckDB } from "@/context/duckdb.client"
import { hexToRgb } from "@/components/forms/shared/colors"

const DEFAULT_BOUND_BOX = DEFAULT_BOUNDS

type RouteLineInputProps = {
  name: string
  label: string
  parts: {
    data?: any[]
    rules?: any
    editLabel?: string
    route?: any
  }
  control: any
  isLoading?: boolean
  submittedData?: any | null
  mode?: "add" | "edit"
}

function RouteLineInput({
  name,
  label,
  parts,
  control,
  isLoading = false,
  submittedData = null,
  mode = "add",
}: RouteLineInputProps) {
  const { theme } = useThemeContext()
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const { watch, setValue, trigger } = useFormContext()
  const [isMapVisible, setIsMapVisible] = useState(false)
  const [viewState, setViewState] = useState<any>()
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null)
  const isDraggingRef = useRef(false)
  const draggingPointIndexRef = useRef<number | null>(null)
  const value = isLoading && submittedData ? submittedData[name] : watch(name)
  const routeColor = watch("routeColor")
  const isEditMode = mode === "edit"
  const routeMapButtonLabel = isEditMode ? "Edit Route" : "Draw Route"
  const linePoints = useMemo(() => parseRouteLineValue(value), [value])
  const linePointsRef = useRef(linePoints)
  const lineColor = useMemo(() => hexToRgb(routeColor) || [79, 70, 229], [routeColor])

  // Track original points for reset in edit mode
  const originalPointsRef = useRef<string | null>(null)
  if (originalPointsRef.current === null && value) {
    originalPointsRef.current = typeof value === "string" ? value : JSON.stringify(value)
  }

  // Undo stack (pushUndo defined here, handleUndoAction after updateLine)
  const undoStackRef = useRef<Array<{ lat: number; lon: number }[]>>([])
  const [undoCount, setUndoCount] = useState(0)
  const pushUndo = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      linePointsRef.current.map((p) => ({ ...p })),
    ]
    setUndoCount(undoStackRef.current.length)
  }, [])

  const hasChanges = useMemo(() => {
    if (!originalPointsRef.current) return linePoints.length > 0
    const currentSerialized = serializeRouteLineValue(linePoints)
    return currentSerialized !== originalPointsRef.current
  }, [linePoints])

  useEffect(() => {
    linePointsRef.current = linePoints
  }, [linePoints])

  const contextPoints = useMemo(() => {
    return (Array.isArray(parts.data) ? parts.data : [])
      .map((row: any, index: number) => {
        const lat = Number(row.stop_lat)
        const lon = Number(row.stop_lon)
        const locationType = row.location_type_name
        return {
          id: row.stop_id || row.shape_id || index,
          lat,
          lon,
          locationType,
        }
      })
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
      .filter((point) => point.locationType)
  }, [parts.data])

  const [mapFit, setMapFit] = useState<{ viewState: any; boundBox: any } | null>(null)

  useEffect(() => {
    if (!conn) return
    let cancelled = false
    const points = linePoints.length > 0 ? linePoints : contextPoints
    if (points.length === 0) {
      setMapFit(null)
      return
    }
    fitBoundsToPoints(conn, points).then((fit) => {
      if (!cancelled) setMapFit(fit)
    })
    return () => {
      cancelled = true
    }
  }, [conn, linePoints, contextPoints])

  const boundBox = mapFit?.boundBox || DEFAULT_BOUND_BOX

  useEffect(() => {
    if (!isMapVisible || viewState || !mapFit) return
    setViewState(mapFit.viewState)
  }, [isMapVisible, viewState, mapFit])

  useEffect(() => {
    if (selectedPointIndex !== null && selectedPointIndex >= linePoints.length) {
      setSelectedPointIndex(null)
    }
  }, [linePoints.length, selectedPointIndex])

  const isEndpoint =
    selectedPointIndex !== null &&
    linePoints.length > 0 &&
    (selectedPointIndex === 0 || selectedPointIndex === linePoints.length - 1)

  const updateLine = useCallback(
    async (points: typeof linePoints) => {
      setValue(name, serializeRouteLineValue(points), {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      await trigger(name)
    },
    [name, setValue, trigger],
  )

  const handleUndoAction = useCallback(async () => {
    if (undoStackRef.current.length === 0) return
    const last = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    setUndoCount(undoStackRef.current.length)
    setSelectedPointIndex(null)
    await updateLine(last)
  }, [updateLine])

  const handleMapClick = useCallback(
    async (event: any) => {
      if (!event?.coordinate || isLoading || isDraggingRef.current) return

      if (event.object !== undefined && event.layer?.id === "route-line-drawn-points") {
        const clickedIndex = event.object.pointIndex
        setSelectedPointIndex((prev) => (prev === clickedIndex ? null : clickedIndex))
        return
      }

      const [lon, lat] = event.coordinate
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return

      if (selectedPointIndex !== null && isEndpoint) {
        pushUndo()
        const newPoints = [...linePoints]
        if (selectedPointIndex === 0) {
          newPoints.unshift({ lat, lon })
          setSelectedPointIndex(0)
        } else {
          newPoints.push({ lat, lon })
          setSelectedPointIndex(newPoints.length - 1)
        }
        await updateLine(newPoints)
      } else if (selectedPointIndex !== null) {
        pushUndo()
        const newPoints = [...linePoints]
        newPoints[selectedPointIndex] = { lat, lon }
        await updateLine(newPoints)
      } else if (linePoints.length === 0) {
        await updateLine([{ lat, lon }])
        setSelectedPointIndex(0)
      }
    },
    [isLoading, linePoints, updateLine, selectedPointIndex, isEndpoint, pushUndo],
  )

  const handleDragStart = useCallback(
    (info: any) => {
      if (
        info.object !== undefined &&
        info.layer?.id === "route-line-drawn-points" &&
        typeof info.object.pointIndex === "number"
      ) {
        pushUndo()
        const pointIndex = info.object.pointIndex
        isDraggingRef.current = true
        draggingPointIndexRef.current = pointIndex
        setSelectedPointIndex(pointIndex)
        return true
      }
      return false
    },
    [pushUndo],
  )

  const handleDrag = useCallback(
    (info: any) => {
      const pointIndex = draggingPointIndexRef.current ?? selectedPointIndex
      if (!isDraggingRef.current || pointIndex === null) return false
      if (!info.coordinate) return true
      const [lon, lat] = info.coordinate
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return true
      const newPoints = [...linePointsRef.current]
      newPoints[pointIndex] = { lat, lon }
      linePointsRef.current = newPoints
      setValue(name, serializeRouteLineValue(newPoints), {
        shouldDirty: true,
        shouldTouch: true,
      })
      return true
    },
    [selectedPointIndex, name, setValue],
  )

  const handleDragEnd = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      draggingPointIndexRef.current = null
      trigger(name)
      return true
    }
    return false
  }, [name, trigger])

  const handleDeletePoint = useCallback(async () => {
    if (selectedPointIndex === null || selectedPointIndex >= linePoints.length) return
    pushUndo()
    const newPoints = linePoints.filter((_, i) => i !== selectedPointIndex)
    setSelectedPointIndex(null)
    await updateLine(newPoints)
  }, [selectedPointIndex, linePoints, updateLine, pushUndo])

  const indexedLinePoints = useMemo(() => {
    return linePoints.map((point, index) => ({ ...point, pointIndex: index }))
  }, [linePoints])

  const layers = useMemo(() => {
    if (!isMapVisible) return []
    const nextLayers: any[] = []

    if (contextPoints.length > 0) {
      const isDark = theme === "dark"
      nextLayers.push(
        new ScatterplotLayer({
          id: "route-line-context-points",
          data: contextPoints,
          getPosition: (point: any) => [point.lon, point.lat],
          getFillColor: (point: any) =>
            point.locationType === "Station"
              ? isDark
                ? [180, 180, 180, 120]
                : [100, 100, 100, 100]
              : isDark
                ? [140, 140, 140, 80]
                : [160, 160, 160, 80],
          radiusUnits: "pixels" as const,
          getRadius: (point: any) => (point.locationType === "Station" ? 6 : 3),
          radiusMinPixels: 2,
          pickable: false,
        }),
      )
    }

    if (linePoints.length > 1) {
      const pathCoords = linePoints
        .map((point) => [point.lon, point.lat])
        .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
      if (pathCoords.length > 1)
        nextLayers.push(
          new PathLayer({
            id: "route-line-drawn-path",
            data: [{ path: pathCoords }],
            getPath: (row: any) => row.path,
            getColor: [lineColor[0] || 79, lineColor[1] || 70, lineColor[2] || 229, 255] as [
              number,
              number,
              number,
              number,
            ],
            getWidth: 5,
            widthUnits: "pixels" as const,
            capRounded: true,
            jointRounded: true,
            pickable: false,
          }),
        )
    }

    if (indexedLinePoints.length > 0) {
      nextLayers.push(
        new ScatterplotLayer({
          id: "route-line-drawn-points",
          data: indexedLinePoints,
          getPosition: (point: any) => [point.lon, point.lat],
          getFillColor: (point: any) =>
            point.pointIndex === selectedPointIndex
              ? ([255, 80, 80, 255] as [number, number, number, number])
              : ([...lineColor, 255] as [number, number, number, number]),
          getLineColor: (point: any) =>
            point.pointIndex === selectedPointIndex ? [255, 255, 255, 255] : [255, 255, 255, 230],
          radiusUnits: "pixels" as const,
          getRadius: (point: any) => (point.pointIndex === selectedPointIndex ? 9 : 5),
          radiusMinPixels: 5,
          lineWidthUnits: "pixels" as const,
          getLineWidth: (point: any) => (point.pointIndex === selectedPointIndex ? 3 : 1),
          stroked: true,
          pickable: true,
          onDragStart: handleDragStart,
          onDrag: handleDrag,
          onDragEnd: handleDragEnd,
          updateTriggers: {
            getFillColor: [selectedPointIndex, lineColor],
            getLineColor: [selectedPointIndex],
            getRadius: [selectedPointIndex],
            getLineWidth: [selectedPointIndex],
          },
        }),
      )
    }

    return nextLayers
  }, [
    isMapVisible,
    contextPoints,
    handleDrag,
    handleDragEnd,
    handleDragStart,
    indexedLinePoints,
    lineColor,
    linePoints,
    selectedPointIndex,
    theme,
  ])

  return (
    <FormField
      control={control}
      name={name}
      rules={parts.rules}
      render={({ field, fieldState }) => {
        const shouldShowError =
          !isLoading && fieldState.error && (fieldState.isTouched || fieldState.isDirty)

        return (
          <FormItem className="mt-3">
            <FormLabel>{label}</FormLabel>
            {!isLoading && parts.editLabel && (
              <div className="text-xs text-muted-foreground">Current: {parts.editLabel}</div>
            )}
            <FormControl>
              <input
                ref={field.ref}
                type="hidden"
                value={field.value || ""}
                onChange={field.onChange}
                disabled={isLoading}
              />
            </FormControl>
            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsMapVisible((prev) => !prev)
                    setViewState(undefined)
                    setSelectedPointIndex(null)
                  }}
                  disabled={isLoading}
                >
                  {isMapVisible ? (
                    <>
                      <BiHide className="mr-2 h-4 w-4" />
                      Hide Map
                    </>
                  ) : (
                    <>
                      <BiMap className="mr-2 h-4 w-4" />
                      {routeMapButtonLabel}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleUndoAction}
                  disabled={isLoading || undoCount === 0}
                >
                  <BiUndo className="mr-2 h-4 w-4" />
                  Undo
                </Button>
                {isEditMode && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      pushUndo()
                      setSelectedPointIndex(null)
                      const original = parseRouteLineValue(originalPointsRef.current || "")
                      await updateLine(original)
                    }}
                    disabled={isLoading || !hasChanges}
                  >
                    <BiReset className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                )}
                {selectedPointIndex !== null && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeletePoint}
                    disabled={isLoading}
                  >
                    <BiTrash className="mr-2 h-4 w-4" />
                    Delete Point {selectedPointIndex + 1}
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {linePoints.length} points
                  {isEditMode && hasChanges && (
                    <span className="ml-1 text-yellow-600 dark:text-yellow-400">
                      {" "}
                      (shape modified)
                    </span>
                  )}
                </span>
              </div>
              {isMapVisible && (
                <div className="mt-3 h-72 w-full overflow-hidden rounded-md">
                  {viewState ? (
                    <MapContainer instructionText="">
                      <DeckglMap
                        MinZoom={3}
                        dragRotate={false}
                        maxPitch={0}
                        MapLayers={layers}
                        BoundBox={boundBox}
                        viewState={viewState}
                        setViewState={setViewState}
                        setClickInfo={handleMapClick}
                        setHoverInfo={() => {}}
                      />
                    </MapContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-muted/30 rounded-md border">
                      <span className="text-sm text-muted-foreground">Loading map...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {shouldShowError && <FormMessage />}
          </FormItem>
        )
      }}
    />
  )
}

export default RouteLineInput
