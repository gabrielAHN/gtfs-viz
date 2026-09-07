import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { BiCrosshair, BiMapPin, BiX } from "react-icons/bi"
import MapContainer from "@/components/maps/MapContainer"
import { fitBoundsToPoints } from "@/functions/mapComponent/fitBounds"
import { useDuckDB } from "@/context/duckdb.client"
import { fetchTripMapBounds } from "@/lib/duckdb/DataFetching/fetchRouteData"
import { getEditableStopStatus, TRIP_LINE_COLORS } from "@/lib/tripUtils"
import { MapSection } from "./Components/MapSection"
import type { TripMapProps, StopPoint, Segment } from "./types"

export function TripMap({
  trips,
  heightClassName = "h-[50vh]",
  highlightedSegmentRange,
  highlightedSegmentColor,
  editable = false,
  onDeleteStop: _onDeleteStop,
  onRestoreStop: _onRestoreStop,
  onReplaceStop: _onReplaceStop,
  onAddStop: _onAddStop,
  routeStops: _routeStops = [],
  onCreateStop: _onCreateStop,
  addStopPreview: externalPreview,
  deletedStopIndices = new Set(),
  onDragStop,
  onUpdateStopTime: _onUpdateStopTime,
  originalStops,
  selectedStopIdx,
  onSelectStop,
  editPanel,
  zoomToStopRef,
  onClickAnyStop,
  hiddenTripIndices: externalHidden,
  onToggleTripVisibility,
  offsetPaths,
}: TripMapProps) {
  const { conn } = useDuckDB() ?? {}
  const [viewState, setViewState] = useState<any>(null)
  const [boundBox, setBoundBox] = useState<[number[], number[]] | undefined>()
  const [fitZoom, setFitZoom] = useState<number>(2)
  const [clickedStop, setClickedStop] = useState<StopPoint | null>(null)
  const [clickedSegment, setClickedSegment] = useState<Segment | null>(null)
  const [previewStop, setPreviewStop] = useState<{ lon: number; lat: number; name: string } | null>(
    null,
  )
  const [internalHidden, setInternalHidden] = useState<Set<number>>(new Set())
  const hiddenTripIndices = externalHidden ?? internalHidden
  const boundsFittedRef = useRef(false)

  // Prepare data
  const { stopPoints, segments, paths } = useMemo(() => {
    const pts: StopPoint[] = []
    const segs: Segment[] = []
    const pths: Array<{ path?: [number, number][]; band?: any; tripIdx: number }> = []

    for (let ti = 0; ti < trips.length; ti++) {
      const { stopTimes } = trips[ti]
      const tripPath: [number, number][] = []
      let prevPt: StopPoint | null = null

      for (let si = 0; si < stopTimes.length; si++) {
        const st = stopTimes[si]
        const lat = Number(st.stop_lat)
        const lon = Number(st.stop_lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

        const isDeleted = editable && ti === 0 && deletedStopIndices.has(si)
        const pt: StopPoint = {
          lon,
          lat,
          name: st.stop_name || st.stop_id || `Stop ${si + 1}`,
          stopId: st.stop_id || "",
          sequence: si + 1,
          stopIdx: si,
          arrivalTime: st.arrival_time,
          departureTime: st.departure_time,
          parentStation: (st as any).parent_station,
          tripIdx: ti,
          disabled: isDeleted,
        }
        pts.push(pt)
        if (!isDeleted) tripPath.push([lon, lat])

        if (prevPt) {
          segs.push({
            from: [prevPt.lon, prevPt.lat],
            to: [lon, lat],
            fromIdx: prevPt.stopIdx,
            toIdx: si,
            fromName: prevPt.name,
            toName: pt.name,
            fromTime: prevPt.departureTime || prevPt.arrivalTime,
            toTime: st.arrival_time || st.departure_time,
            tripIdx: ti,
            disabled: isDeleted || prevPt.disabled,
            fromStopId: prevPt.stopId,
            toStopId: pt.stopId,
            fromStation: prevPt.parentStation,
            toStation: pt.parentStation,
          })
        }
        prevPt = pt
      }

      const tripId = trips[ti]?.trip?.trip_id ? String(trips[ti].trip.trip_id) : ""
      const band = offsetPaths && tripId ? offsetPaths[tripId] : undefined
      if (band && band.lons && band.lons.length > 1) pths.push({ band, tripIdx: ti })
      else if (tripPath.length > 1) pths.push({ path: tripPath, tripIdx: ti })
    }

    return { stopPoints: pts, segments: segs, paths: pths }
  }, [trips, editable, deletedStopIndices, offsetPaths])

  // Zoom to a specific stop by index
  const stopPointsRef = useRef(stopPoints)
  stopPointsRef.current = stopPoints
  useEffect(() => {
    if (zoomToStopRef) {
      zoomToStopRef.current = (stopIdxOrLon: number, lat?: number) => {
        // If lat is provided, zoom to coordinates directly (for preview stops)
        if (lat != null) {
          setViewState((prev: any) => ({
            ...prev,
            longitude: stopIdxOrLon,
            latitude: lat,
            zoom: Math.max(prev?.zoom ?? 12, 15),
            pitch: 0,
            bearing: 0,
            transitionDuration: 500,
          }))
          return
        }
        const pt = stopPointsRef.current.find((p) => p.tripIdx === 0 && p.stopIdx === stopIdxOrLon)
        if (pt) {
          setViewState((prev: any) => ({
            ...prev,
            longitude: pt.lon,
            latitude: pt.lat,
            zoom: Math.max(prev?.zoom ?? 12, 15),
            pitch: 0,
            bearing: 0,
            transitionDuration: 500,
          }))
        }
      }
    }
  }, [zoomToStopRef])

  // Sync selectedStopIdx from parent
  // In compare mode: only sync on mount (to carry selection from other views), not on click-triggered updates
  const prevSelectedRef = useRef(selectedStopIdx)
  const hasMountedRef = useRef(false)
  useEffect(() => {
    const idxChanged = prevSelectedRef.current !== selectedStopIdx
    prevSelectedRef.current = selectedStopIdx

    // In compare mode, skip after mount — click handler manages clickedStop directly
    if (onClickAnyStop && hasMountedRef.current) return
    hasMountedRef.current = true

    if (selectedStopIdx != null) {
      // In compare mode, search ALL trips for the stop; in single-trip mode, only trip 0
      const pt = onClickAnyStop
        ? stopPointsRef.current.find((p) => p.stopIdx === selectedStopIdx)
        : stopPointsRef.current.find((p) => p.tripIdx === 0 && p.stopIdx === selectedStopIdx)
      if (pt) {
        setClickedStop((prev) => {
          if (
            idxChanged ||
            !prev ||
            prev.stopId !== pt.stopId ||
            prev.lat !== pt.lat ||
            prev.lon !== pt.lon ||
            prev.name !== pt.name
          ) {
            return pt
          }
          return prev
        })
        if (idxChanged) setClickedSegment(null)
      }
    } else {
      setClickedStop((prev) => (prev ? null : prev))
    }
  }, [selectedStopIdx, stopPoints, onClickAnyStop])

  const stopGeometry = useMemo(
    () =>
      stopPoints
        .map((point) => `${point.tripIdx}:${point.stopIdx}:${point.lon}:${point.lat}`)
        .join("|"),
    [stopPoints],
  )
  const prevStopGeometryRef = useRef(stopGeometry)
  const prevPreviewRef = useRef(externalPreview)

  // Center on preview when no stops exist (no conn needed)
  useEffect(() => {
    if (stopPoints.length > 0 || !externalPreview) return
    if (!Number.isFinite(externalPreview.lat) || !Number.isFinite(externalPreview.lon)) return
    setViewState((prev: any) => ({
      ...prev,
      longitude: externalPreview.lon,
      latitude: externalPreview.lat,
      zoom: 14,
      pitch: 0,
      bearing: 0,
      transitionDuration: prev ? 300 : 0,
    }))
    setBoundBox([
      [externalPreview.lon - 0.02, externalPreview.lat - 0.02],
      [externalPreview.lon + 0.02, externalPreview.lat + 0.02],
    ])
    setFitZoom(14)
  }, [externalPreview?.lon, externalPreview?.lat, stopPoints.length])

  // Fit bounds on first load or refit when stops change
  useEffect(() => {
    if (!conn || stopPoints.length === 0) return

    const stopsChanged = prevStopGeometryRef.current !== stopGeometry
    prevStopGeometryRef.current = stopGeometry
    prevPreviewRef.current = externalPreview

    const allPoints = stopPoints.map((p) => ({ lat: p.lat, lon: p.lon }))
    if (
      externalPreview &&
      Number.isFinite(externalPreview.lat) &&
      Number.isFinite(externalPreview.lon)
    ) {
      allPoints.push({ lat: externalPreview.lat, lon: externalPreview.lon })
    }

    if (!boundsFittedRef.current) {
      boundsFittedRef.current = true
      let cancelled = false
      const tripId = trips[0]?.trip?.trip_id
      const fetchBounds = async () => {
        try {
          if (tripId) {
            const fit = await fetchTripMapBounds(conn, tripId)
            if (!cancelled && fit) {
              setViewState(fit.viewState)
              setBoundBox(fit.boundBox as [number[], number[]])
              setFitZoom(fit.viewState.zoom)
              return
            }
          }
        } catch {
          /* fallback */
        }
        const fit = await fitBoundsToPoints(conn, allPoints)
        if (cancelled || !fit) return
        setViewState({ ...fit.viewState, transitionDuration: 0 })
        setBoundBox(fit.boundBox as [number[], number[]])
        setFitZoom(fit.viewState.zoom)
      }
      fetchBounds()
      return () => {
        cancelled = true
      }
    }

    if (stopsChanged) {
      let cancelled = false
      fitBoundsToPoints(conn, allPoints).then((fit) => {
        if (cancelled || !fit) return
        setViewState((prev: any) => ({ ...prev, ...fit.viewState, transitionDuration: 300 }))
        setBoundBox(fit.boundBox as [number[], number[]])
        setFitZoom(fit.viewState.zoom)
      })
      return () => {
        cancelled = true
      }
    }
  }, [conn, stopPoints, stopGeometry, trips, externalPreview])

  // Stop status detection for coloring — identity-based via _idx
  const stopStatusMap = useMemo(() => {
    const map = new Map<number, string>()
    const primaryStops = trips[0]?.stopTimes || []
    if (editable) {
      for (let i = 0; i < primaryStops.length; i++) {
        const st = primaryStops[i]
        const origIdx = (st as any)._idx
        const orig =
          originalStops && origIdx != null && origIdx < originalStops.length
            ? originalStops[origIdx]
            : undefined
        const status = originalStops ? getEditableStopStatus(st, orig) : st.edit_status
        if (status) map.set(i, status)
      }
    } else if (!editable) {
      for (let i = 0; i < primaryStops.length; i++) {
        const editStatus = primaryStops[i].edit_status
        if (editStatus) map.set(i, editStatus)
      }
    }
    return map
  }, [originalStops, editable, trips])

  if (stopPoints.length === 0 && !externalPreview) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground text-center">
        No stop times available
      </div>
    )
  }

  if (!viewState) {
    // Fallback: if conn isn't available but we have stop points, compute bounds locally
    if (stopPoints.length > 0) {
      let minLat = Infinity,
        maxLat = -Infinity,
        minLon = Infinity,
        maxLon = -Infinity
      for (const p of stopPoints) {
        if (p.lat < minLat) minLat = p.lat
        if (p.lat > maxLat) maxLat = p.lat
        if (p.lon < minLon) minLon = p.lon
        if (p.lon > maxLon) maxLon = p.lon
      }
      const fallbackView = {
        longitude: (minLon + maxLon) / 2,
        latitude: (minLat + maxLat) / 2,
        zoom: 12,
        pitch: 0,
        bearing: 0,
      }
      const fallbackBox: [number[], number[]] = [
        [minLon, minLat],
        [maxLon, maxLat],
      ]
      setViewState(fallbackView)
      setBoundBox(fallbackBox)
      setFitZoom(12)
    }
    return <div className={`${heightClassName} rounded-md border animate-pulse bg-muted`} />
  }

  // Popups — in edit mode, only show the editPanel (no StopPopup/SegmentPopup)
  let popup: React.ReactNode | undefined
  if (editable) {
    if (editPanel) {
      popup = <div className="p-2 text-sm">{editPanel}</div>
    }
  } else if (clickedStop) {
    // Find stops with same stop_id or parent_station across trips (not by coordinates)
    const colocatedStops =
      trips.length > 1
        ? stopPoints.filter((p) => {
            if (hiddenTripIndices.has(p.tripIdx)) return false
            if (clickedStop.stopId && p.stopId && clickedStop.stopId === p.stopId) return true
            if (
              clickedStop.parentStation &&
              p.parentStation &&
              clickedStop.parentStation === p.parentStation
            )
              return true
            return false
          })
        : []
    const hasOverlap =
      colocatedStops.length > 1 && new Set(colocatedStops.map((p) => p.tripIdx)).size > 1

    popup = (
      <div className="p-3 text-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{clickedStop.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setViewState((prev: any) => ({
                ...prev,
                longitude: clickedStop.lon,
                latitude: clickedStop.lat,
                zoom: Math.max(prev?.zoom ?? 12, 15),
                pitch: 0,
                bearing: 0,
                transitionDuration: 500,
              }))
            }}
            className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
            title="Zoom to stop"
          >
            <BiCrosshair className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setClickedStop(null)
              setPreviewStop(null)
            }}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <BiX className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{clickedStop.stopId}</span>
          {clickedStop.parentStation ? (
            <Link
              to="/stations/info"
              search={{ selectedStationId: clickedStop.parentStation }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors"
            >
              <BiMapPin className="h-3 w-3" />
              Station
            </Link>
          ) : (
            <Link
              to="/stops/map"
              search={{ selectedStopId: clickedStop.stopId }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors"
            >
              <BiMapPin className="h-3 w-3" />
              Stop
            </Link>
          )}
        </div>
        {hasOverlap ? (
          <div className="space-y-1 pt-1 border-t">
            {colocatedStops
              .sort((a, b) => a.tripIdx - b.tripIdx)
              .map((st) => (
                <div
                  key={`${st.tripIdx}-${st.stopIdx}`}
                  className="flex items-center gap-2 text-xs rounded px-1.5 py-1"
                >
                  <span
                    className="rounded-sm shrink-0"
                    style={{
                      width: 10,
                      height: 10,
                      backgroundColor: TRIP_LINE_COLORS[st.tripIdx % TRIP_LINE_COLORS.length],
                    }}
                  />
                  <span className="truncate max-w-[80px]">
                    {trips[st.tripIdx]?.trip?.trip_headsign ||
                      trips[st.tripIdx]?.trip?.trip_id ||
                      `Trip ${st.tripIdx + 1}`}
                  </span>
                  <span className="text-muted-foreground">#{st.sequence}</span>
                  <span className="ml-auto text-muted-foreground whitespace-nowrap">
                    {st.arrivalTime || "\u2014"}
                    {st.departureTime && st.departureTime !== st.arrivalTime
                      ? ` \u2192 ${st.departureTime}`
                      : ""}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="pt-1 border-t text-xs space-y-1">
            {trips.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-sm shrink-0"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor:
                      TRIP_LINE_COLORS[clickedStop.tripIdx % TRIP_LINE_COLORS.length],
                  }}
                />
                <span className="text-muted-foreground">
                  {trips[clickedStop.tripIdx]?.trip?.trip_headsign ||
                    trips[clickedStop.tripIdx]?.trip?.trip_id}
                </span>
                <span className="text-muted-foreground">#{clickedStop.sequence}</span>
              </div>
            )}
            {clickedStop.arrivalTime && <div>Arr: {clickedStop.arrivalTime}</div>}
            {clickedStop.departureTime && <div>Dep: {clickedStop.departureTime}</div>}
          </div>
        )}
      </div>
    )
  } else if (clickedSegment) {
    // Find matching segments using identity key: parent_station (if exists) or stop_id
    const stopKey = (stopId?: string, station?: string) =>
      station && station.length > 0 ? station : stopId || ""
    const clickedFromKey = stopKey(clickedSegment.fromStopId, clickedSegment.fromStation)
    const clickedToKey = stopKey(clickedSegment.toStopId, clickedSegment.toStation)
    const matchingSegs =
      trips.length > 1
        ? segments.filter((s) => {
            if (hiddenTripIndices.has(s.tripIdx)) return false
            const sFromKey = stopKey(s.fromStopId, s.fromStation)
            const sToKey = stopKey(s.toStopId, s.toStation)
            // Match both directions (trips may run opposite ways on the same track)
            return (
              (sFromKey === clickedFromKey && sToKey === clickedToKey) ||
              (sFromKey === clickedToKey && sToKey === clickedFromKey)
            )
          })
        : [clickedSegment]

    const fromSec = (t?: string) => {
      if (!t) return null
      const p = t.split(":").map(Number)
      return p.length >= 2 ? p[0] * 3600 + p[1] * 60 + (p[2] || 0) : null
    }
    const durMin = (from?: string, to?: string) => {
      const a = fromSec(from),
        b = fromSec(to)
      return a != null && b != null ? Math.round((b - a) / 60) : null
    }

    popup = (
      <div className="p-3 text-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-muted-foreground">Segment</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              const midLon = (clickedSegment.from[0] + clickedSegment.to[0]) / 2
              const midLat = (clickedSegment.from[1] + clickedSegment.to[1]) / 2
              setViewState((prev: any) => ({
                ...prev,
                longitude: midLon,
                latitude: midLat,
                zoom: Math.max(prev?.zoom ?? 12, 15),
                pitch: 0,
                bearing: 0,
                transitionDuration: 500,
              }))
            }}
            className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
            title="Zoom to segment"
          >
            <BiCrosshair className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setClickedSegment(null)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <BiX className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs space-y-0.5">
          <div className="font-medium">{clickedSegment.fromName}</div>
          <div className="text-muted-foreground">{"\u2193"}</div>
          <div className="font-medium">{clickedSegment.toName}</div>
        </div>
        {matchingSegs.length > 1 ? (
          <div className="space-y-1 pt-1 border-t">
            {matchingSegs
              .sort((a, b) => a.tripIdx - b.tripIdx)
              .map((seg) => {
                const dur = durMin(seg.fromTime, seg.toTime)
                return (
                  <div
                    key={seg.tripIdx}
                    className={`flex items-center gap-2 text-xs rounded px-1.5 py-1 ${clickedSegment.tripIdx === seg.tripIdx ? "bg-primary/10 font-medium" : ""}`}
                  >
                    <span
                      className="rounded-full shrink-0"
                      style={{
                        width: 6,
                        height: 6,
                        backgroundColor: TRIP_LINE_COLORS[seg.tripIdx % TRIP_LINE_COLORS.length],
                      }}
                    />
                    <span className="truncate max-w-[80px]">
                      {trips[seg.tripIdx]?.trip?.trip_headsign ||
                        trips[seg.tripIdx]?.trip?.trip_id ||
                        `Trip ${seg.tripIdx + 1}`}
                    </span>
                    <span className="ml-auto text-muted-foreground whitespace-nowrap">
                      {seg.fromTime || "\u2014"} {"\u2192"} {seg.toTime || "\u2014"}
                      {dur != null && <span className="ml-1 text-[10px] opacity-70">({dur}m)</span>}
                    </span>
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="text-xs space-y-0.5 pt-1 border-t">
            {trips.length > 1 && (
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="rounded-full shrink-0"
                  style={{
                    width: 6,
                    height: 6,
                    backgroundColor:
                      TRIP_LINE_COLORS[clickedSegment.tripIdx % TRIP_LINE_COLORS.length],
                  }}
                />
                <span className="text-muted-foreground">
                  {trips[clickedSegment.tripIdx]?.trip?.trip_headsign ||
                    trips[clickedSegment.tripIdx]?.trip?.trip_id}
                </span>
              </div>
            )}
            <div>Dep: {clickedSegment.fromTime || "\u2014"}</div>
            <div>Arr: {clickedSegment.toTime || "\u2014"}</div>
            {(() => {
              const d = durMin(clickedSegment.fromTime, clickedSegment.toTime)
              return d != null ? <div className="text-muted-foreground">{d} min</div> : null
            })()}
          </div>
        )}
      </div>
    )
  }

  const legend =
    trips.length > 1 && !externalHidden ? (
      <div className="rounded-md border bg-background/90 backdrop-blur-sm p-2 text-xs space-y-1">
        {trips.map(({ trip }, idx) => {
          const isHidden = hiddenTripIndices.has(idx)
          return (
            <div
              key={trip.trip_id}
              className="flex items-center gap-1.5 cursor-pointer select-none hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
              onClick={() => {
                if (onToggleTripVisibility) onToggleTripVisibility(idx)
                else
                  setInternalHidden((prev) => {
                    const next = new Set(prev)
                    if (next.has(idx)) next.delete(idx)
                    else next.add(idx)
                    return next
                  })
              }}
            >
              <span
                className="rounded-full shrink-0 border"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: isHidden
                    ? "transparent"
                    : TRIP_LINE_COLORS[idx % TRIP_LINE_COLORS.length],
                  borderColor: TRIP_LINE_COLORS[idx % TRIP_LINE_COLORS.length],
                }}
              />
              <span
                className={`truncate max-w-[150px] ${isHidden ? "line-through opacity-50" : ""}`}
              >
                {trip.trip_headsign || trip.trip_id}
              </span>
            </div>
          )
        })}
      </div>
    ) : undefined

  return (
    <div className="rounded-md border shadow-sm">
      <div className={`${heightClassName} overflow-hidden`}>
        <MapContainer
          instructionText={
            editable
              ? clickedStop
                ? `Stop #${clickedStop.sequence} selected`
                : "Click a stop to select and edit"
              : "Click stops or segments for details"
          }
          clickPopup={popup}
          popupPosition="bottom-right"
          showLegend={Boolean(legend)}
          legendContent={legend}
        >
          <MapSection
            stopPoints={stopPoints}
            segments={segments}
            paths={paths}
            clickedStop={clickedStop}
            clickedSegment={clickedSegment}
            viewState={viewState}
            setViewState={setViewState}
            boundBox={boundBox}
            fitZoom={fitZoom}
            editable={editable}
            deletedStopIndices={deletedStopIndices}
            selectedStopIdx={selectedStopIdx}
            stopStatusMap={stopStatusMap}
            previewStop={previewStop}
            externalPreview={externalPreview}
            onDragStop={onDragStop}
            onSelectStop={onSelectStop}
            onClickStop={(stop) => {
              setClickedStop(stop)
              if (stop && onClickAnyStop) {
                onClickAnyStop({
                  tripIdx: stop.tripIdx,
                  stopIdx: stop.stopIdx,
                  name: stop.name,
                  stopId: stop.stopId,
                  arrivalTime: stop.arrivalTime,
                  departureTime: stop.departureTime,
                  parentStation: stop.parentStation,
                })
              }
            }}
            onClickSegment={setClickedSegment}
            hiddenTripIndices={hiddenTripIndices}
            highlightedSegmentRange={highlightedSegmentRange}
            highlightedSegmentColor={highlightedSegmentColor}
          />
        </MapContainer>
      </div>
    </div>
  )
}
