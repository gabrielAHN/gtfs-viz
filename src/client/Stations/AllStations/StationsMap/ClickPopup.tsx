import { Button } from "@mui/material";
import TableComponent from "@/components/MuiComponent/TableComponent";
import { usePageViewContext, useStationViewContext } from "@/context/combinedContext";

function ClickPopup({ ClickInfo, setClickInfo, setViewState }) {
  const { setPageState } = usePageViewContext();
  const { setStationView } = useStationViewContext();

  
  const handleClose = () => {
    setClickInfo(null);
  };
  
  const handleGoToLocation = () => {
    setViewState({
      longitude: ClickInfo.object.stop_lon,
      latitude: ClickInfo.object.stop_lat,
      zoom: 15,
    });
  }

  const handleStationView = () => {
    setStationView({
      stopId: ClickInfo.object.stop_id,
      stopName: ClickInfo.object.stop_name,
      pathwayStatus: ClickInfo.object.pathways_status
    })
    setPageState("stationView");
  }
  
  return (
    <div className="relative z-10 md:absolute md:left-2 md:top-5 w-full md:w-1/3 ">
      <div className="p-3 bg-white rounded-md text-xs shadow-md shadow-[rgba(0,0,0,0.75)] w-full">
        <h1 className="font-bold text-lg">{ClickInfo.object.stop_name}</h1>
        <div className="overflow-x-auto">
          <TableComponent
            Data={ClickInfo.object}
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
        <div className="flex flex-col gap-1 mt-4">
          <div className="flex gap-1">
            <Button
              variant="outlined"
              size="small"
              className="flex-grow min-w-0"
              onClick={handleStationView}
            >
              Station Info
            </Button>
            <Button
              variant="outlined"
              size="small"
              className="flex-grow min-w-0"
              onClick={handleGoToLocation}
            >
              Go to Location
            </Button>
          </div>
          <Button variant="outlined" onClick={handleClose} size="small">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ClickPopup;
