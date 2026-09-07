import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { useExportTable } from "../hooks/useExportTable"
import EditeTables from "./TableComponent"

const CalendarDatesTable = ({ FileTypes, setFileTypes }: { FileTypes: any; setFileTypes: any }) => {
  const table = useExportTable({
    editTableName: "EditCalendarDatesTable",
    sourceTableName: "calendar_dates",
    fileTypeKey: "calendar_dates",
    itemIdKey: "row_id",
    setFileTypes,
    invalidateKeys: ["fetchServiceRouteServicesData"],
  })

  const columns = useMemo(
    () => [
      { accessorKey: "service_id", header: "Service ID" },
      { accessorKey: "date", header: "Date" },
      {
        accessorKey: "exception_type",
        header: "Exception",
        cell: ({ row }: any) =>
          Number(row.original.exception_type) === 1 ? (
            <Badge variant="default">Service added</Badge>
          ) : (
            <Badge variant="destructive">Service removed</Badge>
          ),
      },
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
      fileTypeKey="calendar_dates"
      itemIdKey="row_id"
      title="calendar_dates.txt"
      emptyTitle="calendar_dates.txt"
      getOriginalDataKey={(item: any) => item?.row_id}
    />
  )
}

export default CalendarDatesTable
