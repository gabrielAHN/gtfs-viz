import { useQuery } from "@tanstack/react-query";
import { fetchCheckStationInfo } from "@/hooks/DuckdbCalls/DataFetching/fetchStationInfoData";
import { Skeleton } from "@mui/material";
import { useStationViewContext, useDuckDB } from "@/context/combinedContext";
import TableComponent from "@/components/MuiComponent/TableComponent";
import { StationInfoData } from "@/types/objectTypes";

function StationInfo() {
  const { StationView } = useStationViewContext();
  const { conn } = useDuckDB();

  const {
    data: StationInfoData,
    isLoading,
    error,
  } = useQuery<StationInfoData | null>({
    queryKey: ["fetchStationInfoData", StationView],
    queryFn: () => fetchCheckStationInfo({ conn, StationView }),
    enabled: !!StationView,
  });
  if (isLoading) {
    return (
      <>
        <Skeleton variant="rounded" height={50} />
        <br/>
        <Skeleton variant="rounded" height={100} />
      </>
    );
  }

  if (error) {
    return <div>Error loading station information.</div>;
  }

  if (!StationInfoData) {
    return <div>No station information available.</div>;
  }

  return (
    <div className="w-full p-5">
      <TableComponent
        Data={StationInfoData}
        ColumnsData={[
          "stop_id",
          "stop_lon",
          "stop_lat",
          "exit_count",
          "pathways_status",
          "wheelchair_status",
        ]}
        ColumnName={[
          "Stop Id",
          "Stop Lon",
          "Stop Lat",
          "Exit Count",
          "Pathways Status",
          "Wheelchair Status",
        ]}
      />
    </div>
  );
}

export default StationInfo;
