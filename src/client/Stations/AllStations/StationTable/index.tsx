import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";

import Header from "./Header";
import TableComponent from "@/components/table";
import { DATA_STATUS, WHEELCHAIR_STATUS } from "@/components/style";

interface Station {
  row_id: number;
  stop_id: string;
  stop_name: string;
  stop_lat?: number;
  stop_lon?: number;
  exit_count?: number;
  pathways_status?: string;
  wheelchair_status?: string;
  status?: string;
}

function StationTable({
  data,
  setOpen,
  ClickInfo,
  setClickInfo,
  hasActiveFilters,
  onClearFilters,
  onSortingChange,
  clearSortingTrigger,
}) {
  const getPathwaysStatusLabel = (emoji: string): string => {
    const baseName = DATA_STATUS[emoji]?.name;
    if (!baseName) return emoji;

    if (emoji === "✅") return "Has Pathways";
    if (emoji === "❌") return "No Pathways";
    if (emoji === "🟡") return "Partial Pathways";

    return baseName;
  };

  const getWheelchairStatusLabel = (emoji: string): string => {
    return WHEELCHAIR_STATUS[emoji]?.name || emoji;
  };

  const columns = useMemo<ColumnDef<Station>[]>(
    () => [
      {
        accessorKey: "stop_id",
        header: "Stop Id",
      },
      {
        accessorKey: "stop_name",
        header: "Stop Name",
      },
      {
        accessorKey: "stop_lat",
        header: "Latitude",
      },
      {
        accessorKey: "stop_lon",
        header: "Longitude",
      },
      {
        accessorKey: "exit_count",
        header: "Exit Count",
      },
      {
        accessorKey: "pathways_status",
        header: "Pathways",
        cell: ({ row }) => {
          const emoji = row.original.pathways_status || "";
          const label = getPathwaysStatusLabel(emoji);
          return (
            <span className="inline-block relative group">
              {emoji}
              <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
                {label}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "wheelchair_status",
        header: "Wheelchair",
        cell: ({ row }) => {
          const emoji = row.original.wheelchair_status || "";
          const label = getWheelchairStatusLabel(emoji);
          return (
            <span className="inline-block relative group">
              {emoji}
              <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded whitespace-nowrap z-50 border shadow-md">
                {label}
              </span>
            </span>
          );
        },
      },
    ],
    [ClickInfo, setClickInfo],
  );

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
    >
      <Header
        ClickInfo={ClickInfo}
        setClickInfo={setClickInfo}
        setOpen={setOpen}
      />
    </TableComponent>
  );
}

export default StationTable;
