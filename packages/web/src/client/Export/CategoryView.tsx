import { type ReactNode, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BiGitCompare, BiMap, BiUndo } from "react-icons/bi";
import { mutationExportFn } from "@/lib/duckdb/DataEditing/editingFn";
import { useDuckDB } from "@/context/duckdb.client";
import { useEditsOverview } from "./hooks/useEditsOverview";
import TripStopTimesCompare from "./components/TripStopTimesCompare";

const DAYS: [string, string][] = [
  ["monday", "M"],
  ["tuesday", "T"],
  ["wednesday", "W"],
  ["thursday", "Th"],
  ["friday", "F"],
  ["saturday", "Sa"],
  ["sunday", "Su"],
];

type RevertTarget = {
  table: string;
  field: string;
  value: unknown;
};

type RevertRequest = {
  id: string;
  targets: RevertTarget[];
};

type ScheduleChange = Record<string, any> & {
  trip_id: string;
};

const numberValue = (value: unknown) => Number(value) || 0;

const isReroute = (change: ScheduleChange) => change.edit_type === "reroute";
const isMultipleEdit = (change: ScheduleChange) => change.multiple_edit === true;

const scheduleEffectCount = (change: ScheduleChange) =>
  [
    numberValue(change.added) > 0,
    numberValue(change.removed) > 0,
    numberValue(change.retimed) > 0,
  ].filter(Boolean).length;

const statusBadge = (status: string) => {
  if (status === "deleted") return <Badge variant="destructive">Removed</Badge>;
  if (status === "new") return <Badge variant="default">Added</Badge>;
  return <Badge variant="secondary">Modified</Badge>;
};

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="border rounded-md p-3 mb-4">
      <h3 className="text-lg font-bold mb-2">
        {title} <span className="text-muted-foreground font-normal">({count})</span>
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">{children}</div>
      {right}
    </div>
  );
}

function RevertButton({
  onClick,
  pending,
  disabled = false,
}: {
  onClick: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      onClick={onClick}
      disabled={pending || disabled}
    >
      <BiUndo className="mr-1 h-3.5 w-3.5" />
      {pending ? "Reverting…" : "Revert"}
    </Button>
  );
}

function ScheduleBadges({ change }: { change: ScheduleChange }) {
  if (isMultipleEdit(change)) {
    return <Badge variant="secondary">Multiple edits</Badge>;
  }
  if (isReroute(change)) {
    return (
      <Badge variant="reroute">Reroute</Badge>
    );
  }
  const added = numberValue(change.added);
  const removed = numberValue(change.removed);
  const retimed = numberValue(change.retimed);
  return (
    <>
      {removed > 0 ? <Badge variant="destructive">Skipped stops</Badge> : null}
      {added > 0 ? <Badge variant="default">Added stops</Badge> : null}
      {retimed > 0 ? <Badge variant="secondary">Retimed</Badge> : null}
    </>
  );
}

function scheduleSummary(change: ScheduleChange) {
  const parts: string[] = [];
  const added = numberValue(change.added);
  const removed = numberValue(change.removed);
  const retimed = numberValue(change.retimed);
  if (isReroute(change)) {
    if (change.edit_from_stop_name && change.edit_to_stop_name) {
      parts.push(`${change.edit_from_stop_name} → ${change.edit_to_stop_name}`);
    }
    if (change.reroute_route_name) parts.push(`via ${change.reroute_route_name}`);
    if (isMultipleEdit(change)) parts.push("plus additional edits");
    parts.push(`${removed} replaced · ${added} inserted`);
    return parts.join(" · ");
  }
  if (removed > 0) parts.push(`${removed} stop${removed === 1 ? "" : "s"} removed`);
  if (added > 0) parts.push(`${added} stop${added === 1 ? "" : "s"} added`);
  if (retimed > 0) parts.push(`${retimed} stop time${retimed === 1 ? "" : "s"} changed`);
  return parts.join(" · ");
}

