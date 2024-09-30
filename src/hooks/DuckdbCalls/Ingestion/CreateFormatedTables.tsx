import { CreateStationsTable } from "@/hooks/DuckdbCalls/Ingestion/CreateStationTable";
import { ReformatStopsTable, ReformatPathwaysTable } from "@/hooks/DuckdbCalls/Ingestion/ReformatTable";

export default async function createFormatedTables(db, conn: any) {
  try {
    await conn.query(ReformatStopsTable);
    await conn.query(ReformatPathwaysTable);
    await conn.query(CreateStationsTable);
    return "Success";
  } catch (error) {
    console.error("Error creating formatted tables:", error);
    throw error;
  }
}
