export const FAN_CODE_MAX_ROUTES = 512

export const encodeFanCode = (
  slotPx: number,
  turnRadiusM: number,
  bandCount = 1,
  gapPx = 7,
): number => {
  const r = Number.isFinite(turnRadiusM) ? turnRadiusM : 5000
  const step = r < 20 ? 0 : r < 36 ? 1 : r < 50 ? 2 : r < 100 ? 3 : 4
  const band = Number.isFinite(bandCount) ? Math.max(1, Math.round(bandCount)) : 1
  const gap = Number.isFinite(gapPx) ? Math.min(9, Math.max(1, Math.round(gapPx))) : 7
  const count = Math.max(
    band,
    Number.isFinite(slotPx) ? Math.ceil(1 + (2 * Math.abs(slotPx)) / gap) : 1,
  )
  const routes = Math.min(FAN_CODE_MAX_ROUTES, count)
  const halfSpan = (count - 1) * gap * 0.5
  const lane =
    halfSpan > 0 && Number.isFinite(slotPx) ? Math.min(1, Math.max(-1, slotPx / halfSpan)) : 0
  return routes * 10000 + step * 1000 + gap * 100 + (lane + 1) * 49.5
}

export const FAN_CODE_RAW = encodeFanCode(0, 5000)

export const fanBundleRefFor = (largestBundle: number): number => {
  const widest = Math.min(32, Math.max(8, Number.isFinite(largestBundle) ? largestBundle : 0))
  return (Math.log2(widest) - 1) / 4
}

const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

export const fanMaxPxForZoom = (zoom: number): number => 24 + 16 * smoothstep((zoom - 14) / 2)

export const routeModeRank = (routeTypeName?: string | null): number => {
  const n = (routeTypeName || "").toLowerCase()
  if (n.includes("bus") || n.includes("trolley")) return 0
  if (n.includes("ferry") || n.includes("boat") || n.includes("water")) return 1
  return 2
}

export const laneGapPxForRouteType = (routeTypeName?: string | null): number => {
  const r = routeModeRank(routeTypeName)
  return r === 0 ? 7 : r === 1 ? 8 : 9
}

export const laneWidthPxForRouteType = (routeTypeName?: string | null): number => {
  const r = routeModeRank(routeTypeName)
  return r === 0 ? 3 : r === 1 ? 3.5 : 4
}
