import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BiGitCompare, BiTransferAlt } from "react-icons/bi";
import { Badge } from "@/components/ui/badge";
import Combobox from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormActions } from "@/components/forms/shared/FormActions";
import { useDuckDB } from "@/context/duckdb.client";
import { TripMap } from "@/client/Trips/components/Map";
import {
  fetchTripRerouteBoundaryPairs,
  fetchTripReroutePreview,
  fetchTripRerouteRoutes,
  REROUTE_QUERY_STALE_TIME,
  saveTripReroute,
  type RerouteStop,
  type TripReroutePreview,
} from "@/lib/duckdb/DataEditing/rerouteTrip";

type RerouteTripDialogProps = {
  open: boolean;
  tripId: string;
  onOpenChange: (open: boolean) => void;
};

const stopTime = (stop: RerouteStop) => {
  if (!stop.arrival_time && !stop.departure_time) return "";
  if (!stop.departure_time || stop.arrival_time === stop.departure_time) {
    return stop.arrival_time || stop.departure_time || "";
  }
  return `${stop.arrival_time || "—"} → ${stop.departure_time}`;
};

function SegmentStopList({ stops, emptyText }: { stops: RerouteStop[]; emptyText: string }) {
  if (stops.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
      {stops.map((stop, index) => (
        <div
          key={`${stop.stop_id}-${stop.stop_sequence}-${index}`}
          className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-sm"
        >
          <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{stop.station_name}</div>
            <div className="truncate text-xs text-muted-foreground">{stop.stop_id}</div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{stopTime(stop)}</span>
        </div>
      ))}
    </div>
  );
}

function RerouteStopChanges({
  preview,
  routeLabel,
}: {
  preview: TripReroutePreview;
  routeLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BiGitCompare className="h-4 w-4 text-primary" />
        <span className="font-semibold">Stop changes</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-semibold">{preview.fromStation}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-semibold">{preview.toStation}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Replaced stops</h4>
            <Badge variant="destructive">{preview.originalSegment.length}</Badge>
          </div>
          <SegmentStopList
            stops={preview.originalSegment}
            emptyText="The original trip runs directly between these stations."
          />
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">New section via {routeLabel}</h4>
            <Badge variant="default">{preview.replacementSegment.length}</Badge>
          </div>
          <SegmentStopList
            stops={preview.replacementSegment}
            emptyText="The replacement route runs directly between these stations."
          />
        </section>
      </div>
    </div>
  );
}

export function ReroutePreviewDetails({
  preview,
  routeLabel,
  disabled = false,
}: {
  preview: TripReroutePreview;
  routeLabel: string;
  disabled?: boolean;
}) {
  const mapTrips = useMemo(
    () => [
      {
        trip: {
          trip_id: `${preview.tripId}:rerouted`,
          trip_headsign: `Rerouted via ${routeLabel}`,
        },
        stopTimes: preview.mergedStops.map((stop) => ({
          ...stop,
          trip_id: preview.tripId,
        })),
      },
    ],
    [preview, routeLabel],
  );
  const highlightedSegmentRange = useMemo(() => {
    const fromStopIdx = preview.mergedStops.findIndex(
      (stop) => stop.station_name === preview.fromStation || stop.stop_name === preview.fromStation,
    );
    const toStopIdx = preview.mergedStops.findIndex(
      (stop, index) =>
        index > fromStopIdx &&
        (stop.station_name === preview.toStation || stop.stop_name === preview.toStation),
    );
    return fromStopIdx >= 0 && toStopIdx > fromStopIdx ? { fromStopIdx, toStopIdx } : undefined;
  }, [preview]);
  return (
    <Tabs defaultValue="timetable" className="space-y-3">
      <TabsList className="h-9">
        <TabsTrigger value="timetable" className="h-7 text-xs" disabled={disabled}>
          Timetable
        </TabsTrigger>
        <TabsTrigger value="map" className="h-7 text-xs" disabled={disabled}>
          Map
        </TabsTrigger>
      </TabsList>
      <TabsContent value="timetable" className="mt-0">
        <RerouteStopChanges preview={preview} routeLabel={routeLabel} />
      </TabsContent>
      <TabsContent value="map" className="mt-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Rerouted trip</h4>
            <p className="text-xs text-muted-foreground">
              One route is shown; only the replaced section is highlighted.
            </p>
          </div>
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
          heightClassName="h-80"
          highlightedSegmentRange={highlightedSegmentRange}
        />
      </TabsContent>
    </Tabs>
  );
}

