import JSZip from "jszip";
import { logger } from "@/lib/logger";

import { generateDynamicSelectQuery, EditMergeQuery, executeQuery } from "../QueryHelper";

const Datafiles = [
  {
    orgTable: {
      name: "stops",
      file: "stops.csv",
      removeList: [
        "row_id", "wheelchair_boarding_name", "location_type_name"
      ]
    },
    editTable: {
      name: "EditStopTable",
      editQuery: EditMergeQuery,
      merge_id: "stop_id"
    },
  },
  {
    orgTable: {
      name: "pathways",
      file: "pathways.csv",
      removeList: [
        "row_id", "pathway_mode_name", "direction_type"
      ]
    },
    editTable: {
      name: "EditPathwayTable",
      editQuery: EditMergeQuery,
      merge_id: "pathway_id"
    },
  },
];

const isCliNativeConn = (conn: any): boolean =>
  Boolean(conn?.__gtfsVizCliNative);

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const escapeField = (val: unknown) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const header = columns.map(escapeField).join(",");
  const body = rows.map((row) => columns.map((col) => escapeField(row[col])).join(","));
  return [header, ...body].join("\n");
}

export const exportingData = async ({ conn, FileTypes }) => {
  const zip = new JSZip();
  const fileName = "edited_gtfs"

  try {
    const filteredDatafiles = Datafiles.filter(
      (fileInfo) => FileTypes[fileInfo.orgTable.name]
    );

    for (const fileInfo of filteredDatafiles) {
      const query = await CreateExportQuery(conn, fileInfo);

      let csvContent: string | Uint8Array;

      if (isCliNativeConn(conn)) {
        const columns = await generateDynamicSelectQuery(
          conn,
          fileInfo.orgTable.name,
          fileInfo.orgTable.removeList,
        );
        const rows = await executeQuery(conn, query);
        csvContent = rowsToCsv(columns, rows);
      } else {
        await conn.send(`
          COPY (${query})
          TO '${fileInfo.orgTable.file}'
          (FORMAT CSV, HEADER, DELIMITER ',');
        `);

        csvContent = await conn._bindings.copyFileToBuffer(
          fileInfo.orgTable.file
        );

        await conn._bindings.dropFile(fileInfo.orgTable.file);
      }

      zip.file(`${fileName}/${fileInfo.orgTable.file}`, csvContent);
    }

    createZipFile({ name: `${fileName}.zip`, zip });

    return {
      message: "CSVs exported and compressed into edited_gtfs.zip successfully.",
    };
  } catch (error) {
    logger.error("Error exporting CSV data:", error);
    throw error;
  }
};

const CreateExportQuery = async (conn, fileInfo) => {
  const orgColumnList = await generateDynamicSelectQuery(
    conn,
    fileInfo.orgTable.name,
    fileInfo.orgTable.removeList
  );
  const editColumnList = await generateDynamicSelectQuery(
    conn,
    fileInfo.editTable.name
  );

  const mappedColumns = orgColumnList.map((col) =>
    editColumnList.includes(col)
      ? `COALESCE(edt.${col}, NULL) AS ${col}`
      : `NULL AS ${col}`
  );

  const query = fileInfo.editTable.editQuery(
    orgColumnList,
    mappedColumns,
    fileInfo.orgTable.name,
    fileInfo.editTable.name,
    fileInfo.editTable.merge_id
  );
  return query
}

function createZipFile({ name, zip }) {
  zip.generateAsync({ type: "blob" }).then((zipBlob) => {
    const fileUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(fileUrl);
  });
}
