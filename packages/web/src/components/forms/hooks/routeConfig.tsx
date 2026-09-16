import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { executeQuery } from "@/lib/duckdb/QueryHelper"
import {
  parseRouteLineValue,
  serializeRouteLineValue,
} from "@/components/forms/RouteLineInput/routeLine"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import { normalizeHex } from "@/components/forms/shared/colors"
import ColorInput from "@/components/forms/shared/inputs/ColorInput"

const ROUTE_TYPE_OPTIONS = [
  { value: "0", label: "Tram, Streetcar, Light rail" },
  { value: "1", label: "Subway, Metro" },
  { value: "2", label: "Rail" },
  { value: "3", label: "Bus" },
  { value: "4", label: "Ferry" },
  { value: "5", label: "Cable tram" },
  { value: "6", label: "Aerial lift" },
  { value: "7", label: "Funicular" },
  { value: "11", label: "Trolleybus" },
  { value: "12", label: "Monorail" },
]

export const routeTypeColor = (typeValue: string) => {
  const option = ROUTE_TYPE_OPTIONS.find((o) => o.value === typeValue)
  return option ? getRouteTypeColor(option.label) : getRouteTypeColor("Other")
}

const routeShapeLineValue = (data: any[], routeId: string | undefined) => {
  if (!routeId) return ""
  const groups = new Map<string, any[]>()
  data
    .filter((row: any) => String(row.route_id) === String(routeId))
    .filter((row: any) => row.shape_pt_lat != null && row.shape_pt_lon != null)
    .forEach((row: any) => {
      const shapeId = String(row.shape_id || "shape")
      if (!groups.has(shapeId)) groups.set(shapeId, [])
      groups.get(shapeId)!.push(row)
    })
  const shapeRows = Array.from(groups.values()).sort((a, b) => b.length - a.length)[0] || []
  const points = shapeRows
    .sort((a: any, b: any) => Number(a.shape_pt_sequence || 0) - Number(b.shape_pt_sequence || 0))
    .map((row: any) => ({
      lat: Number(row.shape_pt_lat),
      lon: Number(row.shape_pt_lon),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
  return serializeRouteLineValue(points)
}

export const ROUTE_QUERY_KEYS = [
  "fetchRoutesData",
  "fetchRouteShapes",
  "fetchRouteStops",
  "fetchServiceRouteInfoData",
  "fetchServiceRouteTripsData",
  "fetchServiceRouteServicesData",
  "fetchServiceRouteTripsForServiceData",
  "routeChips",
  "fetchStationsData",
  "fetchStopsData",
] as const

type RouteFieldsParams = {
  mode: "add" | "edit"
  conn: any
  ClickInfo: any
  Data: any[]
}

export function getRouteFields({ mode, conn, ClickInfo, Data }: RouteFieldsParams) {
  const isAddMode = mode === "add"
  const isEditMode = mode === "edit"

  const fields: any[] = []

  if (isAddMode) {
    fields.push({
      name: "routeId",
      label: "Route ID",
      type: "formField" as const,
      parts: {
        renderInput: (field: any) => (
          <Input
            ref={field.ref}
            type="text"
            placeholder="eg. Boat-F2H"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={field.disabled}
          />
        ),
        rules: {
          required: "Route ID is required",
          validate: {
            notBlank: (value: string) =>
              String(value || "").trim().length > 0 || "Route ID is required",
            checkDuplicate: async (value: string) => {
              const routeId = String(value || "").trim()
              if (!routeId || !conn) return true
              const escaped = routeId.replace(/'/g, "''")
              const result = await executeQuery(
                conn,
                `SELECT route_id FROM RoutesTable WHERE route_id = '${escaped}' LIMIT 1`,
              )
              return result.length === 0 || `Route ID "${routeId}" already exists`
            },
          },
        },
      },
    })
  }

  fields.push(
    {
      name: "routeName",
      label: "Route Name",
      type: "formField" as const,
      parts: {
        ...(isEditMode && { editLabel: ClickInfo?.route_name }),
        renderInput: (field: any) => (
          <Input
            ref={field.ref}
            type="text"
            placeholder="eg. Red Line"
            value={field.value}
            onChange={field.onChange}
            disabled={field.disabled}
          />
        ),
        rules: {
          required: "Route name is required",
        },
      },
    },
    ...(isAddMode
      ? [
          {
            name: "routeType",
            label: "Route Type",
            type: "formField" as const,
            parts: {
              renderInput: ({ value, onChange, ref, disabled }: any) => (
                <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
                  <SelectTrigger ref={ref}>
                    <div className="flex items-center gap-2">
                      {value && (
                        <span
                          className="h-3 w-6 rounded-sm border shrink-0"
                          style={{ backgroundColor: routeTypeColor(value) }}
                        />
                      )}
                      <SelectValue placeholder="Select route type" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-6 rounded-sm border shrink-0"
                            style={{
                              backgroundColor: routeTypeColor(option.value),
                            }}
                          />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ),
              rules: {
                required: "Route type is required",
              },
            },
          },
        ]
      : []),
    {
      name: "routeColor",
      label: "Route Color",
      type: "formField" as const,
      parts: {
        ...(isEditMode && { editLabel: ClickInfo?.route_color_hex }),
        renderInput: ({ value, onChange, ref, disabled }: any) => (
          <ColorInput
            value={value}
            onChange={onChange}
            ref={ref}
            disabled={disabled}
            fallback="#4f46e5"
          />
        ),
        rules: {
          required: "Route color is required",
        },
      },
    },
    {
      name: "routeTextColor",
      label: "Text Color",
      type: "formField" as const,
      parts: {
        ...(isEditMode && { editLabel: ClickInfo?.route_text_color_hex }),
        renderInput: ({ value, onChange, ref, disabled }: any) => (
          <ColorInput
            value={value}
            onChange={onChange}
            ref={ref}
            disabled={disabled}
            fallback="#ffffff"
          />
        ),
        rules: {
          required: "Text color is required",
        },
      },
    },
    {
      name: "shapePointsJson",
      label: "Route Line",
      type: "routeLine" as const,
      parts: {
        data: Data,
        route: ClickInfo,
        ...(isEditMode && {
          editLabel: `${
            parseRouteLineValue(
              ClickInfo?.shape_points_json || routeShapeLineValue(Data, ClickInfo?.route_id),
            ).length
          } points`,
        }),
      },
    },
  )

  return fields
}

type RouteDefaultsParams = {
  mode: "add" | "edit"
  ClickInfo: any
  Data: any[]
}

export function getRouteDefaults({ mode, ClickInfo, Data }: RouteDefaultsParams) {
  if (mode === "add") {
    return {
      routeId: "",
      routeName: "",
      routeType: "3",
      routeColor: routeTypeColor("3"),
      routeTextColor: "#ffffff",
      shapePointsJson: "",
    }
  }

  return {
    routeName: ClickInfo?.route_name || "",
    routeType: String(ClickInfo?.route_type ?? 3),
    routeColor: normalizeHex(
      ClickInfo?.route_color_hex,
      routeTypeColor(String(ClickInfo?.route_type ?? 3)),
    ),
    routeTextColor: normalizeHex(ClickInfo?.route_text_color_hex, "#ffffff"),
    shapePointsJson: ClickInfo?.shape_points_json || routeShapeLineValue(Data, ClickInfo?.route_id),
  }
}
