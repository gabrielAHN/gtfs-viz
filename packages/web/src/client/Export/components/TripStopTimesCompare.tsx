import { useQuery } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BiMap, BiTable } from "react-icons/bi"
import { TripMap } from "@/client/Trips/components/Map"
import { fetchServiceTripStopTimesData } from "@/lib/duckdb/DataFetching/fetchRouteData"
import type { TripStopTime } from "@/lib/tripUtils"
import { CompareView, type EditRow } from "./CompareView"

const esc = (s: string) => s.replace(/'/g, "''")

type RerouteDetails = {
  fromStopName?: string
  toStopName?: string
  routeName?: string
}

/**
 * Fetches one trip's edited stop_times (EditStopTimesTable) and its original stop_times (base
 * `stop_times`), then renders the side-by-side original-vs-edited diff. Self-contained so it can be
 * mounted lazily from a collapsed "Compare" panel — the queries only run once it is shown.
 */
export default function TripStopTimesCompare({
  tripId,
  reroute,
  defaultView = "table",
}: {
  tripId: string
  reroute?: RerouteDetails
  defaultView?: "table" | "map"
}) {
  const duckDB = useDuckDB()
  const conn = duckDB?.conn
  const initialized = duckDB?.initialized ?? false
  const enabled = !!conn && initialized && !!tripId

  const runRows = async (sql: string) => {
    const result = await conn!.query(sql)
    return result.toArray().map((r: any) => r.toJSON())
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "tripCompareStopTimes",
      tripId,
      reroute?.fromStopName,
      reroute?.toStopName,
      reroute?.routeName,
    ],
    enabled,
    queryFn: async () => {
      const tid = `'${esc(tripId)}'`
      const edited = (await runRows(
        `SELECT * FROM EditStopTimesTable WHERE trip_id = ${tid}`,
      )) as EditRow[]
      const originalRows = await runRows(
        `SELECT rowid AS row_id, * FROM stop_times WHERE trip_id = ${tid} ORDER BY stop_sequence`,
      )
      const originalMap: Record<string, any> = {}
      for (const r of originalRows) originalMap[String(r.row_id)] = r
      const currentStops = reroute
        ? ((await fetchServiceTripStopTimesData(conn, tripId)) as TripStopTime[])
        : []
      return { edited, originalMap, currentStops }
    },
  })

  if (isLoading) return <div className="border rounded p-3 animate-pulse h-16" />
  if (isError)
    return <div className="text-red-500 text-xs p-2">Error: {(error as any)?.message}</div>
  if (!data) return null

  const table = (
    <CompareView tripId={tripId} editedRows={data.edited} originalMap={data.originalMap} />
  )
  if (!reroute) return table

  const stopMatches = (stop: TripStopTime, name?: string) =>
    Boolean(name) && (stop.station_name === name || stop.stop_name === name)
  const metadata = data.currentStops.find((stop) => stop.edit_type === "reroute")
  const fromName = reroute.fromStopName || metadata?.edit_from_stop_name
  const toName = reroute.toStopName || metadata?.edit_to_stop_name
  const fromStopIdx = data.currentStops.findIndex((stop) => stopMatches(stop, fromName))
  const toStopIdx = data.currentStops.findIndex((stop) => stopMatches(stop, toName))
  const highlightedSegmentRange =
    fromStopIdx >= 0 && toStopIdx >= 0 && fromStopIdx !== toStopIdx
      ? {
          fromStopIdx: Math.min(fromStopIdx, toStopIdx),
          toStopIdx: Math.max(fromStopIdx, toStopIdx),
        }
      : undefined
  const mapTrips = [
    {
      trip: {
        trip_id: `${tripId}:rerouted`,
        trip_headsign: reroute.routeName ? `Rerouted via ${reroute.routeName}` : "Rerouted trip",
      },
      stopTimes: data.currentStops.map((stop) => ({ ...stop, edit_status: undefined })),
    },
  ]

  return (
    <Tabs defaultValue={defaultView} className="space-y-3">
      <TabsList className="h-9">
        <TabsTrigger value="table" className="h-7 text-xs">
          <BiTable className="mr-1 h-3.5 w-3.5" />
          Table
        </TabsTrigger>
        <TabsTrigger value="map" className="h-7 text-xs">
          <BiMap className="mr-1 h-3.5 w-3.5" />
          Map
        </TabsTrigger>
      </TabsList>
      <TabsContent value="table" className="mt-0">
        {table}
      </TabsContent>
      <TabsContent value="map" className="mt-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            One route is shown; only the rerouted section is highlighted.
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Unchanged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Rerouted section
            </span>
          </div>
        </div>
        <TripMap
          trips={mapTrips}
          heightClassName="h-96"
          highlightedSegmentRange={highlightedSegmentRange}
        />
      </TabsContent>
    </Tabs>
  )
}
