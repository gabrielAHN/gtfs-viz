import { Input } from "@/components/ui/input"
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { validateTableData } from "@/lib/duckdb/DataEditing/validatingData"
import {
  STOP_ID_PATTERN,
  LATITUDE_RULES,
  LONGITUDE_RULES,
} from "@/components/forms/shared/validation"
import CoordinateInput from "@/components/forms/shared/inputs/CoordinateInput"

export type LocationTypeConfig = {
  show: boolean
  options?: Array<{ value: string; label: string }>
  defaultValue?: string
  required?: boolean
}

export const LOCATION_TYPE_CONFIGS = {
  STOP: {
    show: false,
    defaultValue: "Stop",
    required: false,
  } as LocationTypeConfig,

  STATION: {
    show: false,
    defaultValue: "Station",
    required: false,
  } as LocationTypeConfig,

  NODE: {
    show: true,
    options: [
      { value: "Platform", label: "Platform" },
      { value: "Exit/Entrance", label: "Exit/Entrance" },
      { value: "Pathway Node", label: "Pathway Node" },
      { value: "Boarding Area", label: "Boarding Area" },
    ],
    required: true,
  } as LocationTypeConfig,
}

export const STOP_STATION_QUERY_KEYS = [
  "createStationTable",
  "createStopsTable",
  "fetchStationsData",
  "fetchStopsData",
  "fetchStopsIdData",
  "fetchStopsNamesData",
  "fetchStationData",
  "fetchStationInfoData",
  "stationPathwaysComplete",
] as const

type StopStationFieldsParams = {
  mode: "add" | "edit"
  type: "station" | "stop"
  conn: any
  ClickInfo: any
  Data: any[]
  parentStation?: string
  showLevelField?: boolean
}

