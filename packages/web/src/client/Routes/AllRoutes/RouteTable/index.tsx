import { useMemo } from "react"
import { ColumnDef } from "@tanstack/react-table"
import TableComponent from "@/components/table"
import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"
import { BiInfoCircle, BiPencil, BiTrash, BiX } from "react-icons/bi"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import { EditIndicator } from "@/components/ui/EditIndicator"

interface ServiceRoute {
  row_id: number
  route_id: string
  route_name: string
  route_short_name?: string
  route_long_name?: string
  route_type_name?: string
  route_color_hex?: string
  route_text_color_hex?: string
  stop_count?: number
  station_count?: number
  trip_count?: number
}

function RouteTable({
  data,
  ClickInfo,
  setClickInfo,
  hasActiveFilters,
  onClearFilters,
  onSortingChange,
  clearSortingTrigger,
  onEdit,
  onDelete,
  isDeleting,
  hasStopTimes = true,
}: any) {
  const columns = useMemo<ColumnDef<ServiceRoute>[]>(
    () => [
      {
        accessorKey: "route_id",
        header: "Route ID",
      },
      {
        accessorKey: "route_name",
        header: "Route Name",
        cell: ({ row }) => {
          const route = row.original as any
          return (
            <div className="flex min-w-0 items-center gap-2">
              <EditIndicator status={route.status} className="h-5 w-5" />
              <span
                className="h-3 w-8 rounded-sm border shrink-0"
                style={{
                  backgroundColor:
                    route.route_color_hex || getRouteTypeColor(route.route_type_name),
                }}
              />
              <span className="truncate">{route.route_name}</span>
            </div>
          )
        },
      },
      {
        accessorKey: "route_type_name",
        header: "Type",
      },
      ...(hasStopTimes
        ? [
            { accessorKey: "stop_count", header: "Stops" },
            { accessorKey: "station_count", header: "Stations" },
          ]
        : []),
      {
        accessorKey: "trip_count",
        header: "Trips",
      },
    ],
    [hasStopTimes],
  )

  const routeColor = ClickInfo?.route_color_hex || getRouteTypeColor(ClickInfo?.route_type_name)

  return (
    <TableComponent
      data={data}
      columns={columns}
      ClickInfo={ClickInfo}
      setClickInfo={setClickInfo}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      onSortingChange={onSortingChange}
      clearSortingTrigger={clearSortingTrigger}
      selectionKey="route_id"
    >
      {!ClickInfo ? (
        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
          Select a route row to view actions
        </div>
      ) : (
        <div
          className="mb-3 border-2 rounded-md bg-background shadow-sm"
          style={{ borderColor: routeColor }}
        >
          <div
            className="flex items-center justify-between p-3 border-b"
            style={{ backgroundColor: `${routeColor}20`, borderBottomColor: routeColor }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <EditIndicator status={ClickInfo.status} className="h-5 w-5" />
                <span
                  className="h-3 w-8 rounded-sm border shrink-0"
                  style={{ backgroundColor: routeColor }}
                />
                <h3 className="truncate text-sm font-semibold">
                  {ClickInfo.route_name || ClickInfo.route_id}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                ID: {ClickInfo.route_id}
                {ClickInfo.route_type_name && ` • ${ClickInfo.route_type_name}`}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setClickInfo(undefined)}
              className="h-8 w-8 p-0"
            >
              <BiX className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            <Button asChild size="sm" variant="default" className="w-full">
              <Link to="/routes/info" search={{ selectedRouteId: ClickInfo.route_id }}>
                <BiInfoCircle className="mr-2 h-4 w-4" />
                Select Route
              </Link>
            </Button>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onEdit(ClickInfo)}
              >
                <BiPencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                disabled={isDeleting}
                onClick={() => onDelete(ClickInfo)}
              >
                <BiTrash className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
        </div>
      )}
    </TableComponent>
  )
}

export default RouteTable
