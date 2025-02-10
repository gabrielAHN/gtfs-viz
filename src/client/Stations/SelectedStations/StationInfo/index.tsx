import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";

import { Button } from "@/components/ui/button";
import { Pen, Trash } from "lucide-react"
import { useDuckDB, useStationViewContext, usePageViewContext } from "@/context/combinedContext";

import Form from "./Form"
import PopupTable from "@/components/table/PopupTable";


function StationInfo({ Data }) {
  const { StationView } = useStationViewContext();
  const { setPageState } = usePageViewContext();
  const { conn } = useDuckDB();
  const [Open, setOpen] = useState(false);
  
  const mutation = useMutation({
    mutationFn: async () => {
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: StationView,
      });
    },
    onSuccess: () => {
      setPageState('dashboard');
    },
  });
  
  return (
    <div className="w-full p-1">
      <div className="grid grid-cols-1 gap-2 w-full mb-2">
        <div className="flex flex-col md:flex-row gap-2">
        <Form
          Data={Data}
          OpenValue={Open}
          setOpenValue={setOpen}
        />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen({ state: true })}
            className="w-full md:w-auto"
          >
            <Pen className="mr-2 h-5 w-5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="delete"
            onClick={() => {mutation.mutate()}} 
            className="w-full md:w-auto"
          >
            <Trash className="mr-2 h-5 w-5" />
            Delete
          </Button>
        </div>
      </div>
      <PopupTable
        Data={StationView}
        ColumnsData={[
          "stop_id",
          "stop_lon",
          "stop_lat",
          "status",
          "exit_count",
          "pathways_status",
          "wheelchair_status",
        ]}
        ColumnName={[
          "Stop Id",
          "Stop Lon",
          "Stop Lat",
          "Status",
          "Exit Count",
          "Pathways Status",
          "Wheelchair Status",
        ]}
      />
    </div>
  );
}

export default StationInfo;
