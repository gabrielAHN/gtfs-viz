import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BiMap } from "react-icons/bi";
import { executeQuery } from "@/lib/duckdb/QueryHelper";
import { useExportTable } from "../hooks/useExportTable";
import EditeTables from "./TableComponent";

const CalendarTable = ({ FileTypes, setFileTypes }: { FileTypes: any; setFileTypes: any }) => {
  const table = useExportTable({
    editTableName: "EditCalendarTable",
    sourceTableName: "calendar",
    fileTypeKey: "calendar",
    itemIdKey: "service_id",
    setFileTypes,
    invalidateKeys: ["fetchServiceRouteServicesData"],
  });

  // Map service_id → route_id for navigation
  const { data: serviceRouteMap = new Map<string, string>() } = useQuery({
    queryKey: ["serviceRouteMap"],
    queryFn: async () => {
      const m = new Map<string, string>();
      const rows = await executeQuery(table.conn, "SELECT DISTINCT service_id, route_id FROM TripsTable WHERE service_id IS NOT NULL AND route_id IS NOT NULL");
      for (const r of rows) m.set(String(r.service_id), String(r.route_id));
      const newCals = await executeQuery(table.conn, "SELECT service_id FROM CalendarTable WHERE status IN ('new', 'new edit')");
      if (newCals.length > 0) {
        const firstRoute = await executeQuery(table.conn, "SELECT DISTINCT route_id FROM TripsTable WHERE route_id IS NOT NULL LIMIT 1");
        if (firstRoute.length > 0) {
          const rid = String(firstRoute[0].route_id);
          for (const c of newCals) { if (!m.has(String(c.service_id))) m.set(String(c.service_id), rid); }
        }
      }
      return m;
    },
    enabled: !!table.conn && table.initialized,
    staleTime: 30_000,
  });

  const columns = useMemo(() => [
    { accessorKey: "service_id", header: "Service ID" },
    { accessorKey: "monday", header: "Mon" },
    { accessorKey: "tuesday", header: "Tue" },
    { accessorKey: "wednesday", header: "Wed" },
    { accessorKey: "thursday", header: "Thu" },
    { accessorKey: "friday", header: "Fri" },
    { accessorKey: "saturday", header: "Sat" },
    { accessorKey: "sunday", header: "Sun" },
    { accessorKey: "start_date", header: "Start" },
    { accessorKey: "end_date", header: "End" },
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
      mutation={table.mutation} originalDataMap={table.originalDataMap} fileTypeKey="calendar" itemIdKey="service_id"
      title="calendar.txt" emptyTitle="calendar.txt"
      getOriginalDataKey={(item: any) => item?.service_id}
      renderSelectionActions={({ clickInfo: ci }: any) => {
        if (!ci?.service_id || ci?.status === "deleted") return null;
        const rid = serviceRouteMap.get(String(ci.service_id));
        return rid ? (
          <Button asChild variant="secondary" size="sm">
            <Link to="/routes/service" search={{ selectedRouteId: rid, selectedServiceId: String(ci.service_id) }}>
              <BiMap className="mr-2 h-4 w-4" />View
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled title="No route found — add a trip first">
            <BiMap className="mr-2 h-4 w-4" />View
          </Button>
        );
      }}
    />
  );
};

export default CalendarTable;
