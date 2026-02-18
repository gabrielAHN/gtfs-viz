import Papa from "papaparse";
import * as arrow from "apache-arrow";

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
};

export function keepColumnsFromCSV(
  csvContent: string,
  columnsToKeep: string[]
): string {

  const parsedCSV = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });
  const fileColumns = Object.keys(columnsToKeep);

  const filteredData = parsedCSV.data.map((row: any) => {
    const filteredRow: any = {};
    fileColumns.forEach((column) => {
      if (row.hasOwnProperty(column)) {
        filteredRow[column] = row[column];
      }
    });
    return filteredRow;
  });

  const newCSV = Papa.unparse(filteredData);

  return newCSV;
}

function mapArrowTypeToSQL(type: arrow.DataType): string {
  if (type instanceof arrow.Utf8) return 'VARCHAR';
  if (type instanceof arrow.Float64) return 'DOUBLE';
  if (type instanceof arrow.Int32) return 'INTEGER';
  throw new Error(`Unsupported type: ${type}`);
}

export function generateCreateTableQuery(fileSchema: { tableName: string; fileColumns: Record<string, arrow.DataType> }) {
  const columns = Object.entries(fileSchema.fileColumns)
    .map(([columnName, columnType]) => `${columnName} ${mapArrowTypeToSQL(columnType)}`)
    .join(', ');

  return `CREATE TABLE ${fileSchema.tableName} (${columns});`;
}
