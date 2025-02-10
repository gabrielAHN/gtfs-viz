import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDuckDB } from "@/context/combinedContext";

import { fetchTableData } from "@/hooks/DuckdbCalls/DataFetching/fetchGTFSData";
import { mutationExportFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";

import EditeTables from "./TableComponent";

const StopsTable = ({ FileTypes, setFileTypes }) => {
  const { conn } = useDuckDB();
  const [isExpanded, setIsExpanded] = useState(false);
  const [clickInfo, setClickInfo] = useState();
  const queryClient = useQueryClient();

  const { data: tableData = [], isLoading, isError, error } = useQuery({
    queryKey: ["EditStopTable"],
    queryFn: () => fetchTableData({ conn, table: "EditStopTable" })
  });

  const mutation = useMutation({
    mutationFn: async (mutateType) => {
      await mutationExportFn({
        conn: conn,
        mutateType: mutateType,
        SelectStation: clickInfo,
        TableName: 'EditStopTable'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["EditStopTable"]);
      setClickInfo();
    }
  });


  const hasData = useMemo(() => tableData.length > 0, [tableData]);

  useEffect(() => {
    if (hasData) {
      setFileTypes((prev) => ({ ...prev, stops: true }));
    }
  }, [hasData, setFileTypes]);

  const handleButtonClick = () => {
    setFileTypes((prev) => ({ ...prev, stops: !prev.stops }));
  };

  return (
    <EditeTables
      FileTypes={FileTypes}
      setFileTypes={setFileTypes}
      hasData={hasData}
      isLoading={isLoading}
      error={error}
      isError={isError}
      tableData={tableData}
      clickInfo={clickInfo}
      setClickInfo={setClickInfo}
      isExpanded={isExpanded}
      setIsExpanded={setIsExpanded}
      handleButtonClick={handleButtonClick}
      mutation={mutation}
      columns={[
        { accessorKey: "status", header: "Status" },
        { accessorKey: "location_type_name", header: "Location Type" },
        { accessorKey: "stop_id", header: "Stop Id" },        
        { accessorKey: "stop_name", header: "Stop Name" },
        { accessorKey: "stop_lat", header: "Latitude" },
        { accessorKey: "stop_lon", header: "Longitude" },
        { accessorKey: "wheelchair_status" , header: "Wheelchair" },
      ]}

    />
  );
};

export default StopsTable;
