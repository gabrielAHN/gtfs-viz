import {
  requiredFiles,
  keepColumnsFromCSV,
  generateCreateTableQuery,
} from "@/functions/stations/gtfsUploader/requiredFiles";

export default async function ingestFile(csvContent, db, conn) {
  await Promise.all(
    Object.entries(csvContent).map(async ([filename, table]) => {
      if (!table.content && filename === "pathways.txt") {
        const pathwaysTableQuery = generateCreateTableQuery(
          requiredFiles["pathways.txt"]
        );
        await conn.query(pathwaysTableQuery);
      } else {
        const filteredCsvContent = keepColumnsFromCSV(
          table.content,
          requiredFiles[filename].fileColumns
        );
        try {
          let tableName = requiredFiles[filename].tableName;
          let tableColumns = requiredFiles[filename].fileColumns;
          db.registerFileText(tableName, filteredCsvContent);
          await conn.insertCSVFromPath(tableName, {
            schema: "main",
            name: tableName,
            detect: true,
            header: true,
            delimiter: ",",
            columns: tableColumns,
          });
        } catch (error) {
          throw error;
        }
      }
    })
  );
  return "Success";
}
