import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors";
import { formatTripTime } from "@/lib/tripUtils";
import type { TripRow } from "./types";

export function useTripColumns(hasStopTimes: boolean) {
  return useMemo<ColumnDef<TripRow>[]>(
    () => [
      { accessorKey: "trip_id", header: "Trip ID" },
      {
        accessorKey: "route_name", header: "Route",
        cell: ({ row }) => {
          const t = row.original;
          const color = t.route_color_hex || getRouteTypeColor(t.route_type_name);
          return (
            <Link to="/routes/info" search={{ selectedRouteId: t.route_id }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex min-w-0 items-center gap-2 rounded px-1.5 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors">
              <span className="h-3 w-6 rounded-sm border shrink-0" style={{ backgroundColor: color }} />
              <span className="truncate">{t.route_name || t.route_id || ""}</span>
            </Link>
          );
        },
      },
      {
        accessorKey: "service_id", header: "Service",
        cell: ({ row }) => {
          const t = row.original;
          if (!t.service_id) return "";
          return (
            <Link to={hasStopTimes ? "/routes/service" : "/routes/info"}
              search={{ selectedRouteId: t.route_id, ...(hasStopTimes ? { selectedServiceId: t.service_id } : {}) }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center rounded px-1.5 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors">
              {t.service_id}
            </Link>
          );
        },
      },
      { accessorKey: "route_type_name", header: "Type" },
      ...(hasStopTimes ? [
        { accessorKey: "first_departure_seconds", header: "Departure", cell: ({ row }: any) => formatTripTime(row.original.first_departure_seconds) || "" },
        { accessorKey: "last_arrival_seconds", header: "Arrival", cell: ({ row }: any) => formatTripTime(row.original.last_arrival_seconds) || "" },
      ] : []),
      { accessorKey: "trip_headsign", header: "Headsign" },
      { accessorKey: "direction_id", header: "Dir" },
    ],
    [hasStopTimes],
  );
}
