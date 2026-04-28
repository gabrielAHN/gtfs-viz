import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/lib/duckdb/DataEditing/editingFn";
import { useRouter } from "@tanstack/react-router";

import { useDuckDB } from "@/context/duckdb.client";
import { EditButton, DeleteButton } from "@/components/ui/ActionButtons";
import StopStationForm from "@/components/forms/StopStationForms";
import PopupTable from "@/components/table/PopupTable";

function StationInfo({ Data }) {
  const router = useRouter();
  const { conn } = useDuckDB();
  const [Open, setOpen] = useState({ formType: null, state: false });
  const [isFormMutating, setIsFormMutating] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: Data,
      });
    },
    onSuccess: () => {
      router.navigate({ to: "/stations" });
    },
  });
  
  return (
    <div className="w-full p-1">
      <div className="grid grid-cols-1 gap-2 w-full mb-2">
        <div className="flex flex-col md:flex-row gap-2">
          <StopStationForm
            Data={[Data]}
            OpenValue={Open}
            setOpenValue={setOpen}
            ClickInfo={Data}
            setClickInfo={() => {}}
            type="station"
            onFormMutatingChange={setIsFormMutating}
          />
          <EditButton
            onClick={() => setOpen({ formType: "edit", state: true })}
            disabled={isFormMutating || mutation.isPending}
            className="w-full md:w-auto"
          />
          <DeleteButton
            onClick={() => mutation.mutate()}
            isPending={mutation.isPending}
            disabled={isFormMutating || mutation.isPending}
            className="w-full md:w-auto"
          />
        </div>
      </div>
      <PopupTable
        Data={Data}
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
