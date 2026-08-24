import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TRIP_LINE_COLORS, type TripStopTime, type TripInfo, fmtTime, timeToSec } from "@/lib/tripUtils";

export function TripTimeline({ trips, selectedStopIdx, onSelectStop, selectedTripIdx, onSelectStopWithTrip, hiddenTripIndices }: {
  trips: Array<{ trip: TripInfo; stopTimes: TripStopTime[] }>;
  selectedStopIdx?: number | null;
  onSelectStop?: (idx: number | null) => void;
  selectedTripIdx?: number;
  onSelectStopWithTrip?: (tripIdx: number, stopIdx: number | null) => void;
  hiddenTripIndices?: Set<number>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const showTooltip = useCallback((e: React.MouseEvent, lines: string[]) => {
    const container = containerRef.current;
    const tip = tooltipRef.current;
    if (!container || !tip) return;
    const rect = container.getBoundingClientRect();
    tip.style.left = `${e.clientX - rect.left + 12}px`;
    tip.style.top = `${e.clientY - rect.top - 10}px`;
    tip.style.display = "block";
    tip.innerHTML = lines.map((line, i) =>
      `<div class="${i === 0 ? "font-medium" : "text-muted-foreground"}">${line}</div>`
    ).join("");
  }, []);
  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (tip) tip.style.display = "none";
  }, []);

  const parsed = useMemo(() => trips.map(({ trip, stopTimes }) => ({
    trip,
    stops: stopTimes.map((st, i) => ({
      stopId: st.stop_id || `${i + 1}`,
      name: st.stop_name || st.stop_id || `Stop ${i + 1}`,
      arrivalSec: timeToSec(st.arrival_time),
      departureSec: timeToSec(st.departure_time),
      editStatus: st.edit_status,
    })),
  })), [trips]);

  let minTime = Infinity;
  let maxTime = -Infinity;
  let maxStops = 0;
  for (const { stops } of parsed) {
    if (stops.length > maxStops) maxStops = stops.length;
    for (const s of stops) {
      if (s.arrivalSec != null) { if (s.arrivalSec < minTime) minTime = s.arrivalSec; if (s.arrivalSec > maxTime) maxTime = s.arrivalSec; }
      if (s.departureSec != null) { if (s.departureSec < minTime) minTime = s.departureSec; if (s.departureSec > maxTime) maxTime = s.departureSec; }
    }
  }

  const paddingLeft = 40;
  const paddingRight = 60;

  // Zoom hooks — must be called before early returns to satisfy Rules of Hooks
  const zoomRef = useRef(zoomLevel);
  zoomRef.current = zoomLevel;
  const baseWidthRef = useRef(800);

  const handleWheel = useCallback((e: WheelEvent) => {
    const container = containerRef.current;
    if (!container) return;

    // Horizontal scroll (deltaX or shift+wheel) → pan along time axis natively
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    // Vertical scroll → zoom time intervals
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left + container.scrollLeft;
    const curZoom = zoomRef.current;
    const bw = baseWidthRef.current;
    const oldTotal = paddingLeft + Math.round(bw * curZoom) + paddingRight;
    const mouseRatio = mouseX / oldTotal;

    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    const newZoom = Math.max(0.3, Math.min(8, curZoom * delta));
    zoomRef.current = newZoom;
    setZoomLevel(newZoom);

    requestAnimationFrame(() => {
      const newTotal = paddingLeft + Math.round(bw * newZoom) + paddingRight;
      container.scrollLeft = Math.max(0, mouseRatio * newTotal - (e.clientX - rect.left));
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  if (minTime === Infinity) {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground text-center">No stop times available</div>;
  }

  const timeSpan = maxTime - minTime || 1;
  const labelHeight = 70;
  const laneHeight = 24;
  const labelRows = 3;
  const labelRowH = 14;
  const laneLabelArea = labelRows * labelRowH + 8;
  const laneGap = 8;
  const dotR = 6;
  const minGap = 60;

  let smallestGap = timeSpan;
  for (const { stops } of parsed) {
    const times = stops
      .map((s) => s.departureSec ?? s.arrivalSec)
      .filter((t): t is number => t != null)
      .sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      if (gap > 0 && gap < smallestGap) smallestGap = gap;
    }
  }
  const baseChartWidth = Math.max(800, Math.round((timeSpan / smallestGap) * minGap));
  baseWidthRef.current = baseChartWidth;
  const chartWidth = Math.round(baseChartWidth * zoomLevel);
  const totalWidth = paddingLeft + chartWidth + paddingRight;
  const laneBlock = laneHeight + laneLabelArea + laneGap;
  const totalHeight = labelHeight + parsed.length * laneBlock + 30;
  const timeToX = (sec: number) => Math.round(paddingLeft + ((sec - minTime) / timeSpan) * chartWidth);
  const xToTime = (x: number) => minTime + ((x - paddingLeft) / chartWidth) * timeSpan;

  const stepSeconds = Math.max(300, Math.ceil(timeSpan / Math.max(8, Math.floor(chartWidth / 80)) / 300) * 300);
  const axisTicks: number[] = [];
  for (let t = Math.floor(minTime / stepSeconds) * stepSeconds; t <= maxTime + stepSeconds; t += stepSeconds) {
    if (t >= minTime - stepSeconds / 2 && t <= maxTime + stepSeconds / 2) axisTicks.push(t);
  }
  const axisY = totalHeight - 20;

  return (
    <div className="rounded-md border shadow-sm overflow-hidden">
      <div className="border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {trips.map(({ trip }, idx) => (
            <span key={trip.trip_id} className="flex items-center gap-1.5">
              <span className="rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: TRIP_LINE_COLORS[idx % TRIP_LINE_COLORS.length] }} />
              <span className="truncate max-w-[200px] font-medium">{trip.trip_headsign || trip.trip_id}</span>
            </span>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="overflow-x-auto relative">
        <div
          ref={tooltipRef}
          className="absolute z-50 pointer-events-none rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={{ display: "none" }}
        />

        <svg width={totalWidth} height={totalHeight} className="block" onMouseLeave={hideTooltip}>
          {/* Time axis */}
          <line x1={paddingLeft} y1={axisY} x2={paddingLeft + chartWidth} y2={axisY} stroke="currentColor" strokeWidth={1} opacity={0.2} />
          {axisTicks.map((t) => {
            const x = timeToX(t);
            return (
              <g key={t}>
                <line x1={x} y1={axisY - 4} x2={x} y2={axisY + 4} stroke="currentColor" strokeWidth={1} opacity={0.3} />
                <line x1={x} y1={labelHeight - 10} x2={x} y2={axisY} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3,4" opacity={0.08} />
                <text x={x} y={axisY + 16} textAnchor="middle" fill="currentColor" fontSize={11} opacity={0.5}>{fmtTime(t)}</text>
              </g>
            );
          })}

          {/* Trip lanes */}
          {parsed.map(({ trip, stops }, ti) => {
            if (hiddenTripIndices?.has(ti)) return null;
            const color = TRIP_LINE_COLORS[ti % TRIP_LINE_COLORS.length];
            const laneY = labelHeight + ti * laneBlock + laneHeight / 2;
            const labelBaseY = laneY + dotR + 10;
            const pts = stops
              .map((s, si) => ({ ...s, idx: si, timeSec: s.departureSec ?? s.arrivalSec }))
              .filter((p) => p.timeSec != null) as Array<{ stopId: string; name: string; arrivalSec?: number; departureSec?: number; editStatus?: "new" | "edit"; idx: number; timeSec: number }>;

            const labelMinPx = 50;
            const rowLastX: number[] = Array(labelRows).fill(-Infinity);
            const labelOffsets = pts.map((p) => {
              const x = timeToX(p.timeSec);
              for (let r = 0; r < labelRows; r++) {
                if (x - rowLastX[r] >= labelMinPx) {
                  rowLastX[r] = x;
                  return r;
                }
              }
              let bestRow = 0;
              let bestDist = 0;
              for (let r = 0; r < labelRows; r++) {
                const dist = x - rowLastX[r];
                if (dist > bestDist) { bestDist = dist; bestRow = r; }
              }
              rowLastX[bestRow] = x;
              return bestRow;
            });

            return (
              <g key={trip.trip_id}>
                <text x={paddingLeft - 6} y={laneY + 4} textAnchor="end" fill={color} fontSize={10} fontWeight={600} opacity={0.7}>
                  {trips.length > 1 ? (ti + 1) : ""}
                </text>

                {/* Visible lines */}
                {pts.map((p, pi) => {
                  if (pi === 0) return null;
                  return (
                    <line key={`vl-${pi}`}
                      x1={timeToX(pts[pi - 1].timeSec)} y1={laneY} x2={timeToX(p.timeSec)} y2={laneY}
                      stroke={color} strokeWidth={2} opacity={0.3} />
                  );
                })}

                {/* Visible dots */}
                {pts.map((p, pi) => {
                  const x = timeToX(p.timeSec);
                  const isPrimarySelected = (selectedTripIdx != null ? selectedTripIdx === ti : ti === 0) && selectedStopIdx === p.idx;
                  const isStopHighlighted = selectedStopIdx === p.idx; // highlight same stop across all trips
                  const canClick = !!(onSelectStop || onSelectStopWithTrip);
                  const editColor = p.editStatus === "new" ? "#22c55e" : p.editStatus === "edit" ? "#f59e0b" : color;
                  return (
                    <g key={`d-${pi}`} data-stop-idx={p.idx}
                      style={{ cursor: canClick ? "pointer" : undefined }}
                      onClick={canClick ? (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (isPrimarySelected) {
                          onSelectStop?.(null);
                          onSelectStopWithTrip?.(ti, null);
                        } else {
                          onSelectStop?.(p.idx);
                          onSelectStopWithTrip?.(ti, p.idx);
                        }
                      } : undefined}>
                      {p.arrivalSec != null && p.departureSec != null && p.departureSec !== p.arrivalSec && (
                        <line x1={timeToX(p.arrivalSec)} y1={laneY} x2={timeToX(p.departureSec)} y2={laneY}
                          stroke={isStopHighlighted ? "#f59e0b" : editColor} strokeWidth={6} opacity={isStopHighlighted ? 0.4 : 0.25} strokeLinecap="round" />
                      )}
                      <circle cx={x} cy={laneY} r={isStopHighlighted ? dotR + 2 : dotR}
                        fill={isPrimarySelected ? "#f59e0b" : isStopHighlighted ? color : editColor}
                        stroke={isStopHighlighted ? "#f59e0b" : "var(--background)"} strokeWidth={isStopHighlighted ? 2.5 : 2} />
                    </g>
                  );
                })}

                {/* Labels below the line */}
                {pts.map((p, pi) => {
                  const x = timeToX(p.timeSec);
                  const row = labelOffsets[pi];
                  const ly = labelBaseY + row * labelRowH;
                  const idLabel = p.stopId.length > 10 ? p.stopId.slice(0, 8) + "..." : p.stopId;
                  return (
                    <g key={`lb-${pi}`}>
                      <line x1={x} y1={laneY + dotR + 1} x2={x} y2={ly - 2}
                        stroke="currentColor" strokeWidth={0.5} opacity={0.15} />
                      <text x={x} y={ly + 9} textAnchor="middle"
                        fill={p.editStatus === "new" ? "#22c55e" : p.editStatus === "edit" ? "#f59e0b" : "currentColor"} fontSize={9} fontWeight={500} opacity={0.6}
                        style={{ pointerEvents: "none" }}>{idLabel}</text>
                    </g>
                  );
                })}

                {/* Hit areas: line segments */}
                {pts.map((p, pi) => {
                  if (pi === 0) return null;
                  const prev = pts[pi - 1];
                  const dur = Math.round((p.timeSec - prev.timeSec) / 60);
                  return (
                    <rect key={`hl-${pi}`}
                      x={Math.min(timeToX(prev.timeSec), timeToX(p.timeSec))}
                      y={laneY - 10} height={20}
                      width={Math.max(4, Math.abs(timeToX(p.timeSec) - timeToX(prev.timeSec)))}
                      fill="transparent" style={{ cursor: "crosshair" }}
                      onMouseMove={(e) => {
                        const container = containerRef.current;
                        if (!container) return;
                        const svgRect = container.querySelector("svg")?.getBoundingClientRect();
                        if (!svgRect) return;
                        const svgX = e.clientX - svgRect.left + container.scrollLeft;
                        const hoverSec = xToTime(svgX);
                        const clampedSec = Math.max(prev.timeSec, Math.min(p.timeSec, hoverSec));
                        showTooltip(e, [
                          fmtTime(clampedSec),
                          `${prev.name} \u2192 ${p.name}`,
                          `${fmtTime(prev.timeSec)} \u2192 ${fmtTime(p.timeSec)} (${dur} min)`,
                        ]);
                      }}
                      onMouseLeave={hideTooltip}
                    />
                  );
                })}

                {/* Hit areas: dots */}
                {pts.map((p, pi) => {
                  const x = timeToX(p.timeSec);
                  const arrStr = p.arrivalSec != null ? fmtTime(p.arrivalSec) : "";
                  const depStr = p.departureSec != null && p.departureSec !== p.arrivalSec ? fmtTime(p.departureSec) : "";
                  const timeLine = depStr ? `arr ${arrStr}  dep ${depStr}` : fmtTime(p.timeSec);
                  const isPrimSel = (selectedTripIdx != null ? selectedTripIdx === ti : ti === 0) && selectedStopIdx === p.idx;
                  const canClick = !!(onSelectStop || onSelectStopWithTrip);
                  return (
                    <circle key={`hp-${pi}`} cx={x} cy={laneY} r={dotR + 8}
                      fill="transparent" style={{ cursor: canClick ? "pointer" : undefined }}
                      onClick={canClick ? (e: React.MouseEvent<SVGCircleElement>) => {
                        e.stopPropagation();
                        if (isPrimSel) { onSelectStop?.(null); onSelectStopWithTrip?.(ti, null); }
                        else { onSelectStop?.(p.idx); onSelectStopWithTrip?.(ti, p.idx); }
                      } : undefined}
                      onMouseMove={(e) => showTooltip(e, [
                        p.name,
                        timeLine,
                        ...(p.editStatus ? [p.editStatus === "new" ? "Added stop" : "Edited stop"] : []),
                      ])}
                      onMouseLeave={hideTooltip}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
