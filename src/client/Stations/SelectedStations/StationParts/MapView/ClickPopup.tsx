import { Button } from "@/components/ui/button";
import { Pen, Trash, X } from "lucide-react";
import PopupTable from "@/components/table/PopupTable";

import { StopTypeColors } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";

import { useDuckDB } from "@/context/combinedContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateStationsTable } from "@/hooks/DuckdbCalls/Ingestion/CreateStationTable";
import { mutationDeleteStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";


function ClickPopup({ setOpen, ClickInfo, setClickInfo }) {
  const { conn } = useDuckDB()

  const queryClient = useQueryClient();

  const handleClose = () => {
    setClickInfo();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: ClickInfo,
      });
    },
    onSuccess: async () => {
      await conn.query(CreateStationsTable)
      queryClient.invalidateQueries(["fetchStationInfoData"]);
      setClickInfo();
    },
  });

  const BorderColor = rgbToHex(StopTypeColors[ClickInfo.location_type_name]?.color)

  return (
    <div className="relative z-10 md:absolute md:left-5 md:top-20 w-full md:w-[40vh]">
      <div
        className={`bg-white dark:bg-stone-900 p-4 rounded-md border-4 relative`}
        style={{ borderColor: BorderColor }}
      >
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
            "status",
            "location_type_name",
            "wheelchair_status",
          ]}
          ColumnName={[
            "Stop Id",
            "Stop Lon",
            "Stop Lat",
            "Status",
            "Location Type",
            "Wheelchair Boarding",
          ]}
        />
        <div className="space-y-2">
          <div className="flex gap-1">
          </div>
            {
             ClickInfo.location_type_name != 'Station' && (
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
              )
            }
        </div>
      </div>
    </div>
  );
}

export default ClickPopup;
