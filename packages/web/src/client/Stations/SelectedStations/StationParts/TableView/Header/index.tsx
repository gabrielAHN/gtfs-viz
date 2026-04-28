import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutationDeleteStationFn } from "@/lib/duckdb/DataEditing/editingFn";
import { createStationsTable, createStopsView } from "@/lib/extensions";

import { Button } from "@/components/ui/button";
import { BiPencil, BiTrash } from "react-icons/bi";
import { useDuckDB } from "@/context/duckdb.client";
import TableSelectionHeader from "@/components/table/TableSelectionHeader";

function Header({ setOpen, ClickInfo, setClickInfo }) {
  const { conn } = useDuckDB();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: ClickInfo,
      });
    },
    onSuccess: async () => {
      await createStopsView(conn);
      await createStationsTable(conn);
      queryClient.invalidateQueries({ queryKey: ["fetchStationData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchStationInfoData"] });
      setClickInfo(undefined);
    },
  });

  return (
    <TableSelectionHeader
      clickInfo={ClickInfo}
      onClose={() => setClickInfo(undefined)}
      emptyMessage="Select a row to view actions"
    >
      {ClickInfo?.location_type_name !== "Station" && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen({ formType: "edit", state: true })}
            className="w-full"
          >
            <BiPencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="delete"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full"
          >
            <BiTrash className="mr-2 h-4 w-4" />
            {mutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      )}
      {ClickInfo?.location_type_name === "Station" && (
        <div className="text-sm text-muted-foreground text-center p-2">
          Station parts cannot be edited or deleted from this view
        </div>
      )}
    </TableSelectionHeader>
  );
}

export default Header;
