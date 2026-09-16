import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers"
import DeckglMap from "@/components/maps/DeckglMap.lazy"
import MapContainer from "@/components/maps/MapContainer"
import { fitBoundsToPoints, DEFAULT_BOUNDS } from "@/functions/mapComponent/fitBounds"
import { useDuckDB } from "@/context/duckdb.client"
import { useThemeContext } from "@/context/theme.client"
import { BiReset, BiTrash, BiUndo } from "react-icons/bi"
import { Button } from "@/components/ui/button"

export type MapPoint = { lat: number; lon: number }

interface PointsMapEditorProps {
  points: MapPoint[]
  onUpdatePoints: (pts: MapPoint[]) => void
  contextStops?: Array<{
    stop_id: string
    stop_name?: string
    stop_lat: number
    stop_lon: number
    location_type_name?: string
  }>
  originalPoints?: MapPoint[]
  height?: string
  showToolbar?: boolean
  instructionText?: string
}

export function PointsMapEditor({
  points,
  onUpdatePoints,
  contextStops = [],
  originalPoints,
  height = "h-56",
  showToolbar = true,
  instructionText,
}: PointsMapEditorProps) {
  const { theme } = useThemeContext()
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const [viewState, setViewState] = useState<any>(null)
  const [boundBox, setBoundBox] = useState<[number[], number[]] | undefined>()
  const [fitZoom, setFitZoom] = useState(4)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const isDraggingRef = useRef(false)
  const dragIdxRef = useRef<number | null>(null)
  const pointsRef = useRef(points)
  pointsRef.current = points
  const boundsFittedRef = useRef(false)

  // Undo stack
  const undoStackRef = useRef<MapPoint[][]>([])
  const [undoCount, setUndoCount] = useState(0)
  const pushUndo = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      pointsRef.current.map((p) => ({ ...p })),
    ]
    setUndoCount(undoStackRef.current.length)
  }, [])
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const last = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    setUndoCount(undoStackRef.current.length)
    onUpdatePoints(last)
    setSelectedIdx(null)
  }, [onUpdatePoints])

  // Fit bounds on first load
  useEffect(() => {
    if (boundsFittedRef.current || !conn) return
    const allPts = [
      ...points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
      ...contextStops
        .filter((s) => Number.isFinite(Number(s.stop_lat)) && Number.isFinite(Number(s.stop_lon)))
        .map((s) => ({ lat: Number(s.stop_lat), lon: Number(s.stop_lon) })),
    ]
    if (allPts.length === 0) return
    let cancelled = false
    fitBoundsToPoints(conn, allPts).then((fit) => {
      if (cancelled || !fit) return
      boundsFittedRef.current = true
      setViewState(fit.viewState)
      setBoundBox(fit.boundBox as [number[], number[]])
      setFitZoom(fit.viewState.zoom)
    })
    return () => {
      cancelled = true
    }
  }, [conn, contextStops, points])

  const layers = useMemo(() => {
    const isDark = theme === "dark"
    const ls: any[] = []

    if (contextStops.length > 0) {
      const validStops = contextStops.filter(
        (s) => Number.isFinite(Number(s.stop_lat)) && Number.isFinite(Number(s.stop_lon)),
      )
      ls.push(
        new ScatterplotLayer({
          id: "shape-context-stops",
          data: validStops,
          getPosition: (d: any) => [Number(d.stop_lon), Number(d.stop_lat)],
          getFillColor: (d: any) =>
            d.location_type_name === "Station"
              ? isDark
                ? [220, 220, 220, 200]
                : [80, 80, 80, 180]
              : isDark
                ? [180, 180, 180, 160]
                : [120, 120, 120, 150],
          getLineColor: isDark ? [60, 60, 60, 200] : [255, 255, 255, 220],
          radiusUnits: "pixels" as const,
          getRadius: (d: any) => (d.location_type_name === "Station" ? 7 : 5),
          radiusMinPixels: 4,
          stroked: true,
          getLineWidth: 1.5,
          lineWidthUnits: "pixels" as const,
          pickable: false,
        }),
      )
    }

    if (points.length > 1) {
      ls.push(
        new PathLayer({
          id: "shape-path",
          data: [{ path: points.map((p) => [p.lon, p.lat]) }],
          getPath: (d: any) => d.path,
          getColor: [59, 130, 246, 255],
          getWidth: 4,
          widthUnits: "pixels" as const,
          capRounded: true,
          jointRounded: true,
          pickable: false,
        }),
      )
    }

    if (points.length > 0) {
      const indexed = points.map((p, i) => ({ ...p, idx: i }))
      ls.push(
        new ScatterplotLayer({
          id: "shape-points",
          data: indexed,
          getPosition: (d: any) => [d.lon, d.lat],
          getFillColor: (d: any) =>
            d.idx === selectedIdx ? [255, 80, 80, 255] : [59, 130, 246, 255],
          getLineColor: [255, 255, 255, 230],
          radiusUnits: "pixels" as const,
          getRadius: (d: any) => (d.idx === selectedIdx ? 9 : 5),
          radiusMinPixels: 5,
          stroked: true,
          getLineWidth: (d: any) => (d.idx === selectedIdx ? 3 : 1),
          lineWidthUnits: "pixels" as const,
          pickable: true,
          onDragStart: (info: any) => {
            if (info.object && typeof info.object.idx === "number") {
              pushUndo()
              isDraggingRef.current = true
              dragIdxRef.current = info.object.idx
              setSelectedIdx(info.object.idx)
              return true
            }
            return false
          },
          onDrag: (info: any) => {
            if (!isDraggingRef.current || dragIdxRef.current === null || !info.coordinate)
              return false
            const [lon, lat] = info.coordinate
            const np = [...pointsRef.current]
            np[dragIdxRef.current] = { lat, lon }
            pointsRef.current = np
            onUpdatePoints(np)
            return true
          },
          onDragEnd: () => {
            if (isDraggingRef.current) {
              isDraggingRef.current = false
              dragIdxRef.current = null
              return true
            }
            return false
          },
          updateTriggers: {
            getFillColor: [selectedIdx],
            getRadius: [selectedIdx],
            getLineWidth: [selectedIdx],
          },
        }),
      )
    }
    return ls
  }, [points, selectedIdx, onUpdatePoints, theme, contextStops])

  const handleClick = useCallback(
    (event: any) => {
      if (isDraggingRef.current) return
      if (event?.object && event.layer?.id === "shape-points") {
        setSelectedIdx((prev) => (prev === event.object.idx ? null : event.object.idx))
        return
      }
      if (!event?.coordinate) return
      const [lon, lat] = event.coordinate
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
      if (selectedIdx !== null) {
        pushUndo()
        const np = [...pointsRef.current]
        np[selectedIdx] = { lat, lon }
        onUpdatePoints(np)
      } else if (points.length === 0) {
        onUpdatePoints([{ lat, lon }])
        setSelectedIdx(0)
      }
    },
    [points.length, selectedIdx, onUpdatePoints, pushUndo],
  )

  if (!viewState) {
    return <div className={`${height} rounded-md border animate-pulse bg-muted`} />
  }

  const defaultInstruction =
    selectedIdx !== null
      ? "Click map to move selected point. Click point to deselect."
      : "Click a point to select. Drag to move."

  const hasChanges = originalPoints
    ? points.length !== originalPoints.length ||
      points.some(
        (p, i) =>
          !originalPoints[i] || p.lat !== originalPoints[i].lat || p.lon !== originalPoints[i].lon,
      )
    : undoCount > 0

  const handleReset = () => {
    if (originalPoints) {
      pushUndo()
      onUpdatePoints([...originalPoints])
      setSelectedIdx(null)
    }
  }

  return (
    <div className="space-y-2">
      {showToolbar && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{points.length} points</span>
          {selectedIdx !== null && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => {
                pushUndo()
                onUpdatePoints(points.filter((_, i) => i !== selectedIdx))
                setSelectedIdx(null)
              }}
            >
              <BiTrash className="mr-1 h-3 w-3" />
              Delete #{selectedIdx + 1}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            disabled={undoCount === 0}
            onClick={handleUndo}
          >
            <BiUndo className="mr-1 h-3 w-3" />
            Undo
          </Button>
          {originalPoints && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              disabled={!hasChanges}
              onClick={handleReset}
            >
              <BiReset className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      )}
      <div className={`${height} rounded-md overflow-hidden border`}>
        <MapContainer instructionText={instructionText || defaultInstruction}>
          <DeckglMap
            MinZoom={Math.max(1, fitZoom - 2)}
            dragRotate={false}
            maxPitch={0}
            MapLayers={layers}
            BoundBox={boundBox || DEFAULT_BOUNDS}
            BoundPadding={0.01}
            viewState={viewState}
            setViewState={setViewState}
            setClickInfo={handleClick}
            setHoverInfo={() => {}}
          />
        </MapContainer>
      </div>
    </div>
  )
}
