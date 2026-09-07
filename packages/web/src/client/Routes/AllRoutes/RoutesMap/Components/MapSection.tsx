import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DeckglMap from "@/components/maps/DeckglMap.lazy"
import { ScatterplotLayer } from "@deck.gl/layers"
import FannedPathLayer, { encodeFanZ } from "./FannedPathLayer"
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

const modeRank = (name?: string): number => {
  const n = (name || "").toLowerCase()
  if (n.includes("bus") || n.includes("trolley")) return 0
  if (n.includes("ferry") || n.includes("boat") || n.includes("water")) return 1
  return 2
}
const RAW_WIDTH_PX = 4
const modeWidthPx = (name?: string): number => {
  const r = modeRank(name)
  return r === 0 ? 3 : r === 1 ? 3.5 : 4
}

const MERGE_ZOOM = 12.5
const FULL_ZOOM = 13.25
const fullGapPx = (name?: string): number => {
  const r = modeRank(name)
  return r === 0 ? 7 : r === 1 ? 8 : 9
}
const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}
export const fanRampForZoom = (zoom: number): number =>
  smoothstep((zoom - MERGE_ZOOM) / (FULL_ZOOM - MERGE_ZOOM))
export const fanMaxPxForZoom = (zoom: number): number => 24 + 16 * smoothstep((zoom - 14) / 2)

function buildChunkPaths(records: any[], routeLookup: Map<string, any>, cleaned: boolean): any[] {
  const out: any[] = []
  for (const rec of Array.isArray(records) ? records : []) {
    const lons: Float64Array | undefined = rec?.lons
    const lats: Float64Array | undefined = rec?.lats
    if (!lons || !lats) continue
    const n = Math.min(lons.length, lats.length)
    if (n < 2) continue
    const route = routeLookup.get(String(rec.route_id)) || rec
    const typeName = route.route_type_name || rec.route_type_name
    const gap = fullGapPx(typeName)
    const slots: Float64Array | null =
      cleaned && rec.slots && rec.slots.length === n ? rec.slots : null
    const radii: Float64Array | null =
      rec.turnRadii && rec.turnRadii.length === n ? rec.turnRadii : null
    const counts: Float64Array | null =
      cleaned && rec.bandCounts && rec.bandCounts.length === n ? rec.bandCounts : null
    const path = new Float64Array(n * 3)
    for (let i = 0; i < n; i++) {
      let slotPx = 0
      if (slots) {
        const lo = i > 0 ? i - 1 : 0
        const hi = i < n - 1 ? i + 1 : n - 1
        let sum = 0
        for (let k = lo; k <= hi; k++) sum += slots[k]
        slotPx = (sum / (hi - lo + 1)) * gap
      }
      const r = radii ? radii[i] : 5000
      path[i * 3] = lons[i]
      path[i * 3 + 1] = lats[i]
      path[i * 3 + 2] = encodeFanZ(
        Number.isFinite(slotPx) ? slotPx : 0,
        Number.isFinite(r) ? r : 5000,
        counts ? counts[i] : 1,
        gap,
      )
    }
    out.push({
      route_id: rec.route_id,
      route_name: route.route_name || rec.route_name,
      route_color_hex: route.route_color_hex || rec.route_color_hex,
      route_text_color_hex: route.route_text_color_hex || rec.route_text_color_hex,
      route_type_name: typeName,
      shape_id: rec.shape_id,
      path,
    })
  }
  out.sort((a, b) => modeRank(a.route_type_name) - modeRank(b.route_type_name))
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

  const zoom = Number(viewState?.zoom) || DEFAULT_VIEW_STATE.zoom
  const fanRamp = isCleaned ? fanRampForZoom(zoom) : 0
  const fanMaxPx = fanMaxPxForZoom(zoom)

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
        const path = new Float64Array(pts.length * 3)
        pts.forEach((point: any, i: number) => {
          path[i * 3] = point.position[0]
          path[i * 3 + 1] = point.position[1]
          path[i * 3 + 2] = encodeFanZ(0, 5000)
        })
        return { ...group, path }
      })
      .filter((group) => group.path.length > 3)
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
  const selectedPaths = useMemo(
    () =>
      selectedRouteId
        ? linePaths.filter((row: any) => String(row.route_id) === selectedRouteId)
        : [],
    [linePaths, selectedRouteId],
  )
  const hoverPaths = useMemo(
    () =>
      hoverRouteId && hoverRouteId !== selectedRouteId
        ? linePaths.filter((row: any) => String(row.route_id) === hoverRouteId)
        : [],
    [linePaths, hoverRouteId, selectedRouteId],
  )

  const MapLayers = useMemo(() => {
    const layers: any[] = []

    if (linePaths.length > 0) {
      const casingRGB = theme === "dark" ? [15, 20, 30] : [249, 250, 252]
      const totalVertices = paths.reduce((s: number, r: any) => s + (r.path?.length || 0) / 3, 0)
      const heavy = totalVertices > 300000
      const chunkData: any[][] = paths.length > 0 ? chunkPaths : [stopPaths]
      for (let ci = chunkData.length - 1; ci >= 0; ci--) {
        const d = chunkData[ci]
        if (!d || d.length === 0) continue
        if (isCleaned) {
          const casingPaths = heavy ? d.filter((r: any) => modeRank(r.route_type_name) === 2) : d
          if (casingPaths.length > 0) {
            layers.push(
              new FannedPathLayer({
                fanRamp,
                fanMaxPx,
                id: `routes-casing-${ci}`,
                data: casingPaths,
                getPath: (row: any) => row.path,
                positionFormat: "XYZ",
                getColor: (row: any) => {
                  const routeId = String(row.route_id)
                  if (selectedRouteId && selectedRouteId !== routeId)
                    return withAlpha(casingRGB, 40)
                  return withAlpha(casingRGB, 240)
                },
                getWidth: (row: any) => modeWidthPx(row.route_type_name) + 2,
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
            fanRamp,
            fanMaxPx,
            id: `routes-shape-${ci}`,
            data: d,
            getPath: (row: any) => row.path,
            positionFormat: "XYZ",
            getColor: (row: any) => {
              const routeId = String(row.route_id)
              const color = routeTypeLineColor(row)
              if (!selectedRouteId || selectedRouteId === routeId) return withAlpha(color, 255)
              return withAlpha(color, 45)
            },
            getWidth: (row: any) => {
              const routeId = String(row.route_id)
              const base = isCleaned ? modeWidthPx(row.route_type_name) : RAW_WIDTH_PX
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
            fanRamp,
            fanMaxPx,
            id: "routes-hover-outline",
            data: hoverPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XYZ",
            getColor: withAlpha(SELECTED_ROUTE_GLOW, 115),
            getWidth: 11,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new FannedPathLayer({
            fanRamp,
            fanMaxPx,
            id: "routes-hover-line",
            data: hoverPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XYZ",
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
            fanRamp,
            fanMaxPx,
            id: "routes-selected-glow",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XYZ",
            getColor: withAlpha(SELECTED_ROUTE_GLOW, 90),
            getWidth: 24,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new FannedPathLayer({
            fanRamp,
            fanMaxPx,
            id: "routes-selected-separator",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XYZ",
            getColor: withAlpha(selectionSeparatorColor(theme), 230),
            getWidth: 13,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new FannedPathLayer({
            fanRamp,
            fanMaxPx,
            id: "routes-selected-line",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            positionFormat: "XYZ",
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
    chunkPaths,
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
    fanRamp,
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
