import { Badge } from "@/components/ui/badge"
import { useEditsOverview } from "../hooks/useEditsOverview"

/** Compact chip row summarizing pending edits by category. Shown above the Edits/Export tabs. */
export default function ChangeSummary() {
  const { data, isLoading } = useEditsOverview()
  if (isLoading || !data) return null

  const num = (v: unknown) => Number(v) || 0
  const effectCount = (s: Record<string, any>) =>
    [num(s.added) > 0, num(s.removed) > 0, num(s.retimed) > 0].filter(Boolean).length
  const allTripChanges = data.trips.filter(
    (trip) => trip.status === "edit" || trip.status === "new edit",
  )
  const tripChangeIds = new Set(allTripChanges.map((trip) => String(trip.trip_id)))
  const rerouteMultiples = data.stopTimes.filter(
    (change) =>
      change.edit_type === "reroute" &&
      (num(change.non_reroute_rows) > 0 || tripChangeIds.has(String(change.trip_id))),
  )
  const rerouteMultipleTripIds = new Set(
    rerouteMultiples
      .filter((change) => tripChangeIds.has(String(change.trip_id)))
      .map((change) => String(change.trip_id)),
  )
  const tripChanges = allTripChanges.filter(
    (trip) => !rerouteMultipleTripIds.has(String(trip.trip_id)),
  )
  const reroutes = data.stopTimes.filter(
    (change) =>
      change.edit_type === "reroute" &&
      num(change.non_reroute_rows) === 0 &&
      !tripChangeIds.has(String(change.trip_id)),
  ).length
  const otherSchedule = data.stopTimes.filter((s) => s.edit_type !== "reroute")
  const multiple = rerouteMultiples.length + otherSchedule.filter((s) => effectCount(s) > 1).length
  const singleSchedule = otherSchedule.filter((s) => effectCount(s) <= 1).length

  const chips = [
    { label: "trip additions", n: data.trips.filter((t) => t.status === "new").length },
    {
      label: "trip changes",
      n: tripChanges.length,
    },
    { label: "trip deletions", n: data.trips.filter((t) => t.status === "deleted").length },
    { label: "reroutes", n: reroutes },
    { label: "multiple edits", n: multiple },
    { label: "schedule changes", n: singleSchedule },
    { label: "service changes", n: data.calendar.length },
    { label: "date exceptions", n: data.calendarDates.length },
    { label: "stop changes", n: data.stops.length },
    { label: "pathway changes", n: data.pathways.length },
    { label: "route changes", n: data.routes.length },
  ].filter((c) => c.n > 0)

  if (chips.length === 0) {
    return <p className="text-muted-foreground mb-4">No pending edits.</p>
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((c) => (
        <Badge key={c.label} variant="secondary" className="text-sm py-1 px-2">
          <span className="font-bold mr-1">{c.n}</span>
          {c.label}
        </Badge>
      ))}
    </div>
  )
}
