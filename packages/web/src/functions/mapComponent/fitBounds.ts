type LatLon = { lat: number; lon: number }

const DEFAULT_CENTER = { lat: 39.83, lon: -98.58 }
const DEFAULT_BOUNDS: [number[], number[]] = [
  [-180, -85],
  [180, 85],
]

const toCoord = (row: Record<string, any>): LatLon | null => {
  const lat = Number(row.stop_lat ?? row.lat ?? row.shape_pt_lat)
  const lon = Number(row.stop_lon ?? row.lon ?? row.shape_pt_lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

export type MapFit = {
  viewState: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number }
  boundBox: [number[], number[]]
}

/**
 * Compute bounds from points in JS, then call DuckDB fit_zoom macro for zoom only.
 * Min/max/center computed in JS (fast), zoom via DuckDB macro (consistent with server).
 */
export async function fitBoundsToPoints(conn: any, points: LatLon[]): Promise<MapFit | null> {
  if (points.length === 0) return null

  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  let sumLat = 0
  let sumLon = 0

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
    sumLat += p.lat
    sumLon += p.lon
  }

  // Get zoom from DuckDB fit_zoom macro (4 numbers only)
  let zoom = 10
  try {
    const result = await conn.query(
      `SELECT fit_zoom(${minLon}, ${maxLon}, ${minLat}, ${maxLat}) AS zoom`,
    )
    const row = result.toArray()[0]
    const z = Number(row?.zoom ?? row?.toJSON?.()?.zoom)
    if (Number.isFinite(z)) zoom = z
  } catch {
    // fallback zoom if macro not available
  }

  return {
    viewState: {
      longitude: sumLon / points.length,
      latitude: sumLat / points.length,
      zoom,
      pitch: 0,
      bearing: 0,
    },
    boundBox: [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
  }
}

export async function fitBoundsToData(
  conn: any,
  data: Record<string, any>[],
): Promise<MapFit | null> {
  const points: LatLon[] = []
  for (const row of data) {
    const coord = toCoord(row)
    if (coord) points.push(coord)
  }
  return fitBoundsToPoints(conn, points)
}

export { DEFAULT_CENTER, DEFAULT_BOUNDS }
