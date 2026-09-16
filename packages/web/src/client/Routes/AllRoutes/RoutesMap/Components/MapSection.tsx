import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DeckglMap from "@/components/maps/DeckglMap.lazy"
import { ScatterplotLayer } from "@deck.gl/layers"
import FannedPathLayer, { buildRouteShapePaths, fanMaxPxForZoom } from "./FannedPathLayer"
import {
  fanBundleRefFor,
  largestBundleIn,
  laneWidthPxForRouteType,
  routeModeRank,
} from "@gtfs-viz/duckdb-extension/deckgl"
import { createPointOutline } from "@/components/maps/MapOutlineHelpers"
import { useThemeContext } from "@/context/theme.client"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import { safeHexToRgb, withAlpha } from "@/components/colorUtil"

const DEFAULT_VIEW_STATE = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 3,
  pitch: 0,
  bearing: 0,
}

const DEFAULT_BOUND_BOX = [
  [-180, -85],
  [180, 85],
]

const SELECTED_ROUTE_GLOW = [250, 204, 21]
const selectionSeparatorColor = (theme: string) =>
  theme === "dark" ? [255, 255, 255] : [15, 23, 42]
const routeTypeLineColor = (route: any) => safeHexToRgb(getRouteTypeColor(route.route_type_name))

const RAW_WIDTH_PX = 4

function buildChunkPaths(records: any[], routeLookup: Map<string, any>, cleaned: boolean): any[] {
  const enriched = (Array.isArray(records) ? records : []).map((rec: any) => {
    const route = routeLookup.get(String(rec?.route_id)) || rec || {}
    return {
      ...rec,
      route_name: route.route_name || rec?.route_name,
      route_color_hex: route.route_color_hex || rec?.route_color_hex,
      route_text_color_hex: route.route_text_color_hex || rec?.route_text_color_hex,
      route_type_name: route.route_type_name || rec?.route_type_name,
    }
  })
  const out = buildRouteShapePaths(enriched, { cleaned })
  out.sort((a: any, b: any) => routeModeRank(a.route_type_name) - routeModeRank(b.route_type_name))
  return out
}