export function RerouteTripDialog({
  open,
  tripId,
  onOpenChange,
}: RerouteTripDialogProps) {
  const { conn, initialized } = useDuckDB() ?? {};
  const queryClient = useQueryClient();
  const [routeId, setRouteId] = useState<string>();
  const [fromStation, setFromStation] = useState<string>();
  const [toStation, setToStation] = useState<string>();

  const routesQuery = useQuery({
    queryKey: ["tripRerouteRoutes", tripId],
    queryFn: () => fetchTripRerouteRoutes(conn, tripId),
    enabled: open && !!conn && !!initialized,
    staleTime: REROUTE_QUERY_STALE_TIME,
  });

  const selectedRoute = routesQuery.data?.find((route) => route.route_id === routeId);
  const boundaryPairsQuery = useQuery({
    queryKey: ["tripRerouteBoundaryPairs", tripId, selectedRoute?.donor_trip_id],
    queryFn: () => fetchTripRerouteBoundaryPairs(conn, tripId, selectedRoute!.donor_trip_id),
    enabled: open && !!conn && !!selectedRoute,
    staleTime: REROUTE_QUERY_STALE_TIME,
  });

  const fromOptions = useMemo(() => {
    const seen = new Set<string>();
    return (boundaryPairsQuery.data ?? []).flatMap((pair) => {
      if (seen.has(pair.fromStation)) return [];
      seen.add(pair.fromStation);
      return [{ value: pair.fromStation, label: pair.fromStation }];
    });
  }, [boundaryPairsQuery.data]);
  const toOptions = useMemo(() => {
    const seen = new Set<string>();
    return (boundaryPairsQuery.data ?? []).flatMap((pair) => {
      if (pair.fromStation !== fromStation || seen.has(pair.toStation)) return [];
      seen.add(pair.toStation);
      return [{ value: pair.toStation, label: pair.toStation }];
    });
  }, [boundaryPairsQuery.data, fromStation]);

  const previewQuery = useQuery({
    queryKey: ["tripReroutePreview", tripId, selectedRoute?.donor_trip_id, fromStation, toStation],
    queryFn: () =>
      fetchTripReroutePreview(conn, tripId, selectedRoute!.donor_trip_id, fromStation!, toStation!),
    enabled: open && !!conn && !!selectedRoute && !!fromStation && !!toStation,
    retry: false,
    staleTime: REROUTE_QUERY_STALE_TIME,
  });

  const saveMutation = useMutation({
    mutationFn: (preview: TripReroutePreview) => saveTripReroute(conn, tripId, preview),
    onSuccess: async (updatedStopTimes) => {
      queryClient.setQueryData(
        ["fetchServiceTripStopTimesData", tripId],
        updatedStopTimes,
      );
      await queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchTripsTimeBounds"] });
      await queryClient.invalidateQueries({ queryKey: ["editedTripMap"] });
      await queryClient.invalidateQueries({ queryKey: ["fetchCompareStopTimes"] });
      await queryClient.invalidateQueries({ queryKey: ["EditStopTimesTable"] });
      await queryClient.invalidateQueries({ queryKey: ["editsOverview"] });
      await queryClient.invalidateQueries({ queryKey: ["tripRerouteRoutes", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["tripRerouteBoundaryPairs", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["tripReroutePreview", tripId] });
      setRouteId(undefined);
      setFromStation(undefined);
      setToStation(undefined);
      onOpenChange(false);
    },
  });

  const reset = () => {
    setRouteId(undefined);
    setFromStation(undefined);
    setToStation(undefined);
    saveMutation.reset();
  };

  const close = () => {
    if (saveMutation.isPending) return;
    reset();
    onOpenChange(false);
  };

  const routeOptions = (routesQuery.data ?? []).map((route) => ({
    value: route.route_id,
    label: `${route.route_name} · ${route.route_type_name || "Transit"}`,
    searchLabel: `${route.route_id} ${route.route_name} ${route.route_type_name || ""}`,
    color: route.route_color_hex,
  }));
  const routeLabel =
    selectedRoute?.route_short_name || selectedRoute?.route_name || routeId || "route";
  const activePreview = previewQuery.data;
  const error =
    routesQuery.error || boundaryPairsQuery.error || previewQuery.error || saveMutation.error;
  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : "Unable to prepare this reroute."
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close();
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-5xl overflow-y-auto"
        hideCloseButton={saveMutation.isPending}
        onPointerDownOutside={(event) => {
          if (saveMutation.isPending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (saveMutation.isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BiTransferAlt className="h-5 w-5" />
            Reroute trip
          </DialogTitle>
          <DialogDescription>
            Use another trip as a read-only stop pattern to reroute {tripId}. Only the selected trip
            will be edited, and its boundary times will set the replacement stop times.
          </DialogDescription>
        </DialogHeader>

        <FormActions
          isBusy={saveMutation.isPending}
          isValid={Boolean(previewQuery.data?.hasChanges)}
          hasChanges={Boolean(previewQuery.data?.hasChanges)}
          onSave={() => {
            if (previewQuery.data) saveMutation.mutate(previewQuery.data);
          }}
          onCancel={close}
          saveLabel="Reroute"
          busyLabel="Applying reroute..."
          error={errorMessage}
        >
          <fieldset className="min-w-0 space-y-4" disabled={saveMutation.isPending}>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Source route (read-only)</label>
            {routesQuery.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Combobox
                options={routeOptions}
                Message="Choose a route with a different stop section"
                value={routeId}
                disabled={saveMutation.isPending}
                setValue={(value) => {
                  setRouteId(value);
                  setFromStation(undefined);
                  setToStation(undefined);
                }}
              />
            )}
            {selectedRoute ? (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{selectedRoute.route_type_name || "Transit"}</Badge>
                <span>{selectedRoute.shared_station_count} shared boundary stations</span>
              </div>
            ) : null}
            {!routesQuery.isLoading && routeOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other route has a different stop section between shared stations.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">From station</label>
              {boundaryPairsQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Combobox
                  options={fromOptions}
                  Message={routeId ? "Choose the start boundary" : "Choose a route first"}
                  value={fromStation}
                  disabled={saveMutation.isPending}
                  setValue={(value) => {
                    setFromStation(value);
                    setToStation(undefined);
                  }}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">To station</label>
              <Combobox
                options={toOptions}
                Message={fromStation ? "Choose the end boundary" : "Choose a start station first"}
                value={toStation}
                disabled={saveMutation.isPending}
                setValue={setToStation}
              />
            </div>
          </div>
          {routeId && !boundaryPairsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">
              Only shared station pairs with a different intermediate stop sequence are shown.
            </p>
          ) : null}

          {previewQuery.isLoading ? <Skeleton className="h-44 w-full" /> : null}
          {activePreview ? (
            <ReroutePreviewDetails
              preview={activePreview}
              routeLabel={routeLabel}
              disabled={saveMutation.isPending}
            />
          ) : null}
          {activePreview && !activePreview.hasChanges ? (
            <p className="text-sm text-muted-foreground">
              This route follows the same stops between the selected stations.
            </p>
          ) : null}
          </fieldset>
        </FormActions>
      </DialogContent>
    </Dialog>
  );
}
