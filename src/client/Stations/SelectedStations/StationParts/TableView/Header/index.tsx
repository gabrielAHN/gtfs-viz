import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";
import { usePageViewContext, useStationViewContext } from "@/context/combinedContext";
import { CreateStationsTable } from "@/hooks/DuckdbCalls/Ingestion/CreateStationTable";

import { Button } from "@/components/ui/button";
import { Pen, Trash, Info, Check } from "lucide-react";
import { useDuckDB } from "@/context/combinedContext";


function Header({
  setOpen,
  ClickInfo,
  setClickInfo
}) {
  const { conn } = useDuckDB()
  const queryClient = useQueryClient();

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

  return (
    <div className="align-bottom">
      {!ClickInfo ? (
        <div className="text-sm text-stone-500 ">
          Click a row to edit, or delete a station part.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              onClick={() => setClickInfo()}
              size="sm"
              variant="outline"
              className="dark:bg-stone-500 bg-stone-300 rounded-sm w-full"
            >
              <Check /> Selected Row
            </Button>
            {
             ClickInfo.location_type_name != 'Station' && (
            <Button
              size="sm"
              variant="delete"
              onClick={() => mutation.mutate()}
              className="w-full"
            >
              <Trash className="mr-2 h-5 w-5" />
              Delete
            </Button>
             )
             }
          </div>
          {
             ClickInfo.location_type_name != 'Station' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen({ formType: "edit", state: true })}
              className="w-full"
            >
              <Pen className="mr-2 h-5 w-5" />
              Edit
            </Button>
          </div>)
}
        </div>
      )}
    </div>
  );
}

export default Header;
