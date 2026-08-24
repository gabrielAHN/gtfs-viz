import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

type ReroutePreviewView = "timetable" | "map";

const stopTime = (stop: RerouteStop) => {
  if (!stop.arrival_time && !stop.departure_time) return "";
  if (!stop.departure_time || stop.arrival_time === stop.departure_time) {
    return stop.arrival_time || stop.departure_time || "";
  }
  return `${stop.arrival_time || "—"} → ${stop.departure_time}`;
};

const stopStationKey = (stop: RerouteStop) =>
  stop.parent_station || stop.station_name || stop.stop_name || stop.stop_id;

const addedStopIndexes = (originalStops: RerouteStop[], replacementStops: RerouteStop[]) => {
  const remainingOriginalStops = new Map<string, number>();
  for (const stop of originalStops) {
    const key = stopStationKey(stop);
    remainingOriginalStops.set(key, (remainingOriginalStops.get(key) || 0) + 1);
  }
  const added = new Set<number>();
  replacementStops.forEach((stop, index) => {
    const key = stopStationKey(stop);
    const remaining = remainingOriginalStops.get(key) || 0;
    if (remaining > 0) {
      remainingOriginalStops.set(key, remaining - 1);
    } else {
      added.add(index);
    }
  });
  return added;
};

function SegmentStopList({
  stops,
  emptyText,
  addedIndexes = new Set<number>(),
}: {
  stops: RerouteStop[];
  emptyText: string;
  addedIndexes?: ReadonlySet<number>;
}) {
  if (stops.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
      {stops.map((stop, index) => {
        const isAdded = addedIndexes.has(index);
        return (
          <div
            key={`${stop.stop_id}-${stop.stop_sequence}-${index}`}
            className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${
              isAdded
                ? "border-green-500/40 bg-green-50 text-green-950 dark:bg-green-950/20 dark:text-green-100"
                : "bg-background"
            }`}
          >
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate font-medium">{stop.station_name}</div>
                {isAdded ? (
                  <Badge className="h-5 shrink-0 bg-green-600 px-1.5 text-[10px] hover:bg-green-600">
                    Added
                  </Badge>
                ) : null}
              </div>
              <div className="truncate text-xs text-muted-foreground">{stop.stop_id}</div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{stopTime(stop)}</span>
          </div>
        );
      })}
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
  const addedIndexes = addedStopIndexes(
    preview.originalSegment,
    preview.replacementSegment,
  );
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
            <div className="flex items-center gap-1.5">
              <Badge className="bg-green-600 hover:bg-green-600">
                {addedIndexes.size} added
              </Badge>
              <Badge variant="outline">{preview.replacementSegment.length} total</Badge>
            </div>
          </div>
          <SegmentStopList
            stops={preview.replacementSegment}
            emptyText="The replacement route runs directly between these stations."
            addedIndexes={addedIndexes}
          />
        </section>
      </div>
    </div>
  );
}

export function ReroutePreviewDetails({
  preview,
  routeLabel,
  view,
  onViewChange,
  disabled = false,
}: {
  preview: TripReroutePreview;
  routeLabel: string;
  view: ReroutePreviewView;
  onViewChange: (view: ReroutePreviewView) => void;
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
    <Tabs
      value={view}
      onValueChange={(value) => onViewChange(value as ReroutePreviewView)}
      className="space-y-3"
    >
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
  const [previewView, setPreviewView] = useState<ReroutePreviewView>("timetable");

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

  const selectedBoundaryPair = useMemo(
    () =>
      (boundaryPairsQuery.data ?? []).find(
        (pair) => pair.fromStation === fromStation && pair.toStation === toStation,
      ),
    [boundaryPairsQuery.data, fromStation, toStation],
  );
  const possibleBoundaryPair = useMemo(
    () =>
      selectedBoundaryPair ||
      (boundaryPairsQuery.data ?? []).find((pair) => pair.fromStation === fromStation) ||
      boundaryPairsQuery.data?.[0],
    [boundaryPairsQuery.data, fromStation, selectedBoundaryPair],
  );

  const previewQuery = useQuery({
    queryKey: [
      "tripReroutePreview",
      tripId,
      selectedRoute?.donor_trip_id,
      possibleBoundaryPair?.fromStation,
      possibleBoundaryPair?.toStation,
    ],
    queryFn: () =>
      fetchTripReroutePreview(
        conn,
        tripId,
        selectedRoute!.donor_trip_id,
        possibleBoundaryPair!.fromStation,
        possibleBoundaryPair!.toStation,
      ),
    enabled: open && !!conn && !!selectedRoute && !!possibleBoundaryPair,
    retry: false,
    staleTime: REROUTE_QUERY_STALE_TIME,
    placeholderData: keepPreviousData,
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
      setPreviewView("timetable");
      onOpenChange(false);
    },
  });

  const reset = () => {
    setRouteId(undefined);
    setFromStation(undefined);
    setToStation(undefined);
    setPreviewView("timetable");
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
  const previewRoute = routesQuery.data?.find(
    (route) => route.donor_trip_id === activePreview?.donorTripId,
  );
  const activeRouteLabel =
    previewRoute?.route_short_name || previewRoute?.route_name || routeLabel;
  const previewMatchesSelection = Boolean(
    activePreview &&
      selectedBoundaryPair &&
      activePreview.donorTripId === selectedRoute?.donor_trip_id &&
      activePreview.fromStation === fromStation &&
      activePreview.toStation === toStation,
  );
  const canApplyPreview = Boolean(
    previewMatchesSelection && activePreview?.hasChanges && !previewQuery.isFetching,
  );
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
          isValid={canApplyPreview}
          hasChanges={canApplyPreview}
          onSave={() => {
            if (canApplyPreview && activePreview) saveMutation.mutate(activePreview);
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

          {previewQuery.isLoading && !activePreview ? <Skeleton className="h-44 w-full" /> : null}
          {activePreview ? (
            <div className="relative space-y-2">
              {!selectedBoundaryPair ? (
                <p className="text-xs text-muted-foreground">
                  Possible reroute shown from {activePreview.fromStation} to{" "}
                  {activePreview.toStation}. Select both boundary stations to apply it.
                </p>
              ) : null}
              {previewQuery.isFetching ? (
                <div className="absolute right-2 top-7 z-10 flex items-center gap-2 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Updating preview...
                </div>
              ) : null}
              <ReroutePreviewDetails
                preview={activePreview}
                routeLabel={activeRouteLabel}
                view={previewView}
                onViewChange={setPreviewView}
                disabled={saveMutation.isPending}
              />
            </div>
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
