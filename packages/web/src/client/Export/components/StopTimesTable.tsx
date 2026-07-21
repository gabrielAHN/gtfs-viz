import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BiMap } from "react-icons/bi";
import { useExportTable } from "../hooks/useExportTable";
import EditeTables from "./TableComponent";

const StopTimesTable = ({ FileTypes, setFileTypes }: { FileTypes: any; setFileTypes: any }) => {
  const table = useExportTable({
    editTableName: "EditStopTimesTable",
    sourceTableName: "stop_times",
    fileTypeKey: "stop_times",
    itemIdKey: "row_id",
    setFileTypes,
    invalidateKeys: ["fetchServiceTripStopTimesData", "fetchAllTripsData", "fetchTripsTimeBounds"],
  });

  const columns = useMemo(() => [
    { accessorKey: "trip_id", header: "Trip ID" },
    { accessorKey: "stop_sequence", header: "#" },
    { accessorKey: "stop_id", header: "Stop ID" },
    { accessorKey: "arrival_time", header: "Arrival" },
    { accessorKey: "departure_time", header: "Departure" },
    {
      accessorKey: "status", header: "Change Type",
      cell: ({ row }: any) => {
        const s = row.original.status;
        if (s === "deleted") return <Badge variant="destructive">Deleted</Badge>;
        if (s === "new") return <Badge variant="default">New</Badge>;
        if (s === "edit" || s === "new edit") return <Badge variant="secondary">Modified</Badge>;
        return <Badge variant="outline">Unknown</Badge>;
      },
    },
  ], []);

  return (
    <EditeTables
      FileTypes={FileTypes} hasData={table.hasData} isLoading={table.isLoading} isError={table.isError} error={table.error}
      tableData={table.tableData} clickInfo={table.clickInfo} setClickInfo={table.setClickInfo} columns={columns}
      handleButtonClick={table.handleButtonClick} setIsExpanded={table.setIsExpanded} isExpanded={table.isExpanded}
      mutation={table.mutation} originalDataMap={table.originalDataMap} fileTypeKey="stop_times" itemIdKey="row_id"
      title="stop_times.txt" emptyTitle="stop_times.txt"
      getOriginalDataKey={(item: any) => String(item?.row_id)}
      renderSelectionActions={({ clickInfo: ci }: any) =>
        ci?.trip_id && ci?.status !== "deleted" ? (
          <Button asChild variant="secondary" size="sm">
            <Link to="/trips/table" search={{ selectedTripId: ci.trip_id }}>
              <BiMap className="mr-2 h-4 w-4" />View Trip
            </Link>
          </Button>
        ) : null
      }
    />
  );
};

export default StopTimesTable;
