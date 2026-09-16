import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BiMap } from "react-icons/bi"
import { useExportTable } from "../hooks/useExportTable"
import EditeTables from "./TableComponent"

const TripsEditTable = ({ FileTypes, setFileTypes }: { FileTypes: any; setFileTypes: any }) => {
  const table = useExportTable({
    editTableName: "EditTripsTable",
    sourceTableName: "trips",
    fileTypeKey: "trips",
    itemIdKey: "trip_id",
    setFileTypes,
    invalidateKeys: ["fetchAllTripsData", "fetchServiceRouteTripsForServiceData"],
  })

  const columns = useMemo(
    () => [
      { accessorKey: "trip_id", header: "Trip ID" },
      { accessorKey: "route_id", header: "Route" },
      { accessorKey: "service_id", header: "Service" },
      { accessorKey: "trip_headsign", header: "Headsign" },
      { accessorKey: "direction_id", header: "Dir" },
      {
        accessorKey: "status",
        header: "Change Type",
        cell: ({ row }: any) => {
          const s = row.original.status
          if (s === "deleted") return <Badge variant="destructive">Deleted</Badge>
          if (s === "new") return <Badge variant="default">New</Badge>
          if (s === "edit" || s === "new edit") return <Badge variant="secondary">Modified</Badge>
          return <Badge variant="outline">Unknown</Badge>
        },
      },
    ],
    [],
  )

  return (
    <EditeTables
      FileTypes={FileTypes}
      hasData={table.hasData}
      isLoading={table.isLoading}
      isError={table.isError}
      error={table.error}
      tableData={table.tableData}
      clickInfo={table.clickInfo}
      setClickInfo={table.setClickInfo}
      columns={columns}
      handleButtonClick={table.handleButtonClick}
      setIsExpanded={table.setIsExpanded}
      isExpanded={table.isExpanded}
      mutation={table.mutation}
      originalDataMap={table.originalDataMap}
      fileTypeKey="trips"
      itemIdKey="trip_id"
      title="trips.txt"
      emptyTitle="trips.txt"
      getOriginalDataKey={(item: any) => item?.trip_id}
      renderSelectionActions={({ clickInfo: ci }: any) =>
        ci?.trip_id && ci?.status !== "deleted" ? (
          <div className="flex gap-1">
            <Button asChild variant="secondary" size="sm">
              <Link to="/trips/table" search={{ selectedTripId: ci.trip_id }}>
                <BiMap className="mr-2 h-4 w-4" />
                View Trip
              </Link>
            </Button>
            {ci?.route_id && ci?.service_id && (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/routes/service"
                  search={{ selectedRouteId: ci.route_id, selectedServiceId: ci.service_id }}
                >
                  View in Route
                </Link>
              </Button>
            )}
          </div>
        ) : null
      }
    />
  )
}

export default TripsEditTable
