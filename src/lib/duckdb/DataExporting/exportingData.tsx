import JSZip from "jszip";
import { logger } from "@/lib/logger";

import { generateDynamicSelectQuery, EditMergeQuery } from "../QueryHelper";

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
];

export const exportingData = async ({ conn, FileTypes }) => {
  const zip = new JSZip();
  const fileName = "edited_gtfs"

  try {
    const filteredDatafiles = Datafiles.filter(
      (fileInfo) => FileTypes[fileInfo.orgTable.name]
    );

    for (const fileInfo of filteredDatafiles) {
      const query = await CreateExportQuery(conn, fileInfo);

      await conn.send(`
        COPY (${query})
        TO '${fileInfo.orgTable.file}'
        (FORMAT CSV, HEADER, DELIMITER ',');
      `);

      const csvBuffer = await conn._bindings.copyFileToBuffer(
        fileInfo.orgTable.file
      );

      zip.file(`${fileName}/${fileInfo.orgTable.file}`, csvBuffer);

      await conn._bindings.dropFile(fileInfo.orgTable.file);
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
