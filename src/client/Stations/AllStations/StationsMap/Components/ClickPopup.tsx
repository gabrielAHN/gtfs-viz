
import { Button } from "@/components/ui/button";
import { Pen, Trash, Info, X, RotateCcw } from "lucide-react";
import PopupTable from "@/components/table/PopupTable";

import { useDuckDB } from "@/context/combinedContext";
import { usePageViewContext, useStationViewContext } from "@/context/combinedContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";


function ClickPopup({ ClickInfo, setClickInfo, setViewState, setOpen }) {
  const { conn } = useDuckDB()
  const { setPageState } = usePageViewContext();
  const { setStationView } = useStationViewContext();

  const queryClient = useQueryClient();

  const handleClose = () => {
    setClickInfo();
  };

  const handleGoToLocation = () => {
    setViewState({
      longitude: ClickInfo.stop_lon,
      latitude: ClickInfo.stop_lat,
      zoom: 15,
    });
  }


  const mutation = useMutation({
    mutationFn: async () => {
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: ClickInfo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["createStationTable"]);
      queryClient.invalidateQueries(["fetchStationsData"]);
      queryClient.invalidateQueries(["fetchStopsIdData"]);
      queryClient.invalidateQueries(["fetchStopsNamesData"]);
      setClickInfo();
    },
  });

  return (
    <div className="relative z-10 md:absolute md:left-5 md:top-20 w-full md:w-[40vh]">
      <div className="bg-white dark:bg-stone-900 p-4 rounded-md border relative">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-bold text-lg">{ClickInfo.stop_name}</h1>
          <X
            className="w-[2vh]"
            onClick={handleClose}
          />
        </div>
        <PopupTable
          Data={ClickInfo}
          ColumnsData={[
            "stop_id",
            "stop_lon",
            "stop_lat",
            "pathways_status",
            "wheelchair_status",
          ]}
          ColumnName={[
            "Stop Id",
            "Stop Lon",
            "Stop Lat",
            "Pathtway",
            "Wheelchair Boarding",
          ]}
        />
        <div className="space-y-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPageState("stationView")
                setStationView(ClickInfo)
              }
              }
              className="w-full"
            >
              <Info className="mr-2 h-5" />
              Info
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGoToLocation}
              className="w-full"
            >
              <RotateCcw className="mr-2 h-5" />
              Reset
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setOpen({ formType: "edit", state: true })}
            >
              <Pen className="mr-2 h-5 w-5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="delete"
              className="w-full"
              onClick={() => mutation.mutate()}
            >
              <Trash className="mr-2 h-5 w-5" />
              Delete
            </Button>

          </div>
        </div>
      </div>
    </div>
  );
}

export default ClickPopup;
