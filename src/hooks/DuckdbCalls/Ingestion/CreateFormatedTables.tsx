import { 
  CreateEditStopTable,
  CreateStationsTable, 
  CreateStationView 
} from "@/hooks/DuckdbCalls/Ingestion/CreateStationTable";
import { ReformatStopsTable, ReformatPathwaysTable } from "@/hooks/DuckdbCalls/Ingestion/ReformatTable";

export default async function createFormattedTables(conn) {
  const queries = [
    ReformatStopsTable,
    ReformatPathwaysTable,
    CreateEditStopTable,
    CreateStationView,
    CreateStationsTable,
  ];

  try {
    for (const query of queries) {
      await conn.query(query);
    }
    return "Success";
  } catch (error) {
    console.error("Error creating formatted tables:", error);
    throw error;
  }
}
