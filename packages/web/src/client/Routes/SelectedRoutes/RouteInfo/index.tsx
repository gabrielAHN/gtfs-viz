import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import PopupTable from "@/components/table/PopupTable"
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors"
import EntityForm from "@/components/forms/EntityForm"
import { DeleteButton, EditButton } from "@/components/ui/ActionButtons"
import { useDuckDB } from "@/context/duckdb.client"
import { mutationDeleteRouteFn } from "@/lib/duckdb/DataEditing/editRoutes"
import { refreshRoutesTables } from "@/lib/extensions"

function RouteInfo({ route, routeStops = [] }: { route: any; routeStops?: any[] }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { conn } = useDuckDB()
  const [Open, setOpen] = useState<{ formType: string | null; state: boolean }>({
    formType: null,
    state: false,
  })
  const [isFormMutating, setIsFormMutating] = useState(false)
  const routeColor = route.route_color_hex || getRouteTypeColor(route.route_type_name)

  const invalidateRouteQueries = () => {
    ;[
      "fetchRoutesData",
      "fetchRouteShapes",
      "fetchRouteStops",
      "fetchServiceRouteInfoData",
      "fetchServiceRouteTripsData",
      "fetchServiceRouteServicesData",
      "fetchServiceRouteTripsForServiceData",
      "routeChips",
      "fetchStationsData",
      "fetchStopsData",
    ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      return mutationDeleteRouteFn({
        conn,
        SelectRoute: route,
      })
    },
    onSuccess: async () => {
      await refreshRoutesTables(conn)
      invalidateRouteQueries()
      router.navigate({ to: "/routes/map" })
    },
  })

  return (
    <div className="w-full p-1">
      <EntityForm
        Data={routeStops}
        OpenValue={Open}
        setOpenValue={setOpen}
        ClickInfo={route}
        setClickInfo={() => {}}
        type="route"
        onFormMutatingChange={setIsFormMutating}
      />
      <div className="mb-3 flex flex-col gap-2 md:flex-row">
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
      <div className="mb-2 flex items-center gap-2 rounded-md border p-3">
        <span className="h-3 w-10 rounded-sm border" style={{ backgroundColor: routeColor }} />
        <span className="text-sm font-medium">{route.route_type_name || "Route"}</span>
      </div>
      <PopupTable
        Data={route}
        ColumnsData={[
          "route_id",
          "route_name",
          "route_type_name",
          "stop_count",
          "station_count",
          "trip_count",
        ]}
        ColumnName={["Route ID", "Route Name", "Type", "Stops", "Stations", "Trips"]}
      />
    </div>
  )
}

export default RouteInfo
