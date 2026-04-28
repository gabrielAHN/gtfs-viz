import { useMemo, useState, useEffect } from "react";

import Header from "./Header";
import TableComponent from '@/components/table'

function TableView({ data, setOpen, ClickInfo, setClickInfo }) {
  
  const [localClickInfo, setLocalClickInfo] = useState(ClickInfo);

  useEffect(() => {
    setLocalClickInfo(ClickInfo);
  }, [ClickInfo]);

  const handleSetClickInfo = (value: any) => {
    setLocalClickInfo(value);
    if (setClickInfo) {
      setClickInfo(value);
    }
  };

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
    ],
    [ClickInfo, setClickInfo]
  );

  return (
    <TableComponent data={data} columns={columns}
      ClickInfo={localClickInfo} setClickInfo={handleSetClickInfo}
    >
      <Header
        ClickInfo={localClickInfo}
        setClickInfo={handleSetClickInfo}
        setOpen={setOpen}
      />
    </TableComponent>
  );
}

export default TableView;
