import { Link } from "@tanstack/react-router";
import { EditIndicator } from "@/components/ui/EditIndicator";
import type { TripStopTime, TripInfo } from "@/lib/tripUtils";

const combinedEditStatus = (
  current?: TripStopTime["edit_status"],
  next?: TripStopTime["edit_status"],
) => (current === "new" || next === "new" ? "new" : current || next);

export function TripStopSequence({ stopTimes, view = "stops" }: { stopTimes: TripStopTime[]; view?: "stops" | "stations" }) {
  if (view === "stations") {
    const grouped: Array<{ station_name: string; station_id: string; isStation: boolean; sequence: number; stop_count: number; arrival_time: string; departure_time: string; edit_status?: TripStopTime["edit_status"] }> = [];
    for (const st of stopTimes) {
      const hasParent = st.parent_station && st.parent_station !== "" && st.parent_station !== st.stop_id;
      const isStationType = st.location_type_name === "Station";
      const name = st.station_name || st.stop_name || "Unknown";
      const sid = hasParent ? st.parent_station! : (st.stop_id || "");
      const last = grouped[grouped.length - 1];
      if (last && last.station_name === name) {
        last.stop_count++;
        last.departure_time = st.departure_time || last.departure_time;
        last.edit_status = combinedEditStatus(last.edit_status, st.edit_status);
      } else grouped.push({ station_name: name, station_id: sid, isStation: !!hasParent || isStationType, sequence: grouped.length + 1, stop_count: 1, arrival_time: st.arrival_time || "", departure_time: st.departure_time || "", edit_status: st.edit_status });
    }
    return (
      <div className="rounded-md border shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted z-10">
              <tr><th className="px-3 py-2 text-left text-xs font-medium">#</th><th className="px-3 py-2 text-left text-xs font-medium">Station</th><th className="px-3 py-2 text-left text-xs font-medium">Arrival</th><th className="px-3 py-2 text-left text-xs font-medium">Departure</th></tr>
            </thead>
            <tbody>
              {grouped.length > 0 ? grouped.map((g, i) => (
                <tr key={i} className="border-t hover:bg-muted/50">
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <EditIndicator status={g.edit_status} className="h-3.5 w-3.5" />
                      {g.sequence}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {g.station_id ? (
                      g.isStation ? (
                        <Link to="/stations/info" search={{ selectedStationId: g.station_id }} onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-sm hover:bg-primary/10 text-primary/80 transition-colors">
                          {g.station_name}
                        </Link>
                      ) : (
                        <Link to="/stops/map" search={{ selectedStopId: g.station_id }} onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-sm hover:bg-primary/10 text-primary/80 transition-colors">
                          {g.station_name}
                        </Link>
                      )
                    ) : g.station_name}
                    {g.stop_count > 1 ? <span className="ml-1.5 text-xs text-muted-foreground">({g.stop_count} stops)</span> : null}
                  </td>
                  <td className="px-3 py-2">{g.arrival_time || "\u2014"}</td><td className="px-3 py-2">{g.departure_time || "\u2014"}</td>
                </tr>
              )) : <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No stop times available</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-md border shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted z-10">
            <tr><th className="px-3 py-2 text-left text-xs font-medium">#</th><th className="px-3 py-2 text-left text-xs font-medium">Stop</th><th className="px-3 py-2 text-left text-xs font-medium">ID</th><th className="px-3 py-2 text-left text-xs font-medium">Arrival</th><th className="px-3 py-2 text-left text-xs font-medium">Departure</th><th className="px-3 py-2 text-left text-xs font-medium">Station</th></tr>
          </thead>
          <tbody>
            {stopTimes.length > 0 ? stopTimes.map((st, i) => {
              const hasParent = st.parent_station && st.parent_station !== "" && st.parent_station !== st.stop_id;
              const stationId = hasParent ? st.parent_station : undefined;
              const linkClass = "inline-flex items-center rounded px-1.5 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors";
              return (
                <tr key={i} className="border-t hover:bg-muted/50">
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <EditIndicator status={st.edit_status} className="h-3.5 w-3.5" />
                      {st.stop_sequence ?? i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {st.stop_id ? (
                      (hasParent || st.location_type_name === "Station") ? (
                        <Link to="/stations/info" search={{ selectedStationId: hasParent ? st.parent_station! : st.stop_id }} onClick={(e) => e.stopPropagation()}
                          className={`${linkClass} text-sm`}>{st.stop_name || "\u2014"}</Link>
                      ) : (
                        <Link to="/stops/map" search={{ selectedStopId: st.stop_id }} onClick={(e) => e.stopPropagation()}
                          className={`${linkClass} text-sm`}>{st.stop_name || "\u2014"}</Link>
                      )
                    ) : (st.stop_name || "\u2014")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{st.stop_id || "\u2014"}</td>
                  <td className="px-3 py-2">{st.arrival_time || "\u2014"}</td><td className="px-3 py-2">{st.departure_time || "\u2014"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {stationId ? (
                      <Link to="/stations/info" search={{ selectedStationId: stationId }} onClick={(e) => e.stopPropagation()}
                        className={`${linkClass} text-xs`}>{st.station_name || stationId}</Link>
                    ) : "\u2014"}
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">No stop times available</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TripStopPanel({ trip, stopTimes, view = "stops" }: {
  trip: TripInfo; stopTimes: TripStopTime[]; view?: "stops" | "stations";
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground truncate">
          {trip.trip_id}{trip.trip_headsign ? ` \u2014 ${trip.trip_headsign}` : ""}
          {trip.direction_id !== undefined && trip.direction_id !== null ? (
            <span className="ml-1 text-muted-foreground/60">(dir {trip.direction_id})</span>
          ) : null}
        </span>
        {(trip as any).route_name && <span className="text-[10px] text-muted-foreground/70 truncate">{(trip as any).route_name}</span>}
        {(trip as any).service_id && <span className="text-[10px] text-muted-foreground/50 truncate">{(trip as any).service_id}</span>}
      </div>
      <TripStopSequence stopTimes={stopTimes} view={view} />
    </div>
  );
}