function TripCompareRow({
  change,
  onRevert,
  reverting,
  revertDisabled,
  defaultOpen,
  compareView,
  viewLabel = "View diff",
}: {
  change: ScheduleChange;
  onRevert: () => void;
  reverting: boolean;
  revertDisabled: boolean;
  defaultOpen: boolean;
  compareView: "table" | "map";
  viewLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const tripId = String(change.trip_id);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  return (
    <div className="rounded hover:bg-muted/50">
      <div className="flex items-center justify-between gap-2 py-1.5 px-2 text-sm">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <ScheduleBadges change={change} />
          <span className="font-medium">{tripId}</span>
          <span className="text-muted-foreground">{scheduleSummary(change)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={open ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <BiGitCompare className="mr-1 h-3.5 w-3.5" />
            {open ? "Hide" : "Compare"}
          </Button>
          <Button asChild variant="secondary" size="sm" className="h-7 text-xs">
            <Link to="/trips/table" search={{ selectedTripId: tripId }}>
              <BiMap className="mr-1 h-3.5 w-3.5" />
              {viewLabel}
            </Link>
          </Button>
          <RevertButton onClick={onRevert} pending={reverting} disabled={revertDisabled} />
        </div>
      </div>
      {open ? (
        <div className="px-2 pb-2">
          <TripStopTimesCompare
            key={`${tripId}-${compareView}`}
            tripId={tripId}
            defaultView={compareView}
            reroute={
              isReroute(change)
                ? {
                    fromStopName: change.edit_from_stop_name,
                    toStopName: change.edit_to_stop_name,
                    routeName: change.reroute_route_name,
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export default function CategoryView({
  selectedTripId,
  compareView,
}: {
  selectedTripId?: string;
  compareView: "table" | "map";
}) {
  const duckDB = useDuckDB();
  const conn = duckDB?.conn;
  const queryClient = useQueryClient();
  const { data, isLoading } = useEditsOverview();
  const revertMutation = useMutation({
    mutationFn: async (request: RevertRequest) => {
      for (const target of request.targets) {
        await mutationExportFn({
          conn,
          mutateType: "row",
          selectedRow: { [target.field]: target.value },
          tableName: target.table,
          rowIdField: target.field,
        });
      }
    },
    onSuccess: async (_result, request) => {
      await queryClient.invalidateQueries({ queryKey: ["editsOverview"] });
      for (const target of request.targets) {
        await queryClient.invalidateQueries({ queryKey: [target.table] });
      }
      await queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchServiceTripStopTimesData"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteTripsForServiceData"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteServicesData"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchStationsData"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchStopsData"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchRoutesData"] });
      await queryClient.invalidateQueries({ queryKey: ["stationPathwaysComplete"] });
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading edits…</div>;

  const tripAdds = data.trips.filter((trip) => trip.status === "new");
  const tripAddIds = new Set(tripAdds.map((trip) => String(trip.trip_id)));
  const allTripMods = data.trips.filter(
    (trip) => trip.status === "edit" || trip.status === "new edit",
  );
  const tripModIds = new Set(allTripMods.map((trip) => String(trip.trip_id)));
  const tripDels = data.trips.filter((trip) => trip.status === "deleted");
  const schedule = data.stopTimes.filter(
    (change) => !tripAddIds.has(String(change.trip_id)),
  ) as ScheduleChange[];
  const rerouteMultiples = schedule
    .filter(
      (change) =>
        isReroute(change) &&
        (numberValue(change.non_reroute_rows) > 0 ||
          tripModIds.has(String(change.trip_id))),
    )
    .map((change) => ({
      ...change,
      multiple_edit: true,
      has_trip_edit: tripModIds.has(String(change.trip_id)),
    }));
  const rerouteMultipleIds = new Set(
    rerouteMultiples
      .filter((change) => change.has_trip_edit)
      .map((change) => String(change.trip_id)),
  );
  const tripMods = allTripMods.filter(
    (trip) => !rerouteMultipleIds.has(String(trip.trip_id)),
  );
  const reroutes = schedule.filter(
    (change) =>
      isReroute(change) &&
      numberValue(change.non_reroute_rows) === 0 &&
      !tripModIds.has(String(change.trip_id)),
  );
  const otherSchedule = schedule.filter((change) => !isReroute(change));
  const multipleChanges = [
    ...rerouteMultiples,
    ...otherSchedule.filter((change) => scheduleEffectCount(change) > 1),
  ];
  const skips = otherSchedule.filter(
    (change) => scheduleEffectCount(change) === 1 && numberValue(change.removed) > 0,
  );
  const extended = otherSchedule.filter(
    (change) => scheduleEffectCount(change) === 1 && numberValue(change.added) > 0,
  );
  const retimes = otherSchedule.filter(
    (change) => scheduleEffectCount(change) === 1 && numberValue(change.retimed) > 0,
  );
  const total =
    tripAdds.length +
    tripMods.length +
    tripDels.length +
    schedule.length +
    data.calendar.length +
    data.calendarDates.length +
    data.stops.length +
    data.pathways.length +
    data.routes.length;

  if (total === 0) {
    return (
      <p className="text-muted-foreground">
        No pending edits. Apply changes from the CLI or the trip and station editors, then review
        them here.
      </p>
    );
  }

  const isReverting = (id: string) =>
    revertMutation.isPending && revertMutation.variables?.id === id;

  const revert = (request: RevertRequest) => () => revertMutation.mutate(request);

  const rowActions = (content: ReactNode, request: RevertRequest) => (
    <div className="flex items-center gap-1 shrink-0">
      {content}
      <RevertButton
        onClick={revert(request)}
        pending={isReverting(request.id)}
        disabled={revertMutation.isPending}
      />
    </div>
  );

  const tripLink = (id: string, label = "View trip") => (
    <Button asChild variant="secondary" size="sm" className="h-7 text-xs">
      <Link to="/trips/table" search={{ selectedTripId: id }}>
        <BiMap className="mr-1 h-3.5 w-3.5" />
        {label}
      </Link>
    </Button>
  );

  const serviceLink = (serviceId: string) => {
    const routeId = data.serviceRoute[String(serviceId)];
    if (!routeId) return null;
    return (
      <Button asChild variant="outline" size="sm" className="h-7 text-xs">
        <Link
          to="/routes/service"
          search={{ selectedRouteId: routeId, selectedServiceId: String(serviceId) }}
        >
          View service
        </Link>
      </Button>
    );
  };

  const scheduleRequest = (tripId: string, includeTripEdit = false): RevertRequest => ({
    id: `stop-times-${tripId}`,
    targets: [
      { table: "EditStopTimesTable", field: "trip_id", value: tripId },
      ...(includeTripEdit
        ? [{ table: "EditTripsTable", field: "trip_id", value: tripId }]
        : []),
    ],
  });

  return (
    <div>
      {revertMutation.isError ? (
        <p role="alert" className="text-destructive text-sm mb-3">
          Could not revert that edit. Please try again.
        </p>
      ) : null}

      <Section title="Trip additions" count={tripAdds.length}>
        {tripAdds.map((trip) => {
          const tripId = String(trip.trip_id);
          const request: RevertRequest = {
            id: `trip-add-${tripId}`,
            targets: [
              { table: "EditStopTimesTable", field: "trip_id", value: tripId },
              { table: "EditTripsTable", field: "trip_id", value: tripId },
            ],
          };
          return (
            <Row key={tripId} right={rowActions(tripLink(tripId), request)}>
              <Badge variant="default">Added</Badge>
              <span className="font-medium">{tripId}</span>
              <span className="text-muted-foreground">
                route {trip.route_id} · service {trip.service_id}
                {trip.trip_headsign ? ` · ${trip.trip_headsign}` : ""}
              </span>
            </Row>
          );
        })}
      </Section>

      <Section title="Reroutes" count={reroutes.length}>
        {reroutes.map((change) => {
          const tripId = String(change.trip_id);
          const request = scheduleRequest(tripId);
          return (
            <TripCompareRow
              key={tripId}
              change={change}
              defaultOpen={selectedTripId === tripId}
              compareView={compareView}
              viewLabel="View reroute"
              onRevert={revert(request)}
              reverting={isReverting(request.id)}
              revertDisabled={revertMutation.isPending}
            />
          );
        })}
      </Section>

      <Section title="Multiple edits" count={multipleChanges.length}>
        {multipleChanges.map((change) => {
          const tripId = String(change.trip_id);
          const request = scheduleRequest(tripId, change.has_trip_edit === true);
          return (
            <TripCompareRow
              key={tripId}
              change={change}
              defaultOpen={selectedTripId === tripId}
              compareView={compareView}
              viewLabel="View changes"
              onRevert={revert(request)}
              reverting={isReverting(request.id)}
              revertDisabled={revertMutation.isPending}
            />
          );
        })}
      </Section>

      <Section title="Skipped stops" count={skips.length}>
        {skips.map((change) => {
          const tripId = String(change.trip_id);
          const request = scheduleRequest(tripId);
          return (
            <TripCompareRow
              key={tripId}
              change={change}
              defaultOpen={selectedTripId === tripId}
              compareView={compareView}
              onRevert={revert(request)}
              reverting={isReverting(request.id)}
              revertDisabled={revertMutation.isPending}
            />
          );
        })}
      </Section>

      <Section title="Added stops" count={extended.length}>
        {extended.map((change) => {
          const tripId = String(change.trip_id);
          const request = scheduleRequest(tripId);
          return (
            <TripCompareRow
              key={tripId}
              change={change}
              defaultOpen={selectedTripId === tripId}
              compareView={compareView}
              onRevert={revert(request)}
              reverting={isReverting(request.id)}
              revertDisabled={revertMutation.isPending}
            />
          );
        })}
      </Section>

      <Section title="Schedule and timing changes" count={retimes.length}>
        {retimes.map((change) => {
          const tripId = String(change.trip_id);
          const request = scheduleRequest(tripId);
          return (
            <TripCompareRow
              key={tripId}
              change={change}
              defaultOpen={selectedTripId === tripId}
              compareView={compareView}
              onRevert={revert(request)}
              reverting={isReverting(request.id)}
              revertDisabled={revertMutation.isPending}
            />
          );
        })}
      </Section>

      <Section title="Trip changes" count={tripMods.length}>
        {tripMods.map((trip) => {
          const tripId = String(trip.trip_id);
          const request: RevertRequest = {
            id: `trip-change-${tripId}`,
            targets: [{ table: "EditTripsTable", field: "trip_id", value: tripId }],
          };
          return (
            <Row key={tripId} right={rowActions(tripLink(tripId), request)}>
              {statusBadge(trip.status)}
              <span className="font-medium">{tripId}</span>
              <span className="text-muted-foreground">
                route {trip.route_id} · service {trip.service_id}
                {trip.trip_headsign ? ` · ${trip.trip_headsign}` : ""}
              </span>
            </Row>
          );
        })}
      </Section>

      <Section title="Trip deletions" count={tripDels.length}>
        {tripDels.map((trip) => {
          const tripId = String(trip.trip_id);
          const request: RevertRequest = {
            id: `trip-delete-${tripId}`,
            targets: [{ table: "EditTripsTable", field: "trip_id", value: tripId }],
          };
          return (
            <Row key={tripId} right={rowActions(null, request)}>
              <Badge variant="destructive">Removed</Badge>
              <span className="font-medium">{tripId}</span>
            </Row>
          );
        })}
      </Section>

      <Section title="Service changes (calendar)" count={data.calendar.length}>
        {data.calendar.map((calendar) => {
          const serviceId = String(calendar.service_id);
          const request: RevertRequest = {
            id: `calendar-${serviceId}`,
            targets: [{ table: "EditCalendarTable", field: "service_id", value: serviceId }],
          };
          return (
            <Row key={serviceId} right={rowActions(serviceLink(serviceId), request)}>
              {statusBadge(calendar.status)}
              <span className="font-medium">{serviceId}</span>
              <span className="flex gap-0.5">
                {DAYS.map(([key, label]) => (
                  <span
                    key={key}
                    className={`px-1 rounded text-xs ${
                      Number(calendar[key])
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </span>
              <span className="text-muted-foreground text-xs">
                {calendar.start_date}–{calendar.end_date}
              </span>
            </Row>
          );
        })}
      </Section>

      <Section title="Date exceptions (calendar_dates)" count={data.calendarDates.length}>
        {data.calendarDates.map((date) => {
          const rowId = String(date.row_id);
          const serviceId = String(date.service_id);
          const request: RevertRequest = {
            id: `calendar-date-${rowId}`,
            targets: [{ table: "EditCalendarDatesTable", field: "row_id", value: date.row_id }],
          };
          return (
            <Row key={rowId} right={rowActions(serviceLink(serviceId), request)}>
              {statusBadge(date.status)}
              <span className="font-medium">{serviceId}</span>
              <span className="text-muted-foreground">{date.date}</span>
              <Badge variant={Number(date.exception_type) === 1 ? "default" : "destructive"}>
                {Number(date.exception_type) === 1 ? "service added" : "service removed"}
              </Badge>
            </Row>
          );
        })}
      </Section>

      <Section title="Station and pathway changes" count={data.stops.length + data.pathways.length}>
        {data.stops.map((stop) => {
          const stopId = String(stop.stop_id);
          const request: RevertRequest = {
            id: `stop-${stopId}`,
            targets: [{ table: "EditStopTable", field: "stop_id", value: stopId }],
          };
          const view =
            stop.status !== "deleted" ? (
              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                <Link to="/stops/map" search={{ selectedStopId: stopId }}>
                  View
                </Link>
              </Button>
            ) : null;
          return (
            <Row key={stopId} right={rowActions(view, request)}>
              {statusBadge(stop.status)}
              <span className="font-medium">{stopId}</span>
              <span className="text-muted-foreground">
                {stop.stop_name}
                {stop.location_type_name ? ` · ${stop.location_type_name}` : ""}
              </span>
            </Row>
          );
        })}
        {data.pathways.map((pathway) => {
          const pathwayId = String(pathway.pathway_id);
          const request: RevertRequest = {
            id: `pathway-${pathwayId}`,
            targets: [{ table: "EditPathwayTable", field: "pathway_id", value: pathwayId }],
          };
          return (
            <Row key={pathwayId} right={rowActions(null, request)}>
              {statusBadge(pathway.status)}
              <span className="font-medium">{pathwayId}</span>
              <span className="text-muted-foreground">
                {pathway.from_stop_id} → {pathway.to_stop_id}
              </span>
            </Row>
          );
        })}
      </Section>

      <Section title="Route changes" count={data.routes.length}>
        {data.routes.map((route) => {
          const routeId = String(route.route_id);
          const request: RevertRequest = {
            id: `route-${routeId}`,
            targets: [{ table: "EditRouteTable", field: "route_id", value: routeId }],
          };
          const view = (
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <Link to="/routes/info" search={{ selectedRouteId: routeId }}>
                View
              </Link>
            </Button>
          );
          return (
            <Row key={routeId} right={rowActions(view, request)}>
              {statusBadge(route.status)}
              <span className="font-medium">{routeId}</span>
              <span className="text-muted-foreground">
                {route.route_short_name || route.route_long_name || ""}
              </span>
            </Row>
          );
        })}
      </Section>
    </div>
  );
}