function MapSection({
  routes,
  shapeChunks,
  stopRows,
  viewState,
  setViewState,
  BoundBox,
  setBoundBox,
  ClickInfo,
  setClickInfo,
  onInteraction,
}: any) {
  const { theme } = useThemeContext()
  const [HoverInfo, setHoverInfo] = useState<any>()
  const handleViewStateChange = useCallback(
    (...args: any[]) => {
      onInteraction?.()
      ;(setViewState as any)(...args)
    },
    [onInteraction, setViewState],
  )

  const routeLookup = useMemo(() => {
    const lookup = new Map<string, any>()
    ;(Array.isArray(routes) ? routes : []).forEach((route: any) =>
      lookup.set(String(route.route_id), route),
    )
    return lookup
  }, [routes])

  const isCleaned = useMemo(
    () =>
      (Array.isArray(shapeChunks) ? shapeChunks : []).some(
        (chunk: any[]) => chunk.length > 0 && chunk[0]?.band_count != null,
      ),
    [shapeChunks],
  )

  const chunks: any[][] = useMemo(() => {
    return Array.isArray(shapeChunks) ? shapeChunks : []
  }, [shapeChunks])
  const chunkCacheRef = useRef(
    new WeakMap<any[], { cleaned: boolean; lookup: any; paths: any[] }>(),
  )
  const chunkPaths = useMemo(() => {
    const cache = chunkCacheRef.current
    return chunks.map((chunk) => {
      const cached = cache.get(chunk)
      if (cached && cached.cleaned === isCleaned && cached.lookup === routeLookup)
        return cached.paths
      const built = buildChunkPaths(chunk, routeLookup, isCleaned)
      cache.set(chunk, { cleaned: isCleaned, lookup: routeLookup, paths: built })
      return built
    })
  }, [chunks, routeLookup, isCleaned])
  const paths = useMemo(() => chunkPaths.flat(), [chunkPaths])
  const [settledChunks, setSettledChunks] = useState<any[][] | null>(null)
  useEffect(() => {
    setSettledChunks(null)
    if (chunkPaths.length <= 1) return
    const timer = setTimeout(() => setSettledChunks(chunkPaths), 600)
    return () => clearTimeout(timer)
  }, [chunkPaths])
  const drawChunks: any[][] = useMemo(
    () => (settledChunks === chunkPaths && chunkPaths.length > 1 ? [paths] : chunkPaths),
    [settledChunks, chunkPaths, paths],
  )

  const zoom = Number(viewState?.zoom) || DEFAULT_VIEW_STATE.zoom
  const fanZoom = isCleaned ? zoom : 0
  const fanMaxPx = fanMaxPxForZoom(zoom)
  const fanBundleRef = useMemo(
    () => fanBundleRefFor(Math.max(0, ...chunks.map((chunk) => largestBundleIn(chunk)))),
    [chunks],
  )

  const fallbackStops = useMemo(() => {
    return (Array.isArray(stopRows) ? stopRows : [])
      .filter((row: any) => routeLookup.has(String(row.route_id)))
      .map((row: any) => ({
        ...row,
        ...routeLookup.get(String(row.route_id)),
      }))
      .filter((row: any) => row.stop_lon != null && row.stop_lat != null)
  }, [stopRows, routeLookup])

  const stopPaths = useMemo(() => {
    const groups = new Map<string, any>()
    fallbackStops.forEach((row: any) => {
      const routeId = String(row.route_id)
      if (!groups.has(routeId)) {
        groups.set(routeId, {
          route_id: row.route_id,
          route_name: row.route_name,
          route_color_hex: row.route_color_hex,
          route_text_color_hex: row.route_text_color_hex,
          route_type_name: row.route_type_name,
          points: [],
        })
      }
      groups.get(routeId).points.push({
        sequence: Number(row.stop_sequence || 0),
        position: [Number(row.stop_lon), Number(row.stop_lat)],
      })
    })

    return Array.from(groups.values())
      .map((group) => {
        const pts = group.points.sort((a: any, b: any) => a.sequence - b.sequence)
        const path = new Float64Array(pts.length * 2)
        pts.forEach((point: any, i: number) => {
          path[i * 2] = point.position[0]
          path[i * 2 + 1] = point.position[1]
        })
        return { ...group, path }
      })
      .filter((group) => group.path.length > 2)
  }, [fallbackStops])

  // Bounds set by parent via fetchRouteMapBounds macro
  useEffect(() => {
    if (BoundBox && viewState) return
    if (!BoundBox) setBoundBox(DEFAULT_BOUND_BOX)
    if (!viewState) setViewState(DEFAULT_VIEW_STATE)
  }, [BoundBox, viewState, setBoundBox, setViewState])

  const handleClick = useCallback(
    (event: any) => {
      if (event.object) {
        const route = routeLookup.get(String(event.object.route_id)) || event.object
        setClickInfo(route)
      } else {
        setClickInfo(undefined)
      }
    },
    [routeLookup, setClickInfo],
  )

  const linePaths = useMemo(() => (paths.length > 0 ? paths : stopPaths), [paths, stopPaths])
  const clickData = ClickInfo?.object || ClickInfo
  const hoverData = HoverInfo?.object || HoverInfo
  const selectedRouteId = clickData?.route_id ? String(clickData.route_id) : undefined
  const hoverRouteId = hoverData?.route_id ? String(hoverData.route_id) : undefined
  const pathsByRoute = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const row of linePaths) {
      const k = String(row.route_id)
      const arr = m.get(k)
      if (arr) arr.push(row)
      else m.set(k, [row])
    }
    return m
  }, [linePaths])
  const EMPTY: any[] = useMemo(() => [], [])
  const selectedPaths = selectedRouteId ? pathsByRoute.get(selectedRouteId) || EMPTY : EMPTY
  const hoverPaths =
    hoverRouteId && hoverRouteId !== selectedRouteId
      ? pathsByRoute.get(hoverRouteId) || EMPTY
      : EMPTY

  const MapLayers = useMemo(() => {
    const layers: any[] = []

    if (linePaths.length > 0) {
      const casingRGB = theme === "dark" ? [15, 20, 30] : [249, 250, 252]
      const totalVertices = paths.reduce((s: number, r: any) => s + (r.path?.length || 0) / 2, 0)
      const heavy = totalVertices > 300000
      const chunkData: any[][] = paths.length > 0 ? drawChunks : [stopPaths]
      for (let ci = chunkData.length - 1; ci >= 0; ci--) {
        const d = chunkData[ci]
        if (!d || d.length === 0) continue
        const layerKey = chunkData.length === 1 && paths.length > 0 ? "all" : String(ci)
        if (isCleaned) {
          const casingPaths = heavy
            ? d.filter((r: any) => routeModeRank(r.route_type_name) === 2)
            : d
          if (casingPaths.length > 0) {
            layers.push(
              new FannedPathLayer({
                fanZoom,
                fanBundleRef,
                fanMaxPx,
                id: `routes-casing-${layerKey}`,
                data: casingPaths,
                getPath: (row: any) => row.path,
                positionFormat: "XY",
                _pathType: "open",
                getFanCodes: (row: any) => row.fanCodes,
                getColor: (row: any) => {
                  const routeId = String(row.route_id)
                  if (selectedRouteId && selectedRouteId !== routeId)
                    return withAlpha(casingRGB, 40)
                  return withAlpha(casingRGB, 240)
                },
                getWidth: (row: any) => laneWidthPxForRouteType(row.route_type_name) + 2,
                widthUnits: "pixels",
                updateTriggers: { getColor: [selectedRouteId] },
                pickable: false,
                capRounded: true,
                jointRounded: true,
              }),
            )
          }
        }
        layers.push(
          new FannedPathLayer({
            fanZoom,
            fanBundleRef,
            fanMaxPx,
            id: `routes-shape-${layerKey}`,
            data: d,
            getPath: (row: any) => row.path,
            positionFormat: "XY",
            _pathType: "open",
            getFanCodes: (row: any) => row.fanCodes,
            getColor: (row: any) => {
              const routeId = String(row.route_id)
              const color = routeTypeLineColor(row)
              if (!selectedRouteId || selectedRouteId === routeId) return withAlpha(color, 255)
              return withAlpha(color, 45)
            },
            getWidth: (row: any) => {
              const routeId = String(row.route_id)
              const base = isCleaned ? laneWidthPxForRouteType(row.route_type_name) : RAW_WIDTH_PX
              if (selectedRouteId === routeId) return base + 3
              return base
            },
            updateTriggers: {
              getWidth: [selectedRouteId, isCleaned],
              getColor: [selectedRouteId],
            },
            widthUnits: "pixels",
            pickable: true,
            capRounded: true,
            jointRounded: true,
          }),
        )
      }

      if (hoverPaths.length > 0) {
        layers.push(
          new FannedPathLayer({
            fanZoom,
            fanBundleRef,
            fanMaxPx,
            id: "routes-hover-outline",
            data: hoverPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XY",
            _pathType: "open",
            getFanCodes: (row: any) => row.fanCodes,
            getColor: withAlpha(SELECTED_ROUTE_GLOW, 115),
            getWidth: 11,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new FannedPathLayer({
            fanZoom,
            fanBundleRef,
            fanMaxPx,
            id: "routes-hover-line",
            data: hoverPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XY",
            _pathType: "open",
            getFanCodes: (row: any) => row.fanCodes,
            getColor: (row: any) => withAlpha(routeTypeLineColor(row), 255),
            getWidth: 6,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
        )
      }

      if (selectedPaths.length > 0) {
        layers.push(
          new FannedPathLayer({
            fanZoom,
            fanBundleRef,
            fanMaxPx,
            id: "routes-selected-glow",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XY",
            _pathType: "open",
            getFanCodes: (row: any) => row.fanCodes,
            getColor: withAlpha(SELECTED_ROUTE_GLOW, 90),
            getWidth: 24,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new FannedPathLayer({
            fanZoom,
            fanBundleRef,
            fanMaxPx,
            id: "routes-selected-separator",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XY",
            _pathType: "open",
            getFanCodes: (row: any) => row.fanCodes,
            getColor: withAlpha(selectionSeparatorColor(theme), 230),
            getWidth: 13,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new FannedPathLayer({
            fanZoom,
            fanBundleRef,
            fanMaxPx,
            id: "routes-selected-line",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XY",
            _pathType: "open",
            getFanCodes: (row: any) => row.fanCodes,
            getColor: (row: any) => withAlpha(routeTypeLineColor(row), 255),
            getWidth: 7,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
        )
      }
    } else if (fallbackStops.length > 0) {
      layers.push(
        new ScatterplotLayer({
          id: "routes-stop-view",
          data: fallbackStops,
          getFillColor: (row: any) => routeTypeLineColor(row),
          getPosition: (row: any) => [Number(row.stop_lon), Number(row.stop_lat)],
          pickable: true,
          getLineWidth: 0.025,
          stroked: true,
          radiusUnits: "pixels",
          radiusMinPixels: 4,
        }),
      )
    }

    if (
      hoverData?.route_id &&
      linePaths.length === 0 &&
      selectedRouteId !== String(hoverData.route_id)
    ) {
      const hoverOutline = createPointOutline({
        id: "hover-route-point",
        data: [hoverData],
        theme,
        state: "hover",
      })
      layers.push(hoverOutline)
    }

    return layers
  }, [
    paths,
    drawChunks,
    linePaths,
    stopPaths,
    fallbackStops,
    selectedRouteId,
    hoverRouteId,
    selectedPaths,
    hoverPaths,
    hoverData,
    theme,
    isCleaned,
    fanZoom,
    fanBundleRef,
  ])

  return (
    <DeckglMap
      MinZoom={4}
      dragRotate={false}
      maxPitch={0}
      MapLayers={MapLayers}
      BoundBox={BoundBox || DEFAULT_BOUND_BOX}
      viewState={viewState || DEFAULT_VIEW_STATE}
      setClickInfo={handleClick}
      setViewState={handleViewStateChange}
      setHoverInfo={setHoverInfo}
    />
  )
}

export default MapSection