export function getStopStationFields({
  mode,
  type,
  conn,
  ClickInfo,
  Data,
  parentStation,
  showLevelField = false,
}: StopStationFieldsParams) {
  const isStation = type === "station"
  const isAddMode = mode === "add"
  const isEditMode = mode === "edit"
  const isChildNode = !!parentStation
  const tableName = isStation ? "StationsTable" : "StopsTable"
  const placeholder = isStation ? "place-CM-0493" : "stop-123"

  const locationTypeConfig = isStation
    ? LOCATION_TYPE_CONFIGS.STATION
    : isChildNode
      ? LOCATION_TYPE_CONFIGS.NODE
      : LOCATION_TYPE_CONFIGS.STOP

  const fields: any[] = []

  if (isAddMode) {
    fields.push({
      name: "stopId",
      label: "Stop Id",
      type: "formField" as const,
      parts: {
        renderInput: (field: any) => (
          <Input
            ref={field.ref}
            type="text"
            placeholder={`eg. ${placeholder}`}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={field.disabled}
          />
        ),
        rules: {
          required: "Stop Id is required",
          pattern: STOP_ID_PATTERN,
          validate: {
            checkDuplicate: async (value: string) => {
              if (!value || !STOP_ID_PATTERN.value.test(value)) {
                return true
              }
              const queryResult = await validateTableData({
                conn,
                table: tableName,
                column: "stop_id",
                value,
              })
              return queryResult || "Stop Id already exists"
            },
          },
        },
      },
    })
  }

  fields.push({
    name: "name",
    label: "Name",
    type: "formField" as const,
    parts: {
      ...(isEditMode && { editLabel: ClickInfo?.stop_name }),
      renderInput: (field: any) => (
        <Input
          ref={field.ref}
          type="text"
          placeholder={isStation ? "eg. Place de la Concorde" : "eg. Main Street"}
          value={field.value}
          onChange={field.onChange}
          disabled={field.disabled}
        />
      ),
      rules: {
        required: "Name is required",
      },
    },
  })

  // Location type field for NODE entities (add mode only)
  if (isAddMode && locationTypeConfig.show) {
    fields.push({
      name: "location_type_name",
      label: "Location Type",
      type: "formField" as const,
      parts: {
        renderInput: ({ value, onChange, ref }: any) => (
          <Select
            value={value || ""}
            onValueChange={(val) => {
              onChange(val)
            }}
            disabled={false}
          >
            <SelectTrigger ref={ref}>
              <SelectValue placeholder="Select Location Type" />
            </SelectTrigger>
            <SelectContent>
              {locationTypeConfig.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        rules: locationTypeConfig.required ? { required: "Location Type is required" } : undefined,
      },
    })
  }

  if (showLevelField) {
    fields.push({
      name: "level_id",
      label: "Level",
      type: "formField" as const,
      parts: {
        ...(isEditMode && { editLabel: ClickInfo?.level_id }),
        renderInput: (field: any) => (
          <Input
            ref={field.ref}
            type="text"
            placeholder="eg. L1"
            value={field.value}
            onChange={field.onChange}
            disabled={field.disabled}
          />
        ),
      },
    })
  }

  fields.push({
    name: "wheelchair",
    label: "Wheelchair Accessible",
    type: "formField" as const,
    parts: {
      ...(isEditMode && { editLabel: ClickInfo?.wheelchair_status }),
      renderInput: ({ value, onChange, ref, disabled }: any) => (
        <Select
          value={value || ""}
          onValueChange={(val) => {
            onChange(val)
          }}
          disabled={disabled}
        >
          <SelectTrigger ref={ref}>
            <SelectValue placeholder="Select wheelchair accessibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="🔵">No Information 🔵</SelectItem>
            <SelectItem value="🟢">Accessible 🟢</SelectItem>
            <SelectItem value="🔴">Not Accessible 🔴</SelectItem>
            <SelectItem value="🟡">Unknown 🟡</SelectItem>
          </SelectContent>
        </Select>
      ),
      rules: {
        required: "Wheelchair accessibility is required",
      },
    },
  })

  fields.push({
    name: "location",
    type: "map" as const,
    parts: {
      data: Data,
      lat: {
        name: "lat",
        label: "Latitude",
        ...(isEditMode && { editLabel: ClickInfo?.stop_lat }),
        renderInput: (field: any) => (
          <CoordinateInput
            type="lat"
            value={field.value}
            onChange={field.onChange}
            ref={field.ref}
            disabled={field.disabled}
          />
        ),
        rules: LATITUDE_RULES,
      },
      lon: {
        name: "lon",
        label: "Longitude",
        ...(isEditMode && { editLabel: ClickInfo?.stop_lon }),
        renderInput: (field: any) => (
          <CoordinateInput
            type="lon"
            value={field.value}
            onChange={field.onChange}
            ref={field.ref}
            disabled={field.disabled}
          />
        ),
        rules: LONGITUDE_RULES,
      },
    },
  })

  return fields
}

type StopStationDefaultsParams = {
  mode: "add" | "edit"
  type: "station" | "stop"
  ClickInfo: any
  parentStation?: string
}

export function getStopStationDefaults({
  mode,
  type,
  ClickInfo,
  parentStation,
}: StopStationDefaultsParams) {
  const isStation = type === "station"
  const isChildNode = !!parentStation
  const locationTypeConfig = isStation
    ? LOCATION_TYPE_CONFIGS.STATION
    : isChildNode
      ? LOCATION_TYPE_CONFIGS.NODE
      : LOCATION_TYPE_CONFIGS.STOP

  if (mode === "add") {
    return {
      stopId: "",
      name: "",
      location_type_name: locationTypeConfig.defaultValue || "",
      wheelchair: "",
      parent_station: parentStation || "",
      level_id: "",
      lat: "",
      lon: "",
    }
  }

  return {
    stopId: ClickInfo?.stop_id || "",
    name: ClickInfo?.stop_name || "",
    location_type_name: ClickInfo?.location_type_name || "",
    wheelchair: ClickInfo?.wheelchair_status || "",
    parent_station: ClickInfo?.parent_station || "",
    level_id: ClickInfo?.level_id || "",
    lat: ClickInfo?.stop_lat || "",
    lon: ClickInfo?.stop_lon || "",
  }
}

export function getStopStationHeader(
  type: "station" | "stop",
  mode: "add" | "edit",
  parentStation?: string,
) {
  const isStation = type === "station"
  const isChildNode = !!parentStation
  const entityName = isStation ? "Station" : isChildNode ? "Node" : "Stop"
  return mode === "add" ? `Add ${entityName}` : `Edit ${entityName}`
}
