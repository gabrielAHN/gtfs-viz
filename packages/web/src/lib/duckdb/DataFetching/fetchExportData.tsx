import { formatSqlValue } from "../QueryHelper"
import { logger } from "@/lib/logger"

/**
 * Generic: fetch original rows from a source table by ID for comparison in export view.
 * Returns a map of idField → row.
 */
export const fetchOriginalRows = async (
  conn: any,
  table: string,
  idField: string,
  ids: string[],
) => {
  if (ids.length === 0) return {}
  try {
    const idList = ids.map((id) => formatSqlValue(id)).join(", ")
    const castKey = idField === "row_id" ? `CAST(${idField} AS TEXT)` : idField
    const result = await conn.query(`SELECT * FROM ${table} WHERE ${castKey} IN (${idList})`)
    const rows = result.toArray().map((row: any) => row.toJSON())
    const map: Record<string, any> = {}
    for (const row of rows) map[String(row[idField])] = row
    return map
  } catch {
    return {}
  }
}

/**
 * Fetch original pathway rows for comparison in export view.
 */
export const fetchOriginalPathways = async (conn: any, pathwayIds: string[]) =>
  fetchOriginalRows(conn, "pathways", "pathway_id", pathwayIds)

/**
 * Fetch original route shape points grouped by route_id for export comparison.
 * Picks the shape with the most points per route.
 */
export const fetchOriginalRouteShapes = async (conn: any, routeIds: string[]) => {
  if (routeIds.length === 0) return {}
  try {
    const ids = routeIds.map((id) => formatSqlValue(id)).join(", ")
    const result = await conn.query(`
      WITH shape_ranked AS (
        SELECT t.route_id, t.shape_id, COUNT(*) as pt_count,
          ROW_NUMBER() OVER (PARTITION BY t.route_id ORDER BY COUNT(*) DESC) as rn
        FROM (
          SELECT DISTINCT route_id, shape_id
          FROM trips
          WHERE route_id IN (${ids}) AND shape_id IS NOT NULL AND shape_id != ''
        ) t
        JOIN shapes s ON s.shape_id = t.shape_id
        GROUP BY t.route_id, t.shape_id
      )
      SELECT sr.route_id, s.shape_pt_lat, s.shape_pt_lon, s.shape_pt_sequence
      FROM shapes s
      JOIN shape_ranked sr ON s.shape_id = sr.shape_id
      WHERE sr.rn = 1
      ORDER BY sr.route_id, s.shape_pt_sequence
    `)
    const rows = result.toArray().map((row: any) => row.toJSON())
    const shapeMap: Record<string, { lat: number; lon: number }[]> = {}
    for (const row of rows) {
      const routeId = row.route_id
      if (!shapeMap[routeId]) shapeMap[routeId] = []
      const lat = Number(row.shape_pt_lat)
      const lon = Number(row.shape_pt_lon)
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        shapeMap[routeId].push({ lat, lon })
      }
    }
    return shapeMap
  } catch {
    return {}
  }
}

/**
 * Fetch stop metadata (name, parent_station, location_type) for pathway export view.
 * Prefers edited stops over originals.
 */
export const fetchStopMetadataForPathways = async (conn: any, stopIds: string[]) => {
  if (stopIds.length === 0) return {}
  try {
    const ids = stopIds.map((id) => formatSqlValue(id)).join(", ")
    const result = await conn.query(`
      SELECT edt.stop_id, edt.stop_name, edt.parent_station, edt.location_type_name
      FROM EditStopTable edt
      WHERE edt.stop_id IN (${ids})
        AND edt.status IN ('new', 'edit', 'new edit')
      UNION ALL
      SELECT st.stop_id, st.stop_name, st.parent_station, st.location_type_name
      FROM stops st
      WHERE st.stop_id IN (${ids})
        AND NOT EXISTS (
          SELECT 1 FROM EditStopTable edt
          WHERE edt.stop_id = st.stop_id
            AND edt.status IN ('new', 'edit', 'new edit')
        )
    `)
    const rows = result.toArray().map((row: any) => row.toJSON())
    const map: Record<string, any> = {}
    for (const row of rows) map[row.stop_id] = row
    return map
  } catch (err) {
    logger.error("Error fetching stop metadata:", err)
    return {}
  }
}
