import Papa from "papaparse"
import * as arrow from "apache-arrow"

export const requiredFiles = {
  "stops.txt": {
    tableName: "stops",
    fileType: "required",
    fileColumns: {
      stop_id: new arrow.Utf8(),
      stop_name: new arrow.Utf8(),
      stop_lat: new arrow.Float64(),
      stop_lon: new arrow.Float64(),
      location_type: new arrow.Utf8(),
      parent_station: new arrow.Utf8(),
      wheelchair_boarding: new arrow.Utf8(),
    },
  },
  "pathways.txt": {
    tableName: "pathways",
    fileType: "optional",
    fileColumns: {
      pathway_id: new arrow.Utf8(),
      from_stop_id: new arrow.Utf8(),
      to_stop_id: new arrow.Utf8(),
      pathway_mode: new arrow.Int32(),
      is_bidirectional: new arrow.Utf8(),
      traversal_time: new arrow.Int32(),
    },
  },
  "routes.txt": {
    tableName: "routes",
    fileType: "optional",
    fileColumns: {
      route_id: new arrow.Utf8(),
      agency_id: new arrow.Utf8(),
      route_short_name: new arrow.Utf8(),
      route_long_name: new arrow.Utf8(),
      route_type: new arrow.Int32(),
      route_color: new arrow.Utf8(),
      route_text_color: new arrow.Utf8(),
    },
  },
  "trips.txt": {
    tableName: "trips",
    fileType: "optional",
    fileColumns: {
      route_id: new arrow.Utf8(),
      service_id: new arrow.Utf8(),
      trip_id: new arrow.Utf8(),
      shape_id: new arrow.Utf8(),
    },
  },
  "stop_times.txt": {
    tableName: "stop_times",
    fileType: "optional",
    fileColumns: {
      trip_id: new arrow.Utf8(),
      stop_id: new arrow.Utf8(),
      stop_sequence: new arrow.Int32(),
    },
  },
  "shapes.txt": {
    tableName: "shapes",
    fileType: "optional",
    fileColumns: {
      shape_id: new arrow.Utf8(),
      shape_pt_lat: new arrow.Float64(),
      shape_pt_lon: new arrow.Float64(),
      shape_pt_sequence: new arrow.Int32(),
    },
  },
  "calendar.txt": {
    tableName: "calendar",
    fileType: "optional",
    fileColumns: {
      service_id: new arrow.Utf8(),
      monday: new arrow.Int32(),
      tuesday: new arrow.Int32(),
      wednesday: new arrow.Int32(),
      thursday: new arrow.Int32(),
      friday: new arrow.Int32(),
      saturday: new arrow.Int32(),
      sunday: new arrow.Int32(),
      start_date: new arrow.Utf8(),
      end_date: new arrow.Utf8(),
    },
  },
  "calendar_dates.txt": {
    tableName: "calendar_dates",
    fileType: "optional",
    fileColumns: {
      service_id: new arrow.Utf8(),
      date: new arrow.Utf8(),
      exception_type: new arrow.Int32(),
    },
  },
}

export function keepColumnsFromCSV(
  csvContent: string,
  columnsToKeep: Record<string, arrow.DataType>,
): string {
  const parsedCSV = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  })
  const keepKeys = Object.keys(columnsToKeep)

  const filteredData = parsedCSV.data.map((row: any) => {
    const filteredRow: any = {}
    keepKeys.forEach((column) => {
      filteredRow[column] = row.hasOwnProperty(column) ? row[column] : ""
    })
    return filteredRow
  })

  const newCSV = Papa.unparse(filteredData)

  return newCSV
}

export function mapArrowTypeToSQL(type: arrow.DataType): string {
  if (type instanceof arrow.Utf8) return "VARCHAR"
  if (type instanceof arrow.Float64) return "DOUBLE"
  if (type instanceof arrow.Int32) return "INTEGER"
  throw new Error(`Unsupported type: ${type}`)
}

export function generateCreateTableQuery(fileSchema: {
  tableName: string
  fileColumns: Record<string, arrow.DataType>
}) {
  const columns = Object.entries(fileSchema.fileColumns)
    .map(([columnName, columnType]) => `${columnName} ${mapArrowTypeToSQL(columnType)}`)
    .join(", ")

  return `CREATE TABLE ${fileSchema.tableName} (${columns});`
}
