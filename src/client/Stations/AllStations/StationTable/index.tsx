import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";

import Header from "./Header";
import TableComponent from '@/components/table'

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
  setClickInfo
}) {

  const columns = useMemo < ColumnDef < Station > [] > (
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
      },
      {
        accessorKey: "wheelchair_status",
        header: "Wheelchair",
      },
      {
        accessorKey: "status",
        header: "Status",
      },
    ],
    [ClickInfo, setClickInfo]
  );


  return (
    <TableComponent data={data} columns={columns}
      ClickInfo={ClickInfo} setClickInfo={setClickInfo}
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
