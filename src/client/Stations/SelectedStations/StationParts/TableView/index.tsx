import { useMemo } from "react";

import Header from "./Header";
import TableComponent from '@/components/table'

function TableView({ data, setOpen, ClickInfo, setClickInfo }) {
  
  const columns = useMemo(
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
        accessorKey: "location_type_name",
        header: "Location Type",
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

export default TableView;
