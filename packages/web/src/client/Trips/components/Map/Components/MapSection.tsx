import { useCallback, useMemo, useRef } from "react";
import { PathLayer, ScatterplotLayer, TextLayer, LineLayer, IconLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";

/** Strip accented characters to ASCII so deck.gl's default font atlas can render them */
const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const pathStyleExt = [new PathStyleExtension({ offset: true })];
const DEFAULT_HIGHLIGHTED_SEGMENT_COLOR: [number, number, number, number] = [249, 115, 22, 255];

/** Create a circle icon as a data URL for use with IconLayer */
const makeCircleIcon = (() => {
  const cache = new Map<string, string>();
  return (color: [number, number, number], size = 32, stroke?: [number, number, number]) => {
    const key = `${color}-${size}-${stroke}`;
    if (cache.has(key)) return cache.get(key)!;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const r = size / 2 - 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = `rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const url = canvas.toDataURL();
    cache.set(key, url);
    return url;
  };
})();

/** Create a capsule/pill icon — width varies, height fixed */
const makeCapsuleIcon = (() => {
  const cache = new Map<string, { url: string; w: number; h: number }>();
  return (w: number, h: number, fillColor: string, strokeColor: string, strokeWidth: number) => {
    const key = `${w}-${h}-${fillColor}-${strokeColor}-${strokeWidth}`;
    if (cache.has(key)) return cache.get(key)!;
    const scale = 2; // retina
    const cw = w * scale, ch = h * scale;
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    const r = ch / 2 - strokeWidth * scale;
    const pad = strokeWidth * scale + 1;
    ctx.beginPath();
    ctx.moveTo(pad + r, pad);
    ctx.lineTo(cw - pad - r, pad);
    ctx.arc(cw - pad - r, ch / 2, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(pad + r, ch - pad);
    ctx.arc(pad + r, ch / 2, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * scale;
      ctx.stroke();
    }
    const url = canvas.toDataURL();
    const result = { url, w: cw, h: ch };
    cache.set(key, result);
    return result;
  };
})();
import DeckglMap from "@/components/maps/DeckglMap.lazy";
import { useThemeContext } from "@/context/theme.client";
import { TRIP_LINE_COLORS } from "@/lib/tripUtils";
import { safeHexToRgb } from "@/components/colorUtil";
import type { StopPoint, Segment } from "../types";

interface MapSectionProps {
  stopPoints: StopPoint[];
  segments: Segment[];
  paths: Array<{ path: [number, number][]; tripIdx: number }>;
  clickedStop: StopPoint | null;
  clickedSegment: Segment | null;
  viewState: any;
  setViewState: (v: any) => void;
  boundBox?: [number[], number[]];
  fitZoom: number;
  editable: boolean;
  deletedStopIndices: Set<number>;
  selectedStopIdx?: number | null;
  stopStatusMap: Map<number, string>;
  previewStop: { lon: number; lat: number; name: string } | null;
  externalPreview?: { lon: number; lat: number; name: string; stopSequence?: number } | null;
  onDragStop?: (stopIdx: number, lat: number, lon: number) => void;
  onSelectStop?: (idx: number | null) => void;
  onClickStop: (stop: StopPoint | null) => void;
  onClickSegment: (segment: Segment | null) => void;
  hiddenTripIndices?: Set<number>;
  highlightedSegmentRange?: { fromStopIdx: number; toStopIdx: number };
  highlightedSegmentColor?: [number, number, number, number];
}

export function MapSection({
  stopPoints, segments, paths,
  clickedStop, clickedSegment,
  viewState, setViewState, boundBox, fitZoom,
  editable, deletedStopIndices, selectedStopIdx, stopStatusMap,
  previewStop, externalPreview,
  onDragStop, onSelectStop, onClickStop, onClickSegment,
  hiddenTripIndices,
  highlightedSegmentRange,
  highlightedSegmentColor = DEFAULT_HIGHLIGHTED_SEGMENT_COLOR,
}: MapSectionProps) {
  const { theme } = useThemeContext();
  const isDraggingRef = useRef(false);
  const dragIdxRef = useRef<number | null>(null);
  const stopPointsRef = useRef(stopPoints);
  stopPointsRef.current = stopPoints;

  // Single click handler — same pattern as ShapeDrawMap in TripForm
  const handleClick = useCallback((event: any) => {
    if (isDraggingRef.current) return;
    // Clicked on a stop, overlap dot, or capsule wrapper
    if (event?.object && (event.layer?.id === "trip-stops" || event.layer?.id === "trip-stops-overlap" || event.layer?.id === "trip-stops-overlap-ring")) {
      let stop: StopPoint;
      if (event.layer?.id === "trip-stops" || event.layer?.id === "trip-stops-overlap") {
        // Direct stop point (solo or overlap dot)
        stop = event.object as StopPoint;
      } else {
        // Capsule hit — resolve to the first stop at this location
        const obj = event.object;
        stop = obj.pt ? (obj.pt as StopPoint) : (stopPointsRef.current.find((p) => `${p.lon.toFixed(3)},${p.lat.toFixed(3)}` === `${Number(obj.lon).toFixed(3)},${Number(obj.lat).toFixed(3)}`) || obj);
      }
      // Toggle: deselect if same stop clicked again
      if (clickedStop && clickedStop.stopIdx === stop.stopIdx && clickedStop.tripIdx === stop.tripIdx) {
        onClickStop(null);
        onSelectStop?.(null);
      } else {
        onClickStop(stop);
        onSelectStop?.(stop.stopIdx);
      }
      onClickSegment(null);
      return;
    }
    // Clicked on a segment (LineLayer or PathLayer) — toggle on re-click
    if (event?.object && (event.layer?.id === "trip-segments" || event.layer?.id?.startsWith("trip-path"))) {
      if (event.layer?.id === "trip-segments") {
        const seg = event.object as Segment;
        const isSame = clickedSegment && clickedSegment.fromIdx === seg.fromIdx && clickedSegment.toIdx === seg.toIdx && clickedSegment.tripIdx === seg.tripIdx;
        onClickSegment(isSame ? null : seg);
        onClickStop(null);
        onSelectStop?.(null);
        return;
      } else {
        // PathLayer click: resolve from the path data which contains from/to coords
        const [cLon, cLat] = event.coordinate || [0, 0];
        const pathData = event.object;
        const tripIdx = pathData?.tripIdx ?? 0;
        // Use the path endpoints directly if available (from segRender data)
        const pathCoords = pathData?.path;
        let bestSeg: Segment | null = null;
        if (pathCoords && pathCoords.length === 2) {
          // Find the stop points closest to the path endpoints for this trip
          const pts = stopPointsRef.current.filter((p) => p.tripIdx === tripIdx);
          const findStop = (coord: [number, number]) => {
            let best: StopPoint | null = null; let bd = Infinity;
            for (const p of pts) { const d = (p.lon - coord[0]) ** 2 + (p.lat - coord[1]) ** 2; if (d < bd) { bd = d; best = p; } }
            return best;
          };
          const fromPt = findStop(pathCoords[0]);
          const toPt = findStop(pathCoords[1]);
          if (fromPt && toPt) {
            bestSeg = { from: pathCoords[0], to: pathCoords[1], fromIdx: fromPt.stopIdx, toIdx: toPt.stopIdx,
              fromName: fromPt.name, toName: toPt.name, fromTime: fromPt.departureTime || fromPt.arrivalTime, toTime: toPt.arrivalTime || toPt.departureTime, tripIdx, disabled: false,
              fromStopId: fromPt.stopId, toStopId: toPt.stopId, fromStation: fromPt.parentStation, toStation: toPt.parentStation };
          }
        }
        if (!bestSeg) {
          // Fallback: find closest segment by midpoint
          const pts = stopPointsRef.current.filter((p) => p.tripIdx === tripIdx);
          let bestDist = Infinity;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const mx = (a.lon + b.lon) / 2, my = (a.lat + b.lat) / 2;
            const d = (mx - cLon) ** 2 + (my - cLat) ** 2;
            if (d < bestDist) {
              bestDist = d;
              bestSeg = { from: [a.lon, a.lat], to: [b.lon, b.lat], fromIdx: a.stopIdx, toIdx: b.stopIdx,
                fromName: a.name, toName: b.name, fromTime: a.departureTime || a.arrivalTime, toTime: b.arrivalTime || b.departureTime, tripIdx, disabled: false,
                fromStopId: a.stopId, toStopId: b.stopId, fromStation: a.parentStation, toStation: b.parentStation };
            }
          }
        }
        if (bestSeg) {
          const isSame = clickedSegment && clickedSegment.fromIdx === bestSeg.fromIdx && clickedSegment.toIdx === bestSeg.toIdx && clickedSegment.tripIdx === bestSeg.tripIdx;
          onClickSegment(isSame ? null : bestSeg);
        }
      }
      onClickStop(null);
      onSelectStop?.(null);
      return;
    }
    // Empty space click — deselect
    onClickStop(null);
    onClickSegment(null);
    onSelectStop?.(null);
  }, [onSelectStop, onClickStop, onClickSegment, selectedStopIdx, editable, clickedStop, clickedSegment]);

  const zoomBucket = viewState?.zoom != null ? Math.floor(viewState.zoom) : 14;
  const layers = useMemo(() => {
    if (stopPoints.length === 0 && !previewStop && !externalPreview) return [];
    const isDark = theme === "dark";
    const layerList: any[] = [];
    const hidden = hiddenTripIndices ?? new Set<number>();

    // Filter visible data
    const visibleStops = stopPoints.filter((d) => !hidden.has(d.tripIdx));
    const visiblePaths = paths.filter((p) => !hidden.has(p.tripIdx));
    const visibleTripIds = Array.from(new Set(visibleStops.map((p) => p.tripIdx))).sort();
    const isCompare = visibleTripIds.length > 1;

    // Overlap detection: group stops sharing the same location across trips
    const curZoom = viewState?.zoom ?? 14;
    const segR = curZoom < 11 ? 6 : curZoom < 13 ? 8 : curZoom < 15 ? 10 : 13;
    const segGap = 0;
    const segLen = segR * 2;
    const stopLocKey = (pt: StopPoint) => `${pt.lon.toFixed(3)},${pt.lat.toFixed(3)}`;
    type OverlapEntry = { ox: number; oy: number; isOverlap: boolean; locKey: string; angle: number; count: number };
    const overlapInfo = new Map<string, OverlapEntry>();
    const stopCoordMap = new Map<string, [number, number]>();

    if (isCompare) {
      // Group stops by same stop_id or same parent_station across different trips.
      // For same stop_id: must share exact coordinates.
      // For same parent_station: merge at centroid even if coords differ (different platforms).
      const byKey = new Map<string, StopPoint[]>();
      for (const pt of visibleStops) {
        const key = (pt.parentStation && pt.parentStation.length > 0) ? pt.parentStation : pt.stopId;
        if (!key) continue;
        (byKey.get(key) ?? (byKey.set(key, []), byKey.get(key)!)).push(pt);
      }

      for (const [locKey, pts] of byKey) {
        const tripSet = new Set(pts.map((p) => p.tripIdx));
        if (tripSet.size <= 1) continue;
        // Check if this is a station group (different stop_ids, same parent_station)
        const isStationGroup = pts.some((p) => p.parentStation && p.parentStation.length > 0) &&
          new Set(pts.map((p) => p.stopId)).size > 1;

        let filteredPts: StopPoint[];
        if (isStationGroup) {
          // Station group: take one stop per trip, center at centroid
          const perTrip = new Map<number, StopPoint>();
          for (const pt of pts) { if (!perTrip.has(pt.tripIdx)) perTrip.set(pt.tripIdx, pt); }
          if (perTrip.size <= 1) continue;
          const allPts = Array.from(perTrip.values());
          const cLat = allPts.reduce((s, p) => s + p.lat, 0) / allPts.length;
          const cLon = allPts.reduce((s, p) => s + p.lon, 0) / allPts.length;
          // Override coordinates to centroid for capsule positioning + segments
          filteredPts = allPts.map((p) => ({ ...p, lat: cLat, lon: cLon }));
          for (const p of allPts) stopCoordMap.set(`${p.tripIdx}-${p.stopIdx}`, [cLon, cLat]);
        } else {
          // Same stop_id group: only capsule if coords overlap
          const coordGroups = new Map<string, StopPoint[]>();
          for (const pt of pts) {
            const ck = stopLocKey(pt);
            (coordGroups.get(ck) ?? (coordGroups.set(ck, []), coordGroups.get(ck)!)).push(pt);
          }
          const overlappingPts: StopPoint[] = [];
          for (const [, cPts] of coordGroups) {
            const cTrips = new Set(cPts.map((p) => p.tripIdx));
            if (cTrips.size > 1) overlappingPts.push(...cPts);
          }
          if (overlappingPts.length === 0) continue;
          filteredPts = overlappingPts;
        }
        const filteredTripSet = new Set(filteredPts.map((p) => p.tripIdx));
        if (filteredTripSet.size <= 1) continue;
        const trips = Array.from(filteredTripSet).sort();

        // Find route direction from next/prev stop to orient the bar perpendicular
        let rdx = 0, rdy = 0;
        for (const pt of filteredPts) {
          const next = visibleStops.find((p) => p.tripIdx === pt.tripIdx && p.stopIdx === pt.stopIdx + 1);
          if (next) {
            const ddx = next.lon - pt.lon;
            const ddy = next.lat - pt.lat;
            if (Math.abs(ddx) > 1e-6 || Math.abs(ddy) > 1e-6) {
              rdx = ddx; rdy = -ddy;
              break;
            }
          }
        }
        if (rdx === 0 && rdy === 0) {
          for (const pt of filteredPts) {
            const prev = visibleStops.find((p) => p.tripIdx === pt.tripIdx && p.stopIdx === pt.stopIdx - 1);
            if (prev) {
              const ddx = pt.lon - prev.lon;
              const ddy = pt.lat - prev.lat;
              if (Math.abs(ddx) > 1e-6 || Math.abs(ddy) > 1e-6) {
                rdx = ddx; rdy = -ddy;
                break;
              }
            }
          }
        }
        let bx: number, by: number;
        if (Math.abs(rdx) > 1e-8 || Math.abs(rdy) > 1e-8) {
          const len = Math.sqrt(rdx * rdx + rdy * rdy);
          bx = -rdy / len;
          by = rdx / len;
        } else {
          bx = 1; by = 0;
        }

        const angle = Math.atan2(by, bx) * (180 / Math.PI);
        // Larger dots, shrink after 3 to cap capsule
        const n = trips.length;
        const dr = n <= 3 ? Math.round(segR * 0.7) : Math.max(3, Math.round(segR * 0.7 * 3 / n));
        const spacing = dr * 2;
        for (const pt of filteredPts) {
          const idx = trips.indexOf(pt.tripIdx);
          const t = (idx - (n - 1) / 2) * spacing;
          overlapInfo.set(`${pt.tripIdx}-${pt.stopIdx}`, {
            ox: bx * t, oy: by * t,
            isOverlap: true, locKey, angle, count: n,
          });
        }
      }
    }

    // Build quick lookup: is this stop in an overlap group?
    const isStopOverlap = (pt: StopPoint) => overlapInfo.has(`${pt.tripIdx}-${pt.stopIdx}`);

    // Coordinate overrides for station-merged stops
    const getStopCoord = (pt: StopPoint): [number, number] => stopCoordMap.get(`${pt.tripIdx}-${pt.stopIdx}`) || [pt.lon, pt.lat];

    // Build per-segment data: segments are "shared" when both endpoints match
    // another trip's segment by stop_id or parent_station
    type SegRender = { from: [number, number]; to: [number, number]; tripIdx: number; bothOverlap: boolean;
      fromStopId?: string; toStopId?: string; fromStation?: string; toStation?: string };
    const segRenders: SegRender[] = [];
    if (isCompare) {
      // First pass: collect all segments with identity info
      const rawSegs: Array<{ pt: StopPoint; next: StopPoint }> = [];
      for (const pt of visibleStops) {
        const next = visibleStops.find((p) => p.tripIdx === pt.tripIdx && p.stopIdx === pt.stopIdx + 1);
        if (next) rawSegs.push({ pt, next });
      }
      // Build identity key for a stop: parent_station or stop_id
      const stopKey = (p: StopPoint) => (p.parentStation && p.parentStation.length > 0) ? p.parentStation : p.stopId;
      // Build segment identity key — bidirectional (same key regardless of direction)
      const segIdentity = (from: StopPoint, to: StopPoint) => {
        const a = stopKey(from), b = stopKey(to);
        return a < b ? `${a}↔${b}` : `${b}↔${a}`;
      };
      // Count how many trips share each segment identity
      const segIdentityCounts = new Map<string, Set<number>>();
      for (const { pt, next } of rawSegs) {
        const key = segIdentity(pt, next);
        if (!segIdentityCounts.has(key)) segIdentityCounts.set(key, new Set());
        segIdentityCounts.get(key)!.add(pt.tripIdx);
      }
      // For shared segments, pick a canonical direction so all trips render from→to consistently
      const segCanonicalDir = new Map<string, [string, string]>();
      for (const { pt, next } of rawSegs) {
        const key = segIdentity(pt, next);
        if (!segCanonicalDir.has(key)) {
          segCanonicalDir.set(key, [stopKey(pt), stopKey(next)]);
        }
      }
      // Second pass: build segRenders with bothOverlap = shared by 2+ trips
      for (const { pt, next } of rawSegs) {
        const fromCoord = getStopCoord(pt);
        const toCoord = getStopCoord(next);
        const key = segIdentity(pt, next);
        const shared = (segIdentityCounts.get(key)?.size ?? 0) > 1;
        // Normalize direction: if this segment's from→to doesn't match canonical, swap coords
        let renderFrom = fromCoord, renderTo = toCoord;
        if (shared) {
          const canon = segCanonicalDir.get(key);
          if (canon && canon[0] !== stopKey(pt)) {
            renderFrom = toCoord; renderTo = fromCoord;
          }
        }
        segRenders.push({ from: renderFrom, to: renderTo, tripIdx: pt.tripIdx, bothOverlap: shared,
          fromStopId: pt.stopId, toStopId: next.stopId, fromStation: pt.parentStation, toStation: next.parentStation });
      }
    }

    // 1. Segment selection highlight — highlight all matching lines with their offsets
    if (clickedSegment) {
      // Match using identity key: parent_station (if exists) or stop_id
      const segStopKeyFn = (stopId?: string, station?: string) =>
        (station && station.length > 0) ? station : (stopId || '');
      const clickedFromK = segStopKeyFn(clickedSegment.fromStopId, clickedSegment.fromStation);
      const clickedToK = segStopKeyFn(clickedSegment.toStopId, clickedSegment.toStation);
      const matchingRendered = segRenders.filter((s) => {
        const sFromK = segStopKeyFn(s.fromStopId, s.fromStation);
        const sToK = segStopKeyFn(s.toStopId, s.toStation);
        return (sFromK === clickedFromK && sToK === clickedToK) ||
               (sFromK === clickedToK && sToK === clickedFromK);
      });
      if (matchingRendered.length > 0 && matchingRendered[0].bothOverlap) {
        // Shared segment: highlight each trip's line at its per-group offset
        const sorted = [...new Set(matchingRendered.map((s) => s.tripIdx))].sort();
        for (const seg of matchingRendered) {
          const ti = seg.tripIdx;
          const idx = sorted.indexOf(ti);
          const offset = (idx - (sorted.length - 1) / 2) * 1.8;
          const color = safeHexToRgb(TRIP_LINE_COLORS[ti % TRIP_LINE_COLORS.length]);
          layerList.push(new PathLayer({
            id: `trip-seg-hl-${ti}`,
            data: [{ path: [seg.from, seg.to] }],
            getPath: (d: any) => d.path,
            getColor: isDark ? [245, 158, 11, 80] : [200, 130, 0, 100],
            getWidth: 8, widthUnits: "pixels",
            capRounded: true, jointRounded: true, pickable: false,
            getOffset: offset, extensions: pathStyleExt,
          }));
        }
      } else {
        // Solo segment: simple glow + colored highlight
        layerList.push(new PathLayer({
          id: "trip-segment-highlight-glow",
          data: [{ path: [clickedSegment.from, clickedSegment.to] }],
          getPath: (d: any) => d.path,
          getColor: isDark ? [245, 158, 11, 50] : [200, 130, 0, 60],
          getWidth: 16, widthUnits: "pixels",
          capRounded: true, jointRounded: true, pickable: false,
        }));
        const segColor = safeHexToRgb(TRIP_LINE_COLORS[clickedSegment.tripIdx % TRIP_LINE_COLORS.length]);
        layerList.push(new PathLayer({
          id: "trip-segment-highlight",
          data: [{ path: [clickedSegment.from, clickedSegment.to] }],
          getPath: (d: any) => d.path,
          getColor: [...segColor, 255] as [number, number, number, number],
          getWidth: 6, widthUnits: "pixels",
          capRounded: true, jointRounded: true, pickable: false,
        }));
      }
    }

    // 2. Trip path lines — visual only, rendered early so dots render on top
    if (isCompare) {
      const overlapSegs = segRenders.filter((s) => s.bothOverlap);
      if (overlapSegs.length > 0) {
        // Group shared segments by identity to compute per-group offsets
        const segStopKey = (s: SegRender) => {
          const fk = (s.fromStation && s.fromStation.length > 0) ? s.fromStation : (s.fromStopId || '');
          const tk = (s.toStation && s.toStation.length > 0) ? s.toStation : (s.toStopId || '');
          return fk < tk ? `${fk}↔${tk}` : `${tk}↔${fk}`;
        };
        for (const ti of visibleTripIds) {
          const tripSegs = overlapSegs.filter((s) => s.tripIdx === ti);
          if (tripSegs.length === 0) continue;
          const color = safeHexToRgb(TRIP_LINE_COLORS[ti % TRIP_LINE_COLORS.length]);
          // Compute per-segment offset based on how many trips share that specific segment
          const pathData = tripSegs.map((s) => {
            const key = segStopKey(s);
            const sharingTrips = overlapSegs.filter((o) => segStopKey(o) === key).map((o) => o.tripIdx);
            const sorted = [...new Set(sharingTrips)].sort();
            const idx = sorted.indexOf(ti);
            const offset = (idx - (sorted.length - 1) / 2) * 1.8;
            return { path: [s.from, s.to], tripIdx: ti, offset };
          });
          layerList.push(new PathLayer({
            id: `trip-path-ov-${ti}`, data: pathData,
            getPath: (d: any) => d.path,
            getColor: [...color, 230] as [number, number, number, number],
            getWidth: 4, widthUnits: "pixels", capRounded: true, jointRounded: true,
            pickable: true, getOffset: (d: any) => d.offset, extensions: pathStyleExt,
          }));
        }
      }
      const soloSegs = segRenders.filter((s) => !s.bothOverlap);
      if (soloSegs.length > 0) {
        for (const ti of visibleTripIds) {
          const tripSegs = soloSegs.filter((s) => s.tripIdx === ti);
          if (tripSegs.length === 0) continue;
          const color = safeHexToRgb(TRIP_LINE_COLORS[ti % TRIP_LINE_COLORS.length]);
          const pathData = tripSegs.map((s) => ({ path: [s.from, s.to], tripIdx: ti }));
          layerList.push(new PathLayer({
            id: `trip-path-solo-${ti}`, data: pathData,
            getPath: (d: any) => d.path,
            getColor: [...color, 230] as [number, number, number, number],
            getWidth: 4, widthUnits: "pixels", capRounded: true, jointRounded: true,
            pickable: true,
          }));
        }
      }
    } else {
      visiblePaths.forEach((p) => {
        const color = safeHexToRgb(TRIP_LINE_COLORS[p.tripIdx % TRIP_LINE_COLORS.length]);
        layerList.push(new PathLayer({
          id: `trip-path-${p.tripIdx}`, data: [p],
          getPath: (d: any) => d.path,
          getColor: [...color, 230] as [number, number, number, number],
          getWidth: 4, widthUnits: "pixels", capRounded: true, jointRounded: true,
          pickable: true,
        }));
      });
    }

    // Line click target — rendered BEFORE dots so dots get pick priority
    {
      const primarySegs = segments.filter((s) => s.tripIdx === 0 && !hidden.has(0));
      if (primarySegs.length > 0) {
        layerList.push(new LineLayer({
          id: "trip-segments",
          data: primarySegs,
          getSourcePosition: (d: Segment) => d.from,
          getTargetPosition: (d: Segment) => d.to,
          getColor: (d: Segment) => {
            if (isCompare) return [0, 0, 0, 0] as [number, number, number, number];
            if (d.disabled) return [150, 150, 150, 80] as [number, number, number, number];
            if (
              highlightedSegmentRange &&
              d.fromIdx >= highlightedSegmentRange.fromStopIdx &&
              d.toIdx <= highlightedSegmentRange.toStopIdx
            ) {
              return highlightedSegmentColor;
            }
            const isClicked = clickedSegment?.fromIdx === d.fromIdx && clickedSegment?.toIdx === d.toIdx;
            const rgb = safeHexToRgb(TRIP_LINE_COLORS[0]);
            return isClicked ? [...rgb, 255] as [number, number, number, number] : [...rgb, 200] as [number, number, number, number];
          },
          getWidth: isCompare ? 12 : 10, widthUnits: "pixels", pickable: true,
          updateTriggers: { getColor: [deletedStopIndices.size, clickedSegment?.fromIdx, clickedSegment?.toIdx, isCompare, highlightedSegmentRange?.fromStopIdx, highlightedSegmentRange?.toStopIdx, ...highlightedSegmentColor] },
        }));
      }
    }

    // Determine which locations are "bar-selected"
    const clickedLocKey = clickedStop ? stopLocKey(clickedStop) : null;

    // Split stops: overlap (capsule handles clicks) vs solo (directly pickable)
    // For station-merged stops, override coordinates to centroid
    const overlapStops = isCompare ? visibleStops
      .filter((d) => overlapInfo.has(`${d.tripIdx}-${d.stopIdx}`))
      .map((d) => { const c = stopCoordMap.get(`${d.tripIdx}-${d.stopIdx}`); return c ? { ...d, lon: c[0], lat: c[1] } : d; })
      : [];
    const soloStops = isCompare ? visibleStops.filter((d) => !overlapInfo.has(`${d.tripIdx}-${d.stopIdx}`)) : visibleStops;

    // Overlap: capsule + colored dots — only in compare mode
    if (overlapStops.length > 0 && isCompare) {
      const getOvOff = (d: StopPoint): [number, number] => {
        const info = overlapInfo.get(`${d.tripIdx}-${d.stopIdx}`);
        return info ? [info.ox, info.oy] : [0, 0];
      };

      // Capsule wrapper — pill shape using IconLayer, rotated to bar direction
      const hitLocs = new Map<string, { pt: StopPoint; count: number }>();
      for (const pt of overlapStops) {
        const k = stopLocKey(pt);
        const existing = hitLocs.get(k);
        if (existing) existing.count++;
        else hitLocs.set(k, { pt, count: 1 });
      }
      const hitData = Array.from(hitLocs.values());

      // Larger dots, shrink after 3 to cap capsule
      const baseR = Math.round(segR * 0.7);
      const dotR = (count: number) => count <= 3 ? baseR : Math.max(3, Math.round(baseR * 3 / count));
      const dotSp = (count: number) => dotR(count) * 2;
      const capsuleW = (count: number) => { const r = dotR(count); return (count - 1) * r * 2 + r * 2; };
      layerList.push(new IconLayer({
        id: "trip-stops-overlap-ring", data: hitData,
        getPosition: (d: { pt: StopPoint }) => [d.pt.lon, d.pt.lat],
        getIcon: (d: { pt: StopPoint; count: number }) => {
          const isSel = stopLocKey(d.pt) === clickedLocKey;
          const w = Math.round(capsuleW(d.count) * (d.count <= 2 ? 0.7 : 0.5));
          const h = Math.round(dotR(d.count) * 1.2);
          const fill = isSel
            ? (isDark ? "rgba(245,158,11,0.35)" : "rgba(200,130,0,0.3)")
            : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
          const stroke = isSel
            ? (isDark ? "rgba(245,158,11,0.9)" : "rgba(200,130,0,0.85)")
            : (isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)");
          const sw = isSel ? 2.5 : 1;
          const icon = makeCapsuleIcon(w, h, fill, stroke, sw);
          return { url: icon.url, width: icon.w, height: icon.h, anchorY: icon.h / 2 };
        },
        getSize: (d: { count: number }) => Math.round(capsuleW(d.count) * (d.count <= 2 ? 0.7 : 0.5)),
        getAngle: (d: { pt: StopPoint }) => {
          const info = overlapInfo.get(`${d.pt.tripIdx}-${d.pt.stopIdx}`);
          return info ? -info.angle : 0;
        },
        sizeUnits: "pixels",
        pickable: true,
        updateTriggers: { getIcon: [clickedLocKey, isDark, segR], getSize: [segR], getAngle: [] },
      }));

      // Colored dots — IconLayer per trip color
      const tripIconCache = new Map<number, string>();
      const getTripIcon = (tripIdx: number) => {
        if (!tripIconCache.has(tripIdx)) {
          const rgb = safeHexToRgb(TRIP_LINE_COLORS[tripIdx % TRIP_LINE_COLORS.length]);
          const stroke: [number, number, number] = isDark ? [30, 30, 30] : [255, 255, 255];
          tripIconCache.set(tripIdx, makeCircleIcon(rgb as [number, number, number], 32, stroke));
        }
        return tripIconCache.get(tripIdx)!;
      };
      layerList.push(new IconLayer({
        id: "trip-stops-overlap", data: overlapStops,
        getPosition: (d: StopPoint) => [d.lon, d.lat],
        getIcon: (d: StopPoint) => ({
          url: getTripIcon(d.tripIdx),
          width: 32, height: 32, mask: false,
        }),
        getSize: (d: StopPoint) => {
          const info = overlapInfo.get(`${d.tripIdx}-${d.stopIdx}`);
          const r = info ? dotR(info.count) : segR;
          return stopLocKey(d) === clickedLocKey ? r * 2 + 2 : r * 2;
        },
        getPixelOffset: getOvOff,
        sizeUnits: "pixels", pickable: true,
        updateTriggers: { getIcon: [isDark], getSize: [clickedLocKey, segR] },
      }));
    }

    // Selection buffer for clicked solo stop — renders behind the dot
    if (clickedStop && !overlapInfo.has(`${clickedStop.tripIdx}-${clickedStop.stopIdx}`)) {
      layerList.push(new ScatterplotLayer({
        id: "trip-stop-selection-buffer", data: [clickedStop],
        getPosition: (d: StopPoint) => [d.lon, d.lat],
        getFillColor: isDark ? [245, 158, 11, 60] : [200, 130, 0, 70],
        radiusUnits: "pixels", getRadius: 11,
        stroked: true,
        getLineColor: isDark ? [245, 158, 11, 180] : [200, 130, 0, 200],
        getLineWidth: 2, lineWidthUnits: "pixels", pickable: false,
      }));
    }

    // Non-overlap dots — pickable
    layerList.push(new ScatterplotLayer({
      id: "trip-stops", data: soloStops,
      getPosition: (d: StopPoint) => [d.lon, d.lat],
      getFillColor: (d: StopPoint) => {
        if (d.disabled) return [150, 150, 150, 100] as [number, number, number, number];
        const isClicked = clickedStop?.stopIdx === d.stopIdx && clickedStop?.tripIdx === d.tripIdx;
        const isSelected = d.tripIdx === 0 && selectedStopIdx === d.stopIdx;
        const status = d.tripIdx === 0 ? stopStatusMap.get(d.stopIdx) : undefined;
        if (isSelected) return [245, 158, 11, 255] as [number, number, number, number];
        if (isClicked) return [255, 80, 80, 255] as [number, number, number, number];
        if (status === "new") return [34, 197, 94, 230] as [number, number, number, number];
        if (status === "edit") return [245, 158, 11, 200] as [number, number, number, number];
        if (
          highlightedSegmentRange &&
          d.tripIdx === 0 &&
          d.stopIdx >= highlightedSegmentRange.fromStopIdx &&
          d.stopIdx <= highlightedSegmentRange.toStopIdx
        ) {
          return highlightedSegmentColor;
        }
        const rgb = safeHexToRgb(TRIP_LINE_COLORS[d.tripIdx % TRIP_LINE_COLORS.length]);
        return [...rgb, 240] as [number, number, number, number];
      },
      radiusUnits: "pixels",
      getRadius: (d: StopPoint) => {
        if (d.disabled) return 4;
        const isClicked = clickedStop?.stopIdx === d.stopIdx && clickedStop?.tripIdx === d.tripIdx;
        const isSelected = d.tripIdx === 0 && selectedStopIdx === d.stopIdx;
        return isClicked || isSelected ? 10 : 8;
      },
      radiusMinPixels: 3, stroked: true,
      getLineColor: isDark ? [40, 40, 40, 230] : [255, 255, 255, 230],
      getLineWidth: 1.5, lineWidthUnits: "pixels",
      pickable: true,
      // Drag handlers required so deck.gl fires onClick for empty space
      onDragStart: editable ? (info: any) => {
        if (info.object && info.object.tripIdx === 0) {
          isDraggingRef.current = true;
          dragIdxRef.current = info.object.stopIdx;
          return true;
        }
        return false;
      } : undefined,
      onDrag: editable ? (info: any) => {
        if (!isDraggingRef.current || dragIdxRef.current === null || !info.coordinate) return false;
        const [lon, lat] = info.coordinate;
        onDragStop?.(dragIdxRef.current, lat, lon);
        return true;
      } : undefined,
      onDragEnd: editable ? () => {
        if (isDraggingRef.current) { isDraggingRef.current = false; dragIdxRef.current = null; return true; }
        return false;
      } : undefined,
      updateTriggers: {
        getFillColor: [clickedStop?.stopIdx, clickedStop?.tripIdx, deletedStopIndices.size, selectedStopIdx, clickedLocKey, highlightedSegmentRange?.fromStopIdx, highlightedSegmentRange?.toStopIdx, ...highlightedSegmentColor],
        getRadius: [clickedStop?.stopIdx, clickedStop?.tripIdx, deletedStopIndices.size, selectedStopIdx, clickedLocKey],
      },
    }));

    // (capsule layer above handles click targets for overlap bars)

    // Labels — stop order number INSIDE every dot
    const previewSeqNum = externalPreview?.stopSequence;
    layerList.push(new TextLayer({
      id: "trip-stop-labels", data: visibleStops.filter((d) => !d.disabled),
      getPosition: (d: StopPoint) => { const c = stopCoordMap.get(`${d.tripIdx}-${d.stopIdx}`); return c || [d.lon, d.lat]; },
      getText: (d: StopPoint) => {
        if (previewSeqNum && d.tripIdx === 0 && d.sequence >= previewSeqNum) return String(d.sequence + 1);
        return String(d.sequence);
      },
      getSize: (d: StopPoint) => {
        const info = overlapInfo.get(`${d.tripIdx}-${d.stopIdx}`);
        if (info?.isOverlap) {
          const r = Math.round(segR * 0.7);
          return Math.max(8, Math.round(r * 1.2));
        }
        return 10;
      },
      getColor: () => isDark ? [255, 255, 255, 240] : [0, 0, 0, 220],
      getPixelOffset: (d: StopPoint) => {
        const info = overlapInfo.get(`${d.tripIdx}-${d.stopIdx}`);
        return info ? [info.ox, info.oy] : [0, 0];
      },
      fontFamily: "system-ui, sans-serif", fontWeight: 700,
      getTextAnchor: "middle", getAlignmentBaseline: "center",
      pickable: false, sizeUnits: "pixels",
      updateTriggers: { getText: [previewSeqNum], getColor: [isDark], getPixelOffset: [overlapInfo.size, segR], getSize: [overlapInfo.size, segR] },
    }));



    // Preview stop
    const activePreview = previewStop || externalPreview;
    if (activePreview) {
      layerList.push(new ScatterplotLayer({
        id: "preview-stop", data: [activePreview],
        getPosition: (d: any) => [d.lon, d.lat],
        getFillColor: [245, 158, 11, 220], radiusUnits: "pixels", getRadius: 10,
        radiusMinPixels: 8, stroked: true, getLineColor: [255, 255, 255, 255],
        getLineWidth: 2, lineWidthUnits: "pixels", pickable: false,
      }));
      const seqNum = (activePreview as any).stopSequence;
      const rawName = activePreview.name ? stripAccents(activePreview.name) : "";
      const nameStr = rawName.length > 12 ? rawName.slice(0, 10) + "..." : rawName;
      const previewLabel = seqNum
        ? (nameStr ? `#${seqNum} ${nameStr}` : `#${seqNum}`)
        : (nameStr || "New");
      layerList.push(new TextLayer({
        id: "preview-stop-label", data: [{ ...activePreview, _label: previewLabel }],
        getPosition: (d: any) => [d.lon, d.lat], getText: (d: any) => d._label,
        getSize: 11, getColor: [245, 158, 11, 255], getPixelOffset: [0, -18],
        fontFamily: "system-ui, sans-serif", fontWeight: 700, pickable: false, sizeUnits: "pixels",
      }));
      // Connection lines to adjacent stops
      const seq = (activePreview as any).stopSequence;
      if (seq && stopPoints.length > 0) {
        const primaryStops = stopPoints.filter((p) => p.tripIdx === 0 && !p.disabled);
        const prevStop = seq > 1 ? primaryStops[seq - 2] : undefined;
        const nextStop = seq <= primaryStops.length ? primaryStops[seq - 1] : undefined;
        const connectionData: Array<{ from: [number, number]; to: [number, number] }> = [];
        if (prevStop) connectionData.push({ from: [prevStop.lon, prevStop.lat], to: [activePreview.lon, activePreview.lat] });
        if (nextStop) connectionData.push({ from: [activePreview.lon, activePreview.lat], to: [nextStop.lon, nextStop.lat] });
        if (connectionData.length > 0) {
          layerList.push(new LineLayer({
            id: "preview-connection", data: connectionData,
            getSourcePosition: (d: any) => d.from, getTargetPosition: (d: any) => d.to,
            getColor: [245, 158, 11, 150], getWidth: 3, widthUnits: "pixels", pickable: false,
            getDashArray: [6, 4], dashJustified: true, extensions: [],
          }));
        }
      } else if (clickedStop) {
        layerList.push(new LineLayer({
          id: "preview-connection",
          data: [{ from: [clickedStop.lon, clickedStop.lat], to: [activePreview.lon, activePreview.lat] }],
          getSourcePosition: (d: any) => d.from, getTargetPosition: (d: any) => d.to,
          getColor: [34, 197, 94, 150], getWidth: 3, widthUnits: "pixels", pickable: false,
        }));
      }
    }

    return layerList;
  }, [stopPoints, segments, paths, clickedStop, clickedSegment, theme, editable, deletedStopIndices, previewStop, externalPreview, stopStatusMap, selectedStopIdx, hiddenTripIndices, highlightedSegmentRange, highlightedSegmentColor, zoomBucket]);

  return (
    <div className="h-full w-full">
      <DeckglMap
        viewState={viewState}
        setViewState={setViewState}
        MapLayers={layers}
        BoundBox={boundBox}
        MinZoom={Math.max(1, fitZoom - 2)}
        dragRotate={false}
        maxPitch={0}
        setClickInfo={handleClick}
        setHoverInfo={() => {}}
      />
    </div>
  );
}
