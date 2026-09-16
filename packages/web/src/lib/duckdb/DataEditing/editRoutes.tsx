import { executeQuery, formatSqlValue } from "@/lib/duckdb/QueryHelper"
import { createEditRouteTable } from "@/lib/extensions"

const routeColorValue = (value: unknown, fallback: string) => {
  if (typeof value !== "string" || value.trim() === "") return fallback
  return value.trim()
}

const routeTypeValue = (value: unknown, fallback: unknown) => {
  const parsed = Number(value ?? fallback ?? 3)
  return Number.isFinite(parsed) ? parsed : 3
}

const routeNameValue = (value: unknown, fallback: unknown) => {
  const next = typeof value === "string" ? value.trim() : ""
  if (next) return next
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : ""
}

const routeLineValue = (value: unknown, fallback: unknown) => {
  if (typeof value === "string") return value.trim() || null
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null
}

const editRow = ({ formData, SelectRoute, status }: any) => {
  const routeId = SelectRoute?.route_id || formData.routeId
  const routeName = routeNameValue(formData.routeName, SelectRoute?.route_name || routeId)
  return {
    row_id: SelectRoute?.row_id || `edit_${routeId}`,
    route_id: routeId,
    agency_id: SelectRoute?.agency_id || null,
    route_short_name: routeName,
    route_long_name: null,
    route_desc: SelectRoute?.route_desc || null,
    route_type: routeTypeValue(formData.routeType, SelectRoute?.route_type),
    route_url: SelectRoute?.route_url || null,
    route_color: routeColorValue(formData.routeColor, SelectRoute?.route_color_hex || "#4f46e5"),
    route_text_color: routeColorValue(
      formData.routeTextColor,
      SelectRoute?.route_text_color_hex || "#ffffff",
    ),
    route_sort_order: SelectRoute?.route_sort_order ?? null,
    shape_points_json: routeLineValue(formData.shapePointsJson, SelectRoute?.shape_points_json),
    status,
  }
}

const insertEditRow = async (conn: any, row: Record<string, unknown>) => {
  const columns = Object.keys(row)
  const values = columns.map((column) => formatSqlValue(row[column])).join(", ")
  await executeQuery(conn, `INSERT INTO EditRouteTable (${columns.join(", ")}) VALUES (${values})`)
}

const deleteEditRowsForRoute = async (conn: any, routeId: string) => {
  await executeQuery(conn, `DELETE FROM EditRouteTable WHERE route_id = ${formatSqlValue(routeId)}`)
}

export const mutationAddRouteFn = async ({ conn, formData }: any) => {
  await createEditRouteTable(conn)
  const routeId = String(formData.routeId || "").trim()
  if (!routeId) throw new Error("Route ID is required")
  await deleteEditRowsForRoute(conn, routeId)
  await insertEditRow(conn, editRow({ formData: { ...formData, routeId }, status: "new" }))
  return { routeId }
}

export const mutationEditRouteFn = async ({ conn, formData, SelectRoute }: any) => {
  await createEditRouteTable(conn)
  const routeId = String(SelectRoute?.route_id || "").trim()
  if (!routeId) throw new Error("Route ID is required")
  const status =
    SelectRoute?.status === "new" || SelectRoute?.status === "new edit" ? "new edit" : "edit"
  await deleteEditRowsForRoute(conn, routeId)
  await insertEditRow(conn, editRow({ formData, SelectRoute, status }))
  return { routeId }
}

export const mutationDeleteRouteFn = async ({ conn, SelectRoute }: any) => {
  await createEditRouteTable(conn)
  const routeId = String(SelectRoute?.route_id || "").trim()
  if (!routeId) throw new Error("Route ID is required")
  await deleteEditRowsForRoute(conn, routeId)
  if (SelectRoute?.status === "new" || SelectRoute?.status === "new edit") {
    return { routeId }
  }
  await insertEditRow(
    conn,
    editRow({
      formData: {
        routeName: SelectRoute?.route_name,
        routeType: SelectRoute?.route_type,
        routeColor: SelectRoute?.route_color_hex,
        routeTextColor: SelectRoute?.route_text_color_hex,
        shapePointsJson: SelectRoute?.shape_points_json,
      },
      SelectRoute,
      status: "deleted",
    }),
  )
  return { routeId }
}
