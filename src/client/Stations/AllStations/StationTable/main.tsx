import { DataGrid } from "@mui/x-data-grid";
import { IconButton } from "@mui/material";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import {
  usePageViewContext,
  useStationViewContext,
} from "@/context/combinedContext";

export const column_data = [
  {
    field: "",
    renderCell: (params) => (
      <IconButton
        onClick={() => params.row.handleButtonClick({
          stopId: params.row.stop_id,
          stopName: params.row.stop_name,
          pathwayStatus: params.row.pathways_status
          }
        )}
      >
        <CircleOutlinedIcon />
      </IconButton>
    ),
    sortable: false,
  },
  { field: "stop_id", headerName: "Stop Id", flex: 1 },
  { field: "stop_name", headerName: "Stop Name", flex: 1 },
  { field: "stop_lat", headerName: "Latitude", flex: 1 },
  { field: "stop_lon", headerName: "Longitude", flex: 1 },
  { 
    field: "exit_count", headerName: "Exit Count", width: 120,
    valueGetter: (params) => Number(params)
   },
  { field: "pathways_status", headerName: "Pathways", width: 120 },
  { field: "wheelchair_status", headerName: "Wheelchair", width: 120 },
];

export default function StationTable({ data }: any) {
  const { setPageState } = usePageViewContext();
  const { setStationView } = useStationViewContext();

  const handleButtonClick = (
      stopData: {
        stopId: string,
        stopName: string,
        pathwayStatus: string
    }
    ) => {
    setStationView(stopData);
    setPageState("stationView");
  };
  
  const rows = data.map((row, index) => ({
    id: index,
    handleButtonClick,
    ...row,
  }));

  return (
    <div className="flex w-full h-screen">
      {data ? (
        <>
          <DataGrid rows={rows} columns={column_data} />
        </>
      ) : (
        <p>No data available</p>
      )}
    </div>
  );
}
