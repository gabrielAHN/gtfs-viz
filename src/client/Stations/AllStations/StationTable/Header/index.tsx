import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/hooks/DuckdbCalls/DataEditing/editingFn";
import { usePageViewContext, useStationViewContext } from "@/context/combinedContext";

import { Button } from "@/components/ui/button";
import { Pen, Trash, Info, Check } from "lucide-react";
import { useDuckDB } from "@/context/combinedContext";


function Header({
  setOpen,
  ClickInfo,
  setClickInfo
}) {
  const { conn } = useDuckDB()
  const { setPageState } = usePageViewContext();
  const { setStationView } = useStationViewContext();

  const queryClient = useQueryClient();

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
    <div className="align-bottom">
      {!ClickInfo ? (
        <div className="text-sm text-stone-500 ">
          Check a station to edit, delete, or learn more about it
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
              <Check /> Selected Station
            </Button>
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
              <Info className="mr-2 h-5 w-5" />
              Info
            </Button>

          </div>
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
            <Button
              size="sm"
              variant="delete"
              onClick={() => mutation.mutate()}
              className="w-full"
            >
              <Trash className="mr-2 h-5 w-5" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Header;
