import { encodeFanCode, laneGapPxForRouteType } from "./fan-code.js"

export type RouteShapeRecord = {
  route_id: string
  shape_id?: string
  route_type_name?: string | null
  lons: ArrayLike<number>
  lats: ArrayLike<number>
  slots?: ArrayLike<number> | null
  turnRadii?: ArrayLike<number> | null
  bandCounts?: ArrayLike<number> | null
  [key: string]: unknown
}

export type RouteShapePath<R extends RouteShapeRecord = RouteShapeRecord> = Omit<
  R,
  "lons" | "lats" | "slots" | "turnRadii" | "bandCounts"
> & {
  path: Float64Array
  fanCodes: Float32Array | null
}

export type BuildRouteShapePathsOptions<R extends RouteShapeRecord> = {
  cleaned?: boolean
  getGapPx?: (record: R) => number
}

export const isRouteShapePath = (row: unknown): row is RouteShapePath =>
  !!row && (row as RouteShapePath).path instanceof Float64Array

export const recordIsCleaned = (record: RouteShapeRecord): boolean =>
  (record.slots != null && record.slots.length > 0) ||
  (record.bandCounts != null && record.bandCounts.length > 0)

export const largestBundleIn = (
  rows: ReadonlyArray<RouteShapeRecord | RouteShapePath | { band_count?: unknown }>,
): number => {
  let largest = 0
  for (const row of rows) {
    const summary = Number((row as { band_count?: unknown }).band_count)
    if (summary > largest) largest = summary
    const counts = (row as RouteShapeRecord).bandCounts
    if (counts) for (let i = 0; i < counts.length; i++) if (counts[i] > largest) largest = counts[i]
  }
  return largest
}

export function buildRouteShapePaths<R extends RouteShapeRecord>(
  records: ReadonlyArray<R>,
  options: BuildRouteShapePathsOptions<R> = {},
): RouteShapePath<R>[] {
  const out: RouteShapePath<R>[] = []
  for (const rec of records) {
    const lons = rec?.lons
    const lats = rec?.lats
    if (!lons || !lats) continue
    const n = Math.min(lons.length, lats.length)
    if (n < 2) continue
    const cleaned = options.cleaned ?? recordIsCleaned(rec)
    const gap = options.getGapPx ? options.getGapPx(rec) : laneGapPxForRouteType(rec.route_type_name)
    const slots = cleaned && rec.slots && rec.slots.length === n ? rec.slots : null
    const radii = rec.turnRadii && rec.turnRadii.length === n ? rec.turnRadii : null
    const counts = cleaned && rec.bandCounts && rec.bandCounts.length === n ? rec.bandCounts : null
    const path = new Float64Array(n * 2)
    const fanCodes = cleaned ? new Float32Array(n) : null
    for (let i = 0; i < n; i++) {
      path[i * 2] = lons[i]
      path[i * 2 + 1] = lats[i]
      if (!fanCodes) continue
      let slotPx = 0
      if (slots) {
        const lo = i > 0 ? i - 1 : 0
        const hi = i < n - 1 ? i + 1 : n - 1
        let sum = 0
        for (let k = lo; k <= hi; k++) sum += slots[k]
        slotPx = (sum / (hi - lo + 1)) * gap
      }
      const r = radii ? radii[i] : 5000
      fanCodes[i] = encodeFanCode(
        Number.isFinite(slotPx) ? slotPx : 0,
        Number.isFinite(r) ? r : 5000,
        counts ? counts[i] : 1,
        gap,
      )
    }
    const { lons: _lons, lats: _lats, slots: _s, turnRadii: _t, bandCounts: _b, ...rest } = rec
    out.push({ ...(rest as Omit<R, "lons" | "lats" | "slots" | "turnRadii" | "bandCounts">), path, fanCodes })
  }
  return out
}
