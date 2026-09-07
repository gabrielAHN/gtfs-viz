import { useMutation, useQueryClient } from "@tanstack/react-query"
import { mutationDeleteStationFn } from "@/lib/duckdb/DataEditing/editingFn"

import { Button } from "@/components/ui/button"
import { BiPencil, BiTrash } from "react-icons/bi"
import { useDuckDB } from "@/context/duckdb.client"
import { createStopsTable, createStopsView } from "@/lib/extensions"
import TableSelectionHeader from "@/components/table/TableSelectionHeader"
import { RouteChipsForStop } from "@/components/routes/RouteChips"

function Header({ setOpen, ClickInfo, setClickInfo }) {
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const hasStopTimes = duckDB?.hasStopTimes ?? false

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      await mutationDeleteStationFn({
        conn: conn,
        SelectStation: ClickInfo,
      })
    },
    onSuccess: async () => {
      await createStopsView(conn)
      await createStopsTable(conn)
      queryClient.invalidateQueries({ queryKey: ["createStopsTable"] })
      queryClient.invalidateQueries({ queryKey: ["fetchStopsData"] })
      queryClient.invalidateQueries({ queryKey: ["fetchStopsIdData"] })
      queryClient.invalidateQueries({ queryKey: ["fetchStopsNamesData"] })
      setClickInfo(undefined)
    },
  })

  return (
    <TableSelectionHeader
      clickInfo={ClickInfo}
      onClose={() => setClickInfo(undefined)}
      emptyMessage="Select a stop row to view actions"
    >
      {hasStopTimes && (
        <div className="rounded-md border p-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Routes</div>
          <RouteChipsForStop stopId={ClickInfo.stop_id} collapsible />
        </div>
      )}
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
    </TableSelectionHeader>
  )
}

export default Header
