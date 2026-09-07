import { useCallback, useEffect, useRef, useState } from "react"
import {
  type EditableStop,
  type TripInfo,
  type RouteStopOption,
  type TripStopTime,
  getEditableStopStatus,
  TRIP_LINE_COLORS,
  timeToSec,
  secToTime,
  fmtTime,
} from "@/lib/tripUtils"

export function EditableTimeline({
  trips,
  onUpdateStop,
  onUpdateStopBoth,
  routeStops: _routeStops = [],
  onAddStop: _onAddStop,
  onCreateStop: _onCreateStop,
  addStopPreview,
  onAddArrivalChange,
  onAddDepartureChange,
  readOnly: _readOnly,
  originalStops,
  selectedStopIdx,
  onSelectStop,
  onInsertAt,
  onDragStart: onDragStartCb,
}: {
  trips: Array<{ trip: TripInfo; stops: EditableStop[] }>
  onUpdateStop: (
    tripIdx: number,
    stopIdx: number,
    field: "arrival_time" | "departure_time",
    value: string,
  ) => void
  onUpdateStopBoth?: (tripIdx: number, stopIdx: number, arrival: string, departure: string) => void
  routeStops?: RouteStopOption[]
  onAddStop?: (stop: RouteStopOption, arrival: string, departure: string) => void
  onCreateStop?: () => void
  addStopPreview?: { name: string; arrival: string; departure: string; stopSequence?: number }
  onAddArrivalChange?: (v: string) => void
  onAddDepartureChange?: (v: string) => void
  readOnly?: boolean
  originalStops?: TripStopTime[]
  selectedStopIdx?: number | null
  onSelectStop?: (idx: number | null) => void
  onInsertAt?: (seq: number, arrival: string, departure: string) => void
  onDragStart?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const showAddPanel = false
  const [, setAddArrival] = useState("")
  const [, setAddDeparture] = useState("")
  const selectedAddStop = undefined as RouteStopOption | undefined
  const [placingPreview, setPlacingPreview] = useState<{ sec: number; depSec?: number } | null>(
    null,
  )
  const isPlacingRef = useRef<false | "arr" | "dep">(false)
  const [hoverX, setHoverX] = useState<number | null>(null)

  // Clear stale preview when parent's add completes (addStopPreview becomes undefined)
  const prevAddStopPreviewRef = useRef(addStopPreview)
  if (prevAddStopPreviewRef.current && !addStopPreview) {
    setPlacingPreview(null)
    isPlacingRef.current = false
  }
  prevAddStopPreviewRef.current = addStopPreview

  const dragRef = useRef<{
    tripIdx: number
    stopIdx: number
    field: "arrival_time" | "departure_time" | "both"
    offsetSec?: number
    duration?: number
  } | null>(null)
  const didDragRef = useRef(false)
  const interactiveClickRef = useRef(false)

  // global time bounds
  let minTime = Infinity
  let maxTime = -Infinity
  let maxStops = 0
  for (const { stops } of trips) {
    if (stops.length > maxStops) maxStops = stops.length
    for (const s of stops) {
      const arr = timeToSec(s.arrival_time)
      const dep = timeToSec(s.departure_time)
      if (arr != null) {
        if (arr < minTime) minTime = arr
        if (arr > maxTime) maxTime = arr
      }
      if (dep != null) {
        if (dep < minTime) minTime = dep
        if (dep > maxTime) maxTime = dep
      }
    }
  }

  // Include preview times so timeline renders when only a preview exists
  if (addStopPreview) {
    const pArr = timeToSec(addStopPreview.arrival)
    const pDep = timeToSec(addStopPreview.departure)
    if (pArr != null) {
      if (pArr < minTime) minTime = pArr
      if (pArr > maxTime) maxTime = pArr
    }
    if (pDep != null) {
      if (pDep < minTime) minTime = pDep
      if (pDep > maxTime) maxTime = pDep
    }
  }

  const paddingLeft = 40
  const paddingRight = 60

  // Zoom hooks — must be called before early returns to satisfy Rules of Hooks
  const zoomRef = useRef(zoomLevel)
  zoomRef.current = zoomLevel
  const baseWidthRef = useRef(Math.max(800, maxStops * 80))
  baseWidthRef.current = Math.max(800, maxStops * 80)

  const handleWheel = useCallback((e: WheelEvent) => {
    const container = containerRef.current
    if (!container) return

    // Horizontal scroll (deltaX or shift+wheel) → pan along time axis natively
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return // let browser handle horizontal scroll

    // Vertical scroll → zoom time intervals
    e.preventDefault()
    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left + container.scrollLeft
    const curZoom = zoomRef.current
    const bw = baseWidthRef.current
    const oldTotal = paddingLeft + Math.round(bw * curZoom) + paddingRight
    const mouseRatio = mouseX / oldTotal

    const delta = e.deltaY > 0 ? 0.85 : 1.18
    const newZoom = Math.max(0.3, Math.min(8, curZoom * delta))
    zoomRef.current = newZoom
    setZoomLevel(newZoom)

    requestAnimationFrame(() => {
      const newTotal = paddingLeft + Math.round(bw * newZoom) + paddingRight
      container.scrollLeft = Math.max(0, mouseRatio * newTotal - (e.clientX - rect.left))
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [handleWheel])

  if (minTime === Infinity) {
    return null
  }

  // Add padding so stops can be dragged past current min/max
  const timePad = Math.max(1800, Math.round((maxTime - minTime) * 0.2)) // 30 min or 20% of range
  const chartMinTime = Math.max(0, minTime - timePad)
  const chartMaxTime = maxTime + timePad
  const timeSpan = chartMaxTime - chartMinTime || 1
  const labelHeight = 70
  const laneHeight = 70
  const laneGap = 20
  const baseChartWidth = Math.max(800, maxStops * 80)
  const chartWidth = Math.round(baseChartWidth * zoomLevel)
  const totalWidth = paddingLeft + chartWidth + paddingRight
  const totalHeight = labelHeight + trips.length * (laneHeight + laneGap) + 30
  const timeToX = (sec: number) =>
    Math.round(paddingLeft + ((sec - chartMinTime) / timeSpan) * chartWidth)
  const xToTime = (x: number) =>
    Math.round(chartMinTime + ((x - paddingLeft) / chartWidth) * timeSpan)

  const stepSeconds = Math.max(
    300,
    Math.ceil(timeSpan / Math.max(8, Math.floor(chartWidth / 80)) / 300) * 300,
  )
  const axisTicks: number[] = []
  for (
    let t = Math.floor(chartMinTime / stepSeconds) * stepSeconds;
    t <= chartMaxTime + stepSeconds;
    t += stepSeconds
  ) {
    if (t >= chartMinTime && t <= chartMaxTime) axisTicks.push(t)
  }
  const axisY = totalHeight - 20

  const showTip = (e: React.MouseEvent, text: string) => {
    const container = containerRef.current
    const tip = tooltipRef.current
    if (!container || !tip) return
    const rect = container.getBoundingClientRect()
    tip.style.left = `${e.clientX - rect.left + 12}px`
    tip.style.top = `${e.clientY - rect.top - 10}px`
    tip.style.display = "block"
    tip.innerHTML = text
      .split("\n")
      .map(
        (line, i) =>
          `<div class="${i === 0 ? "font-medium" : "text-muted-foreground"}">${line}</div>`,
      )
      .join("")
  }
  const hideTip = () => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none"
  }

  const handleMouseDown = (
    e: React.MouseEvent,
    tripIdx: number,
    stopIdx: number,
    field: "arrival_time" | "departure_time" | "both",
    offsetSec?: number,
  ) => {
    e.preventDefault() // prevent text selection during drag
    e.stopPropagation()
    didDragRef.current = false
    interactiveClickRef.current = true
    let dur = 0
    if (field === "both") {
      const stop = trips[tripIdx]?.stops[stopIdx]
      const a = timeToSec(stop?.arrival_time)
      const d = timeToSec(stop?.departure_time)
      dur = a != null && d != null ? d - a : 0
    }
    dragRef.current = { tripIdx, stopIdx, field, offsetSec: offsetSec ?? 0, duration: dur }
    onDragStartCb?.()
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    didDragRef.current = true
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const svgX = e.clientX - rect.left
    const rawSec = Math.max(0, xToTime(svgX))
    const sec = Math.round(rawSec / 60) * 60
    const { tripIdx, stopIdx, field, duration } = dragRef.current
    if (field === "both") {
      const dur = duration ?? 0
      const newArr = Math.max(0, sec)
      if (stopIdx === -1) {
        // Preview stop drag — update parent's add times
        onAddArrivalChange?.(secToTime(newArr))
        onAddDepartureChange?.(secToTime(newArr + dur))
      } else if (onUpdateStopBoth) {
        onUpdateStopBoth(tripIdx, stopIdx, secToTime(newArr), secToTime(newArr + dur))
      } else {
        onUpdateStop(tripIdx, stopIdx, "arrival_time", secToTime(newArr))
        onUpdateStop(tripIdx, stopIdx, "departure_time", secToTime(newArr + dur))
      }
    } else {
      // Clamp so arrival never exceeds departure and vice versa
      const stop = trips[tripIdx]?.stops[stopIdx]
      let clampedSec = sec
      if (field === "arrival_time") {
        const depSec = timeToSec(stop?.departure_time)
        if (depSec != null && sec > depSec) clampedSec = depSec
      } else if (field === "departure_time") {
        const arrSec = timeToSec(stop?.arrival_time)
        if (arrSec != null && sec < arrSec) clampedSec = arrSec
      }
      onUpdateStop(tripIdx, stopIdx, field, secToTime(clampedSec))
    }

    const tip = tooltipRef.current
    if (tip && containerRef.current) {
      const cRect = containerRef.current.getBoundingClientRect()
      tip.style.left = `${e.clientX - cRect.left + 12}px`
      tip.style.top = `${e.clientY - cRect.top - 10}px`
      tip.style.display = "block"
      const fieldLabel = field === "both" ? "" : field === "arrival_time" ? "arr " : "dep "
      tip.innerHTML = `<div class="font-medium">${fieldLabel}${fmtTime(field === "both" ? sec : field === "arrival_time" ? Math.min(sec, timeToSec(trips[tripIdx]?.stops[stopIdx]?.departure_time) ?? sec) : Math.max(sec, timeToSec(trips[tripIdx]?.stops[stopIdx]?.arrival_time) ?? sec))}</div>`
    }
  }

  const handleMouseUp = () => {
    dragRef.current = null
    hideTip()
  }

  return (
    <div className="rounded-md border shadow-sm overflow-hidden">
      <div className="border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {trips.map(({ trip }, idx) => (
            <span key={trip.trip_id} className="flex items-center gap-1.5">
              <span
                className="rounded-full shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: TRIP_LINE_COLORS[idx % TRIP_LINE_COLORS.length],
                }}
              />
              <span className="truncate max-w-[200px] font-medium">
                {trip.trip_headsign || trip.trip_id}
              </span>
            </span>
          ))}
          <span className="ml-2 pl-2 border-l italic">
            {addStopPreview || (showAddPanel && selectedAddStop)
              ? "Click timeline to place stop, drag to set range"
              : onInsertAt
                ? "Click to add stop, click bar to edit"
                : "Drag dots to change times"}{" "}
            · Scroll to zoom
          </span>
        </div>
      </div>
      <div ref={containerRef} className="overflow-x-auto relative">
        <div
          ref={tooltipRef}
          className="absolute z-50 pointer-events-none rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md font-medium"
          style={{ display: "none" }}
        />
        <svg
          width={totalWidth}
          height={totalHeight}
          className="block"
          onMouseMove={(e) => {
            handleMouseMove(e)
            // Track hover position for cursor indicator (only when not dragging)
            if (!dragRef.current && !isPlacingRef.current && onInsertAt) {
              const svgRect = e.currentTarget.getBoundingClientRect()
              const x = e.clientX - svgRect.left
              setHoverX(x)
            } else {
              setHoverX(null)
            }
            // Dragging preview handle (arr or dep)
            if (isPlacingRef.current) {
              const svgRect = e.currentTarget.getBoundingClientRect()
              const svgX = e.clientX - svgRect.left
              const sec = Math.max(0, Math.round(xToTime(svgX) / 60) * 60)
              if (isPlacingRef.current === "arr") {
                const depSec =
                  placingPreview?.depSec ??
                  (addStopPreview ? timeToSec(addStopPreview.departure) : undefined) ??
                  sec
                const arrSec = Math.min(sec, depSec)
                if (placingPreview)
                  setPlacingPreview((prev) => (prev ? { ...prev, sec: arrSec } : null))
                setAddArrival(secToTime(arrSec))
                onAddArrivalChange?.(secToTime(arrSec))
              } else {
                const arrSec =
                  placingPreview?.sec ??
                  (addStopPreview ? timeToSec(addStopPreview.arrival) : undefined) ??
                  sec
                const depSec = Math.max(sec, arrSec)
                if (placingPreview) setPlacingPreview((prev) => (prev ? { ...prev, depSec } : null))
                setAddDeparture(secToTime(depSec))
                onAddDepartureChange?.(secToTime(depSec))
              }
              const tip = tooltipRef.current
              if (tip && containerRef.current) {
                const cRect = containerRef.current.getBoundingClientRect()
                tip.style.left = `${e.clientX - cRect.left + 12}px`
                tip.style.top = `${e.clientY - cRect.top - 10}px`
                tip.style.display = "block"
                tip.textContent = `${isPlacingRef.current === "arr" ? "arr" : "dep"} ${fmtTime(sec)}`
              }
            }
          }}
          onMouseUp={() => {
            handleMouseUp()
            if (isPlacingRef.current) {
              isPlacingRef.current = false
              hideTip()
            }
            // Clear after a tick so click event (which fires after mouseup) can still check them,
            // but they won't be stale for the NEXT click if no click event fired (drag ended on different element)
            requestAnimationFrame(() => {
              interactiveClickRef.current = false
              didDragRef.current = false
            })
          }}
          onMouseLeave={() => {
            handleMouseUp()
            hideTip()
            isPlacingRef.current = false
            didDragRef.current = false
            interactiveClickRef.current = false
            setHoverX(null)
          }}
          onClick={(e) => {
            if (interactiveClickRef.current) {
              interactiveClickRef.current = false
              return
            }
            if (didDragRef.current) {
              didDragRef.current = false
              return
            }
            if (dragRef.current || isPlacingRef.current) return
            const svgRect = e.currentTarget.getBoundingClientRect()
            const svgX = e.clientX - svgRect.left
            const sec = Math.max(0, Math.round(xToTime(svgX) / 60) * 60)
            const time = secToTime(sec)
            if (addStopPreview) {
              // Add preview active — update times at clicked position
              const primaryStops = trips[0]?.stops || []
              let insertPos = primaryStops.length + 1
              for (let i = 0; i < primaryStops.length; i++) {
                const sSec =
                  timeToSec(primaryStops[i].arrival_time) ??
                  timeToSec(primaryStops[i].departure_time)
                if (sSec != null && sSec > sec) {
                  insertPos = i + 1
                  break
                }
              }
              onInsertAt?.(insertPos, time, time)
            } else if (showAddPanel && selectedAddStop) {
              setAddArrival(time)
              setAddDeparture(time)
              setPlacingPreview({ sec, depSec: sec })
            } else if (selectedStopIdx != null && onSelectStop) {
              onSelectStop(null)
            } else if (onInsertAt) {
              // Compute insert position based on clicked time
              const primaryStops = trips[0]?.stops || []
              let insertPos = primaryStops.length + 1
              for (let i = 0; i < primaryStops.length; i++) {
                const sSec =
                  timeToSec(primaryStops[i].arrival_time) ??
                  timeToSec(primaryStops[i].departure_time)
                if (sSec != null && sSec > sec) {
                  insertPos = i + 1
                  break
                }
              }
              onInsertAt(insertPos, time, time)
            } else {
              const margin = Math.max(60, Math.round((timeSpan / chartWidth) * 10))
              const stopsAtTime: string[] = []
              for (const { stops } of trips) {
                for (const s of stops) {
                  const a = timeToSec(s.arrival_time)
                  const d = timeToSec(s.departure_time)
                  const sMin = a ?? d
                  const sMax = d ?? a
                  if (
                    sMin != null &&
                    sMax != null &&
                    sec >= sMin - margin &&
                    sec <= sMax + margin
                  ) {
                    const name = s.stop_name || s.stop_id || "Stop"
                    const timeStr =
                      sMin !== sMax ? `${fmtTime(sMin)}-${fmtTime(sMax)}` : fmtTime(sMin)
                    stopsAtTime.push(`${name} (${timeStr})`)
                  }
                }
              }
              const tip = tooltipRef.current
              if (tip && containerRef.current) {
                const cRect = containerRef.current.getBoundingClientRect()
                tip.style.left = `${e.clientX - cRect.left + 12}px`
                tip.style.top = `${e.clientY - cRect.top - 10}px`
                tip.style.display = "block"
                const lines = [`<div class="font-medium">${fmtTime(sec)}</div>`]
                for (const s of stopsAtTime) {
                  lines.push(`<div class="text-muted-foreground">${s}</div>`)
                }
                tip.innerHTML = lines.join("")
                setTimeout(() => {
                  tip.style.display = "none"
                }, 3000)
              }
            }
          }}
          style={{
            cursor: isPlacingRef.current
              ? "ew-resize"
              : dragRef.current
                ? "grabbing"
                : addStopPreview || (showAddPanel && selectedAddStop)
                  ? "crosshair"
                  : "default",
          }}
        >
          {/* Background */}
          <rect x={0} y={0} width={totalWidth} height={totalHeight} fill="transparent" />

          {/* Hover cursor indicator */}
          {hoverX != null && hoverX >= paddingLeft && hoverX <= paddingLeft + chartWidth && (
            <g style={{ pointerEvents: "none" }}>
              <line
                x1={hoverX}
                y1={labelHeight - 10}
                x2={hoverX}
                y2={axisY}
                stroke="#f59e0b"
                strokeWidth={1}
                strokeDasharray="4,3"
                opacity={0.4}
              />
              <text
                x={hoverX}
                y={axisY + 16}
                textAnchor="middle"
                fill="#f59e0b"
                fontSize={10}
                opacity={0.6}
              >
                {fmtTime(Math.max(0, Math.round(xToTime(hoverX) / 60) * 60))}
              </text>
            </g>
          )}

          {/* Time axis */}
          <line
            x1={paddingLeft}
            y1={axisY}
            x2={paddingLeft + chartWidth}
            y2={axisY}
            stroke="currentColor"
            strokeWidth={1}
            opacity={0.2}
          />
          {axisTicks.map((t) => {
            const x = timeToX(t)
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={axisY - 4}
                  x2={x}
                  y2={axisY + 4}
                  stroke="currentColor"
                  strokeWidth={1}
                  opacity={0.3}
                />
                <line
                  x1={x}
                  y1={labelHeight - 10}
                  x2={x}
                  y2={axisY}
                  stroke="currentColor"
                  strokeWidth={0.5}
                  strokeDasharray="3,4"
                  opacity={0.08}
                />
                <text
                  x={x}
                  y={axisY + 16}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize={11}
                  opacity={0.5}
                >
                  {fmtTime(t)}
                </text>
              </g>
            )
          })}

          {/* Trip lanes */}
          {trips.map(({ trip, stops }, ti) => {
            const color = TRIP_LINE_COLORS[ti % TRIP_LINE_COLORS.length]
            const baseLaneY = labelHeight + ti * (laneHeight + laneGap) + laneHeight / 2

            const pts = stops.flatMap((s, si) => {
              const arrSec = timeToSec(s.arrival_time)
              const depSec = timeToSec(s.departure_time)
              const sec = depSec ?? arrSec
              return sec != null ? [{ ...s, si, sec, arrSec, depSec }] : []
            })

            const stopStatus = new Map<number, TripStopTime["edit_status"]>()
            if (ti === 0) {
              for (let i = 0; i < stops.length; i++) {
                const stop = stops[i]
                const original =
                  originalStops && stop._idx < originalStops.length
                    ? originalStops[stop._idx]
                    : undefined
                const status = originalStops
                  ? getEditableStopStatus(stop, original)
                  : stop.edit_status
                if (status) stopStatus.set(i, status)
              }
            }

            // Compute vertical offsets — only shift when bars visually overlap in pixels
            const barH = 16
            const barGap = 2
            const minBarPx = 14

            // If there's a preview, compute its pixel range so existing overlapping stops shift up
            let previewLeft = -Infinity
            let previewRight = -Infinity
            const extArrSec = addStopPreview ? timeToSec(addStopPreview.arrival) : undefined
            const extDepSec = addStopPreview ? timeToSec(addStopPreview.departure) : undefined
            if (placingPreview && ti === 0) {
              const pA = placingPreview.sec
              const pD = placingPreview.depSec ?? pA
              previewLeft = timeToX(pA) - (pA === pD ? minBarPx / 2 : 0)
              previewRight = timeToX(pD) + (pA === pD ? minBarPx / 2 : 0)
            } else if (extArrSec != null && ti === 0) {
              const pA = extArrSec
              const pD = extDepSec ?? pA
              previewLeft = timeToX(pA) - (pA === pD ? minBarPx / 2 : 0)
              previewRight = timeToX(pD) + (pA === pD ? minBarPx / 2 : 0)
            }
            // Preview sequence for label shifting
            const previewSeq = addStopPreview?.stopSequence
            const hasTimePreview = previewLeft > -Infinity

            const offsets: number[] = []
            for (let i = 0; i < pts.length; i++) {
              const aI = pts[i].arrSec ?? pts[i].sec
              const dI = pts[i].depSec ?? pts[i].sec
              const leftI = timeToX(aI) - (aI === dI ? minBarPx / 2 : 0)
              const rightI = timeToX(dI) + (aI === dI ? minBarPx / 2 : 0)
              let row = 0

              // Check overlap with preview (preview sits on row 0, so existing must shift up)
              if (previewLeft > -Infinity && leftI < previewRight && rightI > previewLeft) {
                row = 1
              }

              // Check overlap with other existing bars
              for (let j = 0; j < i; j++) {
                if (offsets[j] !== row) continue
                const aJ = pts[j].arrSec ?? pts[j].sec
                const dJ = pts[j].depSec ?? pts[j].sec
                const leftJ = timeToX(aJ) - (aJ === dJ ? minBarPx / 2 : 0)
                const rightJ = timeToX(dJ) + (aJ === dJ ? minBarPx / 2 : 0)
                if (leftI < rightJ && rightI > leftJ) {
                  row++
                }
              }
              offsets.push(row)
            }

            return (
              <g key={trip.trip_id}>
                {/* Line — spans min to max time across all stops (including preview) */}
                {pts.length > 0 &&
                  (() => {
                    let lineMin = Infinity,
                      lineMax = -Infinity
                    for (const p of pts) {
                      const a = p.arrSec ?? p.sec
                      const d = p.depSec ?? p.sec
                      if (a < lineMin) lineMin = a
                      if (d > lineMax) lineMax = d
                    }
                    // Extend line to include preview stop
                    if (ti === 0) {
                      if (placingPreview) {
                        if (placingPreview.sec < lineMin) lineMin = placingPreview.sec
                        const pd = placingPreview.depSec ?? placingPreview.sec
                        if (pd > lineMax) lineMax = pd
                      } else if (addStopPreview) {
                        const pa = timeToSec(addStopPreview.arrival)
                        const pd = timeToSec(addStopPreview.departure)
                        if (pa != null && pa < lineMin) lineMin = pa
                        if (pd != null && pd > lineMax) lineMax = pd
                        if (pa != null && pa > lineMax) lineMax = pa
                        if (pd != null && pd < lineMin) lineMin = pd
                      }
                    }
                    if (lineMin === Infinity) return null
                    return (
                      <line
                        x1={timeToX(lineMin)}
                        y1={baseLaneY}
                        x2={timeToX(lineMax)}
                        y2={baseLaneY}
                        stroke={color}
                        strokeWidth={2}
                        opacity={0.3}
                      />
                    )
                  })()}

                {/* Stop range bars */}
                {pts.map((p, pi) => {
                  const aSec = p.arrSec ?? p.sec
                  const dSec = p.depSec ?? p.sec
                  const arrX = timeToX(aSec)
                  const depX = timeToX(dSec)
                  const barW = Math.max(depX - arrX, 22)
                  const barX = depX > arrX ? arrX : arrX - 11
                  const row = offsets[pi] || 0
                  const laneY = baseLaneY - row * (barH + barGap)
                  const displaySeq =
                    hasTimePreview && previewSeq && p.si + 1 >= previewSeq ? p.si + 2 : p.si + 1
                  const shortId =
                    (p.stop_id || "").length > 10
                      ? (p.stop_id || "").slice(0, 8) + "..."
                      : p.stop_id || ""
                  const editStatus = stopStatus.get(p.si)
                  const isChanged = !!editStatus
                  const isSelected = ti === 0 && selectedStopIdx === p.si
                  const editColor =
                    editStatus === "new" ? "#22c55e" : editStatus === "edit" ? "#f59e0b" : color
                  const barColor = isSelected ? "#f59e0b" : editColor
                  const labelColor = isSelected ? "#f59e0b" : isChanged ? editColor : "currentColor"
                  const idLabel = `#${displaySeq} ${shortId}`
                  const stopLabel = p.stop_name || p.stop_id || ""
                  const tipText =
                    aSec !== dSec
                      ? `${stopLabel}\narr ${fmtTime(aSec)}  dep ${fmtTime(dSec)}`
                      : `${stopLabel}\n${fmtTime(p.sec)}`
                  const handleW = 6

                  return (
                    <g key={p.si} data-stop-idx={ti === 0 ? p.si : undefined}>
                      {/* Label above */}
                      <text
                        x={barX}
                        y={laneY - barH / 2 - 4}
                        textAnchor="start"
                        transform={`rotate(-45, ${barX}, ${laneY - barH / 2 - 4})`}
                        fill={labelColor}
                        fontSize={10}
                        fontWeight={isChanged ? 700 : 500}
                        opacity={0.7}
                        style={{ pointerEvents: "none" }}
                      >
                        {idLabel}
                      </text>

                      {/* Invisible hover zone for tooltip */}
                      <rect
                        x={barX - 4}
                        y={laneY - barH / 2 - 4}
                        width={barW + 8}
                        height={barH + 8}
                        fill="transparent"
                        style={{ pointerEvents: "visible" }}
                        onMouseMove={(e) => showTip(e, tipText)}
                        onMouseLeave={hideTip}
                      />

                      {/* Left handle — arrival */}
                      <rect
                        x={barX}
                        y={laneY - barH / 2}
                        width={handleW}
                        height={barH}
                        rx={2}
                        fill={barColor}
                        opacity={isSelected ? 0.8 : 0.6}
                        style={{ cursor: "w-resize" }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (ti === 0 && onSelectStop && !didDragRef.current)
                            onSelectStop(isSelected ? null : p.si)
                        }}
                        onMouseDown={(e) => handleMouseDown(e, ti, p.si, "arrival_time")}
                      />

                      {/* Main bar body — drag to move whole range, click to select */}
                      <rect
                        x={barX + handleW}
                        y={laneY - barH / 2}
                        width={Math.max(barW - handleW * 2, 4)}
                        height={barH}
                        rx={2}
                        fill={barColor}
                        opacity={isSelected ? 0.5 : 0.3}
                        style={{ cursor: "grab" }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (ti === 0 && onSelectStop && !didDragRef.current)
                            onSelectStop(isSelected ? null : p.si)
                        }}
                        onMouseDown={(e) => handleMouseDown(e, ti, p.si, "both", 0)}
                      />

                      {/* Right handle — departure */}
                      <rect
                        x={barX + barW - handleW}
                        y={laneY - barH / 2}
                        width={handleW}
                        height={barH}
                        rx={2}
                        fill={barColor}
                        opacity={isSelected ? 0.8 : 0.6}
                        style={{ cursor: "e-resize" }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (ti === 0 && onSelectStop && !didDragRef.current)
                            onSelectStop(isSelected ? null : p.si)
                        }}
                        onMouseDown={(e) => handleMouseDown(e, ti, p.si, "departure_time")}
                      />

                      {/* Time label below — only on base row */}
                      {row === 0 && (
                        <text
                          x={barX + barW / 2}
                          y={laneY + barH / 2 + 10}
                          textAnchor="middle"
                          fill={labelColor}
                          fontSize={8}
                          opacity={isChanged ? 0.6 : 0.4}
                          style={{ pointerEvents: "none" }}
                        >
                          {aSec !== dSec ? `${fmtTime(aSec)}-${fmtTime(dSec)}` : fmtTime(p.sec)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* Preview range bar for placing new stop */}
          {placingPreview &&
            trips.length > 0 &&
            (() => {
              const baseLaneY = labelHeight + 0 * (laneHeight + laneGap) + laneHeight / 2
              const aSec = placingPreview.sec
              const dSec = placingPreview.depSec ?? aSec
              const arrX = timeToX(aSec)
              const depX = timeToX(dSec)
              const barW = Math.max(depX - arrX, 22)
              const barX = depX > arrX ? arrX : arrX - 11
              const barH = 16
              const handleW = 6
              const pvColor = "#f59e0b"

              const laneY = baseLaneY
              const label =
                addStopPreview?.name ||
                selectedAddStop?.stop_name ||
                selectedAddStop?.stop_id ||
                "New"
              const shortLabel = label.length > 15 ? label.slice(0, 13) + "..." : label
              const seqNum = addStopPreview?.stopSequence
              const seqLabel = seqNum ? `#${seqNum}` : ""
              return (
                <g>
                  <text
                    x={barX}
                    y={laneY - barH / 2 - (seqLabel ? 14 : 4)}
                    textAnchor="start"
                    transform={`rotate(-45, ${barX}, ${laneY - barH / 2 - (seqLabel ? 14 : 4)})`}
                    fill={pvColor}
                    fontSize={10}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                  >
                    {shortLabel}
                  </text>
                  {seqLabel && (
                    <text
                      x={barX}
                      y={laneY - barH / 2 - 4}
                      textAnchor="start"
                      transform={`rotate(-45, ${barX}, ${laneY - barH / 2 - 4})`}
                      fill={pvColor}
                      fontSize={8}
                      opacity={0.7}
                      style={{ pointerEvents: "none" }}
                    >
                      {seqLabel}
                    </text>
                  )}

                  {/* Left handle */}
                  <rect
                    x={barX}
                    y={laneY - barH / 2}
                    width={handleW}
                    height={barH}
                    rx={2}
                    fill={pvColor}
                    opacity={0.6}
                    style={{ cursor: "w-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      isPlacingRef.current = "arr"
                      interactiveClickRef.current = true
                    }}
                  />

                  {/* Middle body — drag to move */}
                  <rect
                    x={barX + handleW}
                    y={laneY - barH / 2}
                    width={Math.max(barW - handleW * 2, 4)}
                    height={barH}
                    rx={2}
                    fill={pvColor}
                    opacity={0.3}
                    style={{ cursor: "grab" }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      interactiveClickRef.current = true
                      const dur = Math.max(0, dSec - aSec)
                      dragRef.current = { tripIdx: 0, stopIdx: -1, field: "both", duration: dur }
                      didDragRef.current = false
                    }}
                  />

                  {/* Right handle */}
                  <rect
                    x={barX + barW - handleW}
                    y={laneY - barH / 2}
                    width={handleW}
                    height={barH}
                    rx={2}
                    fill={pvColor}
                    opacity={0.6}
                    style={{ cursor: "e-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      isPlacingRef.current = "dep"
                      interactiveClickRef.current = true
                    }}
                  />

                  {/* Time label */}
                  <text
                    x={barX + barW / 2}
                    y={laneY + barH / 2 + 12}
                    textAnchor="middle"
                    fill={pvColor}
                    fontSize={9}
                    opacity={0.7}
                    style={{ pointerEvents: "none" }}
                  >
                    {aSec !== dSec ? `${fmtTime(aSec)}-${fmtTime(dSec)}` : fmtTime(aSec)}
                  </text>
                </g>
              )
            })()}

          {/* External preview from parent add-stop panel */}
          {!placingPreview &&
            addStopPreview &&
            trips.length > 0 &&
            (() => {
              const aSec = timeToSec(addStopPreview.arrival)
              const dSec = timeToSec(addStopPreview.departure)
              if (aSec == null && dSec == null) return null
              const a = aSec ?? dSec!
              const d = dSec ?? a
              const baseLaneY = labelHeight + 0 * (laneHeight + laneGap) + laneHeight / 2
              const arrX = timeToX(a)
              const depX = timeToX(d)
              const barW = Math.max(depX - arrX, 22)
              const barX = depX > arrX ? arrX : arrX - 11
              const barH = 16
              const handleW = 6
              const previewColor = "#f59e0b" // amber/yellow for selected preview
              const label =
                addStopPreview.name.length > 15
                  ? addStopPreview.name.slice(0, 13) + "..."
                  : addStopPreview.name
              const seqLabel = addStopPreview.stopSequence ? `#${addStopPreview.stopSequence}` : ""
              return (
                <g data-stop-preview="true">
                  <text
                    x={barX}
                    y={baseLaneY - barH / 2 - 14}
                    textAnchor="start"
                    transform={`rotate(-45, ${barX}, ${baseLaneY - barH / 2 - 14})`}
                    fill={previewColor}
                    fontSize={10}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                  >
                    {label}
                  </text>
                  {seqLabel && (
                    <text
                      x={barX}
                      y={baseLaneY - barH / 2 - 4}
                      textAnchor="start"
                      transform={`rotate(-45, ${barX}, ${baseLaneY - barH / 2 - 4})`}
                      fill={previewColor}
                      fontSize={8}
                      opacity={0.7}
                      style={{ pointerEvents: "none" }}
                    >
                      {seqLabel}
                    </text>
                  )}
                  {/* Left handle — drag to change arrival */}
                  <rect
                    x={barX}
                    y={baseLaneY - barH / 2}
                    width={handleW}
                    height={barH}
                    rx={2}
                    fill={previewColor}
                    opacity={0.6}
                    style={{ cursor: "w-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      isPlacingRef.current = "arr"
                      interactiveClickRef.current = true
                    }}
                  />
                  {/* Middle body — drag to move whole range */}
                  <rect
                    x={barX + handleW}
                    y={baseLaneY - barH / 2}
                    width={Math.max(barW - handleW * 2, 4)}
                    height={barH}
                    rx={2}
                    fill={previewColor}
                    opacity={0.3}
                    style={{ cursor: "grab" }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      interactiveClickRef.current = true
                      // Store initial state for "both" drag
                      const dur = Math.max(0, d - a)
                      dragRef.current = { tripIdx: 0, stopIdx: -1, field: "both", duration: dur }
                      didDragRef.current = false
                    }}
                  />
                  {/* Right handle — drag to change departure */}
                  <rect
                    x={barX + barW - handleW}
                    y={baseLaneY - barH / 2}
                    width={handleW}
                    height={barH}
                    rx={2}
                    fill={previewColor}
                    opacity={0.6}
                    style={{ cursor: "e-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      isPlacingRef.current = "dep"
                      interactiveClickRef.current = true
                    }}
                  />
                  <text
                    x={barX + barW / 2}
                    y={baseLaneY + barH / 2 + 12}
                    textAnchor="middle"
                    fill={previewColor}
                    fontSize={9}
                    opacity={0.7}
                    style={{ pointerEvents: "none" }}
                  >
                    {a !== d ? `${fmtTime(a)}-${fmtTime(d)}` : fmtTime(a)}
                  </text>
                </g>
              )
            })()}
        </svg>
      </div>
    </div>
  )
}
