export type RouteLinePoint = {
  lat: number
  lon: number
}

const isFinitePoint = (point: RouteLinePoint) =>
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lon) &&
  point.lat >= -90 &&
  point.lat <= 90 &&
  point.lon >= -180 &&
  point.lon <= 180

export const parseRouteLineValue = (value: unknown): RouteLinePoint[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((point: any) => ({
        lat: Number(point.lat ?? point.shape_pt_lat ?? point.stop_lat),
        lon: Number(point.lon ?? point.shape_pt_lon ?? point.stop_lon),
      }))
      .filter(isFinitePoint)
  }
  if (typeof value !== "string") return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parseRouteLineValue(parsed)
  } catch {
    return []
  }
}

export const serializeRouteLineValue = (points: RouteLinePoint[]) =>
  points.length === 0
    ? ""
    : JSON.stringify(points.map((point) => ({ lat: point.lat, lon: point.lon })))
