import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BiChevronDown, BiChevronUp, BiCrosshair, BiGitCompare, BiMapPin, BiPencil, BiPlus, BiReset, BiSave, BiTransferAlt, BiUndo, BiX } from "react-icons/bi";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TableComponent from "@/components/table";
import { useDuckDB } from "@/context/duckdb.client";
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { fetchServiceTripStopTimesData, saveStopTimesEdits, fetchEditedTripStatuses, fetchStopsWithRouteFlag } from "@/lib/duckdb/DataFetching/fetchRouteData";
import EntityForm from "@/components/forms/EntityForm";
import {
  type TripStopTime,
  type EditableStop,
  TRIP_COLORS,
  TRIP_LINE_COLORS,
  formatTripTime,
  secondsValue,
  defaultStopView,
  validateStopTimes,
  parseTime,
  timeToSec,
} from "@/lib/tripUtils";
import { Timetable, TripStopPanel } from "@/client/Trips/components/Timetable";
import { Timeline } from "@/client/Trips/components/Timeline";
import { TripMap } from "@/client/Trips/components/Map";
import { fetchTripRerouteRoutes } from "@/lib/duckdb/DataEditing/rerouteTrip";
import type { TripRow, AllTripsProps } from "./types";
import { TripsHeader } from "./Header";
import { useTripColumns } from "./TripColumns";
import { StopEditPanel } from "./StopEditPanel";
import { RerouteTripDialog } from "./RerouteTripDialog";

function AllTrips({ allTrips, tripTimeBounds, hasStopTimes, search, updateSearch }: AllTripsProps) {
  const { conn, initialized } = useDuckDB() ?? {};
  const queryClient = useQueryClient();
  const [tableSorting, setTableSorting] = useState([]);
  const [clearSortingTrigger, setClearSortingTrigger] = useState(0);
  const [tripView, setTripView] = useState<"timetable" | "timeline" | "map">(
    search.view === "timeline" || search.view === "map" ? search.view : "timetable"
  );
  const [compareTripIds, setCompareTripIdsRaw] = useState<string[]>(() => {
    if (search.compareTripIds) {
      return search.compareTripIds.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  });
  const setCompareTripIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    setCompareTripIdsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Defer router update to avoid setState-in-render warning (Transitioner)
      queueMicrotask(() => updateSearch({ compareTripIds: next.length > 0 ? next.join(",") : undefined }));
      setHiddenTripIndices(new Set());
      return next;
    });
  }, [updateSearch]);
  const [isPicking, setIsPicking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showReroute, setShowReroute] = useState(false);
  const [hiddenTripIndices, setHiddenTripIndices] = useState<Set<number>>(new Set());
  const toggleTripVisibility = useCallback((idx: number) => {
    setHiddenTripIndices((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  }, []);
  const [editStops, setEditStops] = useState<EditableStop[]>([]);
  const [editErrors, setEditErrors] = useState<string[]>([]);
  const [deletedStopIndices, setDeletedStopIndices] = useState<Set<number>>(new Set());
  const [undoStack, setUndoStack] = useState<Array<{ stops: EditableStop[]; deleted: Set<number> }>>([]);

  const [, setShowAddPanel] = useState(false);
  const [selectedEditIdx, setSelectedEditIdx] = useState<number | null>(null);
  // View-mode selection (for timeline/map popup in non-edit mode)
  const [viewSelectedIdx, setViewSelectedIdx] = useState<number | null>(null);
  const [viewSelectedTripIdx, setViewSelectedTripIdx] = useState<number>(0);
  const [addStopId, setAddStopId] = useState<string | undefined>();
  const [addArrival, setAddArrival] = useState("");
  const [addDeparture, setAddDeparture] = useState("");

  const tripId = search.tripId;
  const routeId = search.routeId;
  const routeType = search.routeType;
  const selectedTripId = search.selectedTripId;

  // Ref for TripMap zoom-to-stop function
  const zoomToStopRef = useRef<((stopIdx: number) => void) | null>(null);

  // Use refs for undo stack push so pushEdit never has stale closures
  const editStopsRef = useRef(editStops);
  editStopsRef.current = editStops;
  const deletedStopIndicesRef = useRef(deletedStopIndices);
  deletedStopIndicesRef.current = deletedStopIndices;

  // Wrap setEditStops to push to undo stack
  const pushEdit = useCallback((newStops: EditableStop[], newDeleted?: Set<number>) => {
    setUndoStack((prev) => [...prev.slice(-19), { stops: editStopsRef.current, deleted: new Set(deletedStopIndicesRef.current) }]);
    setEditStops(newStops);
    if (newDeleted !== undefined) setDeletedStopIndices(newDeleted);
    setEditErrors([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setEditStops(last.stops);
      setDeletedStopIndices(last.deleted);
      setEditErrors([]);
      setAddStopSeqManual(null);
      return prev.slice(0, -1);
    });
  }, []);

  const { data: editedTripMap = new Map<string, string>() } = useQuery({
    queryKey: ["editedTripMap"],
    queryFn: () => fetchEditedTripStatuses(conn),
    enabled: !!conn && !!initialized,
    staleTime: 1000,
  });

  // Merge edit status into trips
  const tripsWithStatus = useMemo(() =>
    allTrips.map((t) => {
      const status = editedTripMap.get(String(t.trip_id));
      return status ? { ...t, status } : t;
    }),
    [allTrips, editedTripMap],
  );

  // --- Filters (cross-filtered) ---
  const sliderBounds = useMemo<[number, number]>(() => {
    if (tripTimeBounds[0] !== tripTimeBounds[1]) return tripTimeBounds;
    return [Math.max(0, tripTimeBounds[0] - 300), tripTimeBounds[1] + 300];
  }, [tripTimeBounds]);

  const [timeRange, setTimeRange] = useState<[number, number]>(tripTimeBounds);
  const prevBoundsRef = useRef(tripTimeBounds);
  if (prevBoundsRef.current[0] !== tripTimeBounds[0] || prevBoundsRef.current[1] !== tripTimeBounds[1]) {
    prevBoundsRef.current = tripTimeBounds;
    setTimeRange(tripTimeBounds);
  }

  // For each filter dropdown, apply all OTHER filters to get available options
  const tripsForTripIdFilter = useMemo(() => {
    let filtered = tripsWithStatus;
    if (routeId) filtered = filtered.filter((t) => String(t.route_id) === routeId);
    if (routeType && routeType.length > 0) filtered = filtered.filter((t) => routeType.includes(t.route_type_name || ""));
    return filtered;
  }, [tripsWithStatus, routeId, routeType]);

  const tripsForRouteFilter = useMemo(() => {
    let filtered = tripsWithStatus;
    if (tripId) filtered = filtered.filter((t) => String(t.trip_id) === tripId);
    if (routeType && routeType.length > 0) filtered = filtered.filter((t) => routeType.includes(t.route_type_name || ""));
    return filtered;
  }, [tripsWithStatus, tripId, routeType]);

  const tripsForTypeFilter = useMemo(() => {
    let filtered = tripsWithStatus;
    if (tripId) filtered = filtered.filter((t) => String(t.trip_id) === tripId);
    if (routeId) filtered = filtered.filter((t) => String(t.route_id) === routeId);
    return filtered;
  }, [tripsWithStatus, tripId, routeId]);

  const availableTripIds = useMemo(
    () => tripsForTripIdFilter.map((t) => ({ value: String(t.trip_id), label: String(t.trip_id) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [tripsForTripIdFilter],
  );

  const availableRouteIds = useMemo(() => {
    const seen = new Set<string>();
    return tripsForRouteFilter
      .filter((t) => { if (!t.route_id || seen.has(t.route_id)) return false; seen.add(t.route_id); return true; })
      .map((t) => ({
        value: String(t.route_id),
        label: t.route_name ? `${t.route_name} (${t.route_id})` : String(t.route_id),
        searchLabel: `${t.route_id} ${t.route_name || ""}`,
        color: t.route_color_hex || getRouteTypeColor(t.route_type_name),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tripsForRouteFilter]);

  const availableRouteTypes = useMemo(() => {
    const types = new Set<string>();
    for (const t of tripsForTypeFilter) { if (t.route_type_name) types.add(t.route_type_name); }
    return Array.from(types).sort().map((type) => ({ label: type, value: type, color: getRouteTypeColor(type) }));
  }, [tripsForTypeFilter]);

  const filteredTrips = useMemo(() => {
    let filtered = tripsWithStatus;
    if (tripId) filtered = filtered.filter((t) => String(t.trip_id) === tripId);
    if (routeId) filtered = filtered.filter((t) => String(t.route_id) === routeId);
    if (routeType && routeType.length > 0)
      filtered = filtered.filter((t) => routeType.includes(t.route_type_name || ""));
    filtered = filtered.filter((t) => {
      const start = secondsValue(t.first_departure_seconds);
      const end = secondsValue(t.last_arrival_seconds) ?? start;
      if (start === undefined && end === undefined) return true;
      return (start ?? end ?? 0) <= timeRange[1] && (end ?? start ?? 0) >= timeRange[0];
    });
    return filtered;
  }, [tripsWithStatus, tripId, routeId, routeType, timeRange]);

  const tripById = useMemo(() => {
    const m = new Map<string, TripRow>();
    for (const t of tripsWithStatus) m.set(String(t.trip_id), t);
    return m;
  }, [tripsWithStatus]);

  const selectedTrip = selectedTripId ? tripById.get(selectedTripId) : undefined;
  const stopView = defaultStopView(selectedTrip?.route_type_name);

  const { data: stopTimes = [], isLoading: stopTimesLoading, error: stopTimesError } = useQuery({
    queryKey: ["fetchServiceTripStopTimesData", selectedTripId],
    queryFn: async () => fetchServiceTripStopTimesData(conn, selectedTripId!),
    enabled: !!conn && !!selectedTripId && !!initialized,
    retry: false,
  });

  const {
    data: rerouteRoutes = [],
    isLoading: rerouteRoutesLoading,
    error: rerouteRoutesError,
  } = useQuery({
    queryKey: ["tripRerouteRoutes", selectedTripId],
    queryFn: () => fetchTripRerouteRoutes(conn, selectedTripId!),
    enabled:
      !!conn &&
      !!initialized &&
      !!selectedTripId &&
      hasStopTimes &&
      stopTimes.length > 1,
    staleTime: 30_000,
  });

  const compareTrips = useMemo(
    () => compareTripIds.flatMap((id) => { const t = tripById.get(id); return t ? [t] : []; }),
    [compareTripIds, tripById],
  );

  const { data: compareStopTimesMap = {}, isLoading: compareLoading } = useQuery({
    queryKey: ["fetchCompareStopTimes", "allTrips", compareTripIds],
    queryFn: async () => {
      const entries = await Promise.all(
        compareTripIds.map(async (id) => [id, await fetchServiceTripStopTimesData(conn, id)] as const),
      );
      return Object.fromEntries(entries) as Record<string, TripStopTime[]>;
    },
    enabled: !!conn && compareTripIds.length > 0 && !!initialized,
    retry: false,
  });

  // Route stops for replacement dropdown
  const selectedRouteId = selectedTrip?.route_id;
  const { data: routeStops = [] } = useQuery({
    queryKey: ["allStopsWithRouteFlag", selectedRouteId],
    queryFn: () => fetchStopsWithRouteFlag(conn, selectedRouteId!),
    enabled: !!conn && !!selectedRouteId && isEditing && !!initialized,
    staleTime: Infinity,
  });

  // Stop form state
  const [showStopForm, setShowStopForm] = useState(false);

  const maxCompareSlots = Math.min(5, Math.max(0, filteredTrips.length - 1));
  const allSelectedIds = new Set([selectedTripId, ...compareTripIds].filter(Boolean));

  const hasActiveFilters = Boolean(
    tripId || routeId || (routeType && routeType.length > 0) ||
    timeRange[0] !== tripTimeBounds[0] || timeRange[1] !== tripTimeBounds[1],
  );

  const clearFilters = () => {
    if (isPicking) {
      updateSearch({ tripId: undefined, routeId: undefined, routeType: undefined });
      setTimeRange(tripTimeBounds);
      setClearSortingTrigger((p) => p + 1);
    } else {
      updateSearch({ tripId: undefined, routeId: undefined, routeType: undefined, selectedTripId: undefined });
      setTimeRange(tripTimeBounds);
      setClearSortingTrigger((p) => p + 1);
      setCompareTripIds([]);
      setIsPicking(false);
      setIsEditing(false);
    }
  };

  const handleTripSelect = (trip?: TripRow) => {
    updateSearch({ selectedTripId: trip?.trip_id || undefined });
    if (trip) setTripView("timetable");
    setCompareTripIds([]);
    setIsPicking(false);
    setIsEditing(false);
    setShowReroute(false);
    setViewSelectedIdx(null);
  };

  const startEditing = () => {
    setEditStops(stopTimes.map((s, i) => ({ ...s, _idx: i })));
    setEditErrors([]);
    setIsEditing(true);
    setShowAddPanel(true);
    setCompareTripIds([]);
    setIsPicking(false);
    setDeletedStopIndices(new Set());
    setUndoStack([]);
    setAddStopId(undefined); setAddArrival(""); setAddDeparture("");
    // When no stops exist, pre-activate the add panel at position 1
    setAddStopSeqManual(stopTimes.length === 0 ? 1 : null);
  };

  const cancelEditing = () => { setIsEditing(false); setEditErrors([]); setDeletedStopIndices(new Set()); setUndoStack([]); setShowAddPanel(false); setSelectedEditIdx(null); setAddStopId(undefined); setAddArrival(""); setAddDeparture(""); setAddStopSeqManual(null); };

  const handleDeleteStop = useCallback((stopIdx: number) => {
    setUndoStack((prev) => [...prev.slice(-19), { stops: editStops, deleted: new Set(deletedStopIndices) }]);
    setDeletedStopIndices((prev) => new Set(prev).add(stopIdx));
  }, [editStops, deletedStopIndices]);

  const handleRestoreStop = useCallback((stopIdx: number) => {
    setDeletedStopIndices((prev) => { const next = new Set(prev); next.delete(stopIdx); return next; });
  }, []);

  const handleReplaceStop = useCallback((stopIdx: number, newStop: { stop_id: string; stop_name: string; stop_lat?: number; stop_lon?: number }) => {
    setEditStops((prev) => prev.map((s, i) => (i === stopIdx ? {
      ...s,
      stop_id: newStop.stop_id,
      stop_name: newStop.stop_name,
      stop_lat: newStop.stop_lat ?? s.stop_lat,
      stop_lon: newStop.stop_lon ?? s.stop_lon,
    } : s)));
  }, []);

  // Replace stop via selector in the unified edit form
  const handleEditStopReplace = useCallback((newStopId: string) => {
    if (selectedEditIdx == null) return;
    const rs = routeStops.find((r: any) => r.stop_id === newStopId);
    if (!rs) return;
    pushEdit(editStopsRef.current.map((s, i) =>
      i === selectedEditIdx ? {
        ...s,
        stop_id: rs.stop_id,
        stop_name: rs.stop_name,
        stop_lat: Number(rs.stop_lat) || s.stop_lat,
        stop_lon: Number(rs.stop_lon) || s.stop_lon,
      } : s
    ));
  }, [selectedEditIdx, routeStops, pushEdit]);

  // Unified handler for selecting a stop in edit mode (populates form state)
  const handleSelectEditStop = useCallback((idx: number | null) => {
    setSelectedEditIdx(idx);
    if (idx != null) {
      const stop = editStopsRef.current[idx];
      setAddStopId(stop?.stop_id);
      setAddArrival(stop?.arrival_time || "");
      setAddDeparture(stop?.departure_time || "");
      setAddStopSeqManual(null);
    } else {
      setAddStopId(undefined);
      setAddArrival("");
      setAddDeparture("");
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Filter out deleted stops before saving
      const activeStops = editStops.filter((_, i) => !deletedStopIndices.has(i));
      const errors = validateStopTimes(activeStops);
      if (errors.length > 0) { setEditErrors(errors); throw new Error("Validation failed"); }
      await saveStopTimesEdits(conn, selectedTripId!, activeStops.map((s, i) => ({
        stop_sequence: i + 1, stop_id: s.stop_id, arrival_time: s.arrival_time,
        departure_time: s.departure_time, stop_headsign: s.stop_headsign,
        pickup_type: s.pickup_type, drop_off_type: s.drop_off_type,
      })));
      return fetchServiceTripStopTimesData(conn, selectedTripId!);
    },
    onSuccess: (updatedStopTimes) => {
      setIsEditing(false);
      setEditErrors([]);
      queryClient.setQueryData(
        ["fetchServiceTripStopTimesData", selectedTripId],
        updatedStopTimes,
      );
      queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchTripsTimeBounds"] });
      queryClient.invalidateQueries({ queryKey: ["editedTripMap"] });
      queryClient.invalidateQueries({ queryKey: ["fetchCompareStopTimes"] });
      queryClient.invalidateQueries({ queryKey: ["EditStopTimesTable"] });
      queryClient.invalidateQueries({ queryKey: ["editsOverview"] });
    },
  });

  const handleEditStopUpdate = (stops: EditableStop[]) => { pushEdit(stops); };
  const handleTimelineStopUpdate = (_ti: number, si: number, field: "arrival_time" | "departure_time", value: string) => {
    setEditStops((prev) => prev.map((s, i) => (i === si ? { ...s, [field]: value } : s)));
  };

  const selectedAddStop = addStopId ? routeStops.find((rs: any) => rs.stop_id === addStopId) : undefined;

  // Manual sequence override (set by clicking between rows in timetable)
  const [addStopSeqManual, setAddStopSeqManual] = useState<number | null>(null);

  // Time-based sequence (fallback when no manual override)
  const addStopSeqFromTime = useMemo(() => {
    const targetSec = timeToSec(addArrival) ?? timeToSec(addDeparture);
    if (targetSec == null) return editStops.length + 1;
    for (let i = 0; i < editStops.length; i++) {
      const sSec = timeToSec(editStops[i].arrival_time) ?? timeToSec(editStops[i].departure_time);
      if (sSec != null && sSec > targetSec) return i + 1;
    }
    return editStops.length + 1;
  }, [editStops, addArrival, addDeparture]);

  const addStopSequence = addStopSeqManual ?? addStopSeqFromTime;

  const handleAddStopConfirm = () => {
    if (!selectedAddStop) return;
    const arr = addArrival ? (parseTime(addArrival) || addArrival) : "";
    const dep = addDeparture ? (parseTime(addDeparture) || addDeparture) : arr;
    // Give new stop a unique _idx that won't collide with originals
    const maxIdx = editStops.reduce((max, s) => Math.max(max, s._idx ?? 0), 0);
    const newStop = {
      _idx: maxIdx + 1, trip_id: "", stop_sequence: 0,
      stop_id: selectedAddStop.stop_id, stop_name: selectedAddStop.stop_name,
      stop_lat: Number(selectedAddStop.stop_lat) || undefined,
      stop_lon: Number(selectedAddStop.stop_lon) || undefined,
      arrival_time: arr, departure_time: dep,
    } as EditableStop;
    const insertIdx = addStopSequence - 1;
    const newStops = [...editStops];
    newStops.splice(insertIdx, 0, newStop);
    pushEdit(newStops.map((s, i) => ({ ...s, stop_sequence: i + 1 })));
    setAddStopId(undefined); setAddArrival(""); setAddDeparture(""); setAddStopSeqManual(null);
  };

  const addStopOptions = useMemo(() => {
    const onRoute: any[] = []; const offRoute: any[] = [];
    for (const rs of routeStops) {
      const opt = { value: rs.stop_id, label: `${rs.stop_name || rs.stop_id} (${rs.stop_id})`, searchLabel: `${rs.stop_id} ${rs.stop_name || ""}`, color: (rs as any).on_route ? "#3b82f6" : "#9ca3af" };
      if ((rs as any).on_route) onRoute.push(opt); else offRoute.push(opt);
    }
    return [...onRoute, ...offRoute];
  }, [routeStops]);

  const startPicking = () => {
    setIsPicking(true);
    // Pre-filter to the selected trip's route
    if (selectedTrip?.route_id) {
      updateSearch({ routeId: selectedTrip.route_id });
    }
  };
  const cancelPicking = () => {
    setIsPicking(false);
    updateSearch({ tripId: undefined, routeId: undefined, routeType: undefined });
    setTimeRange(tripTimeBounds);
  };

  const columns = useTripColumns(hasStopTimes);

  const scrollToStop = (idx: number | null, isPreview?: boolean) => {
    if (tripView === "map") {
      if (idx != null && zoomToStopRef.current) {
        zoomToStopRef.current(idx);
      } else if (isPreview && selectedAddStop) {
        const lat = Number(selectedAddStop.stop_lat);
        const lon = Number(selectedAddStop.stop_lon);
        if (Number.isFinite(lat) && Number.isFinite(lon) && zoomToStopRef.current) {
          zoomToStopRef.current(lon, lat);
        }
      }
      return;
    }
    const selector = isPreview ? `[data-stop-preview="true"]` : idx != null ? `[data-stop-idx="${idx}"]` : null;
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    const svgParent = el.closest("svg");
    if (svgParent) {
      const scrollContainer = svgParent.parentElement;
      if (scrollContainer && scrollContainer.scrollWidth > scrollContainer.clientWidth) {
        const elRect = (el as SVGElement).getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetScroll = scrollContainer.scrollLeft + (elRect.left - containerRect.left) - (containerRect.width / 2) + (elRect.width / 2);
        scrollContainer.scrollTo({ left: targetScroll, behavior: "smooth" });
      }
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  };

  const handleReorderStop = (fromIdx: number, toPos: number) => {
    // toPos is 1-based target position
    const stops = editStopsRef.current;
    const toIdx = Math.max(0, Math.min(stops.length - 1, toPos - 1));
    if (fromIdx === toIdx) return;
    const next = [...stops];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    // Keep _idx stable (original identity) — only update stop_sequence
    pushEdit(next.map((s, i) => ({ ...s, stop_sequence: i + 1 })));
    // Sync selection + form state to the moved stop at its new position
    const movedStop = next[toIdx];
    setSelectedEditIdx(toIdx);
    setAddStopId(movedStop?.stop_id);
    setAddArrival(movedStop?.arrival_time || "");
    setAddDeparture(movedStop?.departure_time || "");
  };

  const renderStopPanel = (compact?: boolean) => (
    <StopEditPanel
      compact={compact} isEditing={isEditing} editStops={editStops}
      selectedEditIdx={selectedEditIdx} noStops={editStops.length === 0} addStopId={addStopId}
      addArrival={addArrival} addDeparture={addDeparture}
      addStopSequence={addStopSequence} addStopSeqManual={addStopSeqManual}
      addStopOptions={addStopOptions} selectedAddStop={selectedAddStop}
      onPushEdit={pushEdit} onSetSelectedEditIdx={setSelectedEditIdx}
      onSetAddStopId={setAddStopId} onSetAddArrival={setAddArrival}
      onSetAddDeparture={setAddDeparture} onSetAddStopSeqManual={setAddStopSeqManual}
      onHandleReorderStop={handleReorderStop} onHandleAddStopConfirm={handleAddStopConfirm}
      onScrollToStop={scrollToStop} editStopsRef={editStopsRef}
      onEditStopReplace={handleEditStopReplace}
    />
  );

  const renderTripLegend = (tripsList: TripRow[], colorOffset = 0) => {
    if (tripsList.length < 2) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {tripsList.map((t, idx) => {
          const ci = idx + colorOffset;
          const isHidden = hiddenTripIndices.has(ci);
          return (
            <span key={t.trip_id}
              className="flex items-center gap-1.5 cursor-pointer select-none hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors"
              onClick={() => toggleTripVisibility(ci)}>
              <span className="rounded-full shrink-0 border" style={{
                width: 8, height: 8,
                backgroundColor: isHidden ? "transparent" : TRIP_LINE_COLORS[ci % TRIP_LINE_COLORS.length],
                borderColor: TRIP_LINE_COLORS[ci % TRIP_LINE_COLORS.length],
              }} />
              <span className={`truncate max-w-[120px] font-medium ${isHidden ? "line-through opacity-50" : ""}`}>
                {t.trip_headsign || t.trip_id}
              </span>
              {t.route_name && <span className={`text-muted-foreground truncate max-w-[80px] ${isHidden ? "opacity-50" : ""}`}>{t.route_name}</span>}
              {t.service_id && <span className={`text-muted-foreground/60 truncate max-w-[60px] ${isHidden ? "opacity-50" : ""}`}>{t.service_id}</span>}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters (when no trip selected and not picking) */}
      {!selectedTrip && !isEditing && !isPicking && (
        <TripsHeader
          hasStopTimes={hasStopTimes} tripId={tripId} routeId={routeId} routeType={routeType}
          availableTripIds={availableTripIds} availableRouteIds={availableRouteIds} availableRouteTypes={availableRouteTypes}
          timeRange={timeRange} sliderBounds={sliderBounds} tripsCount={tripsWithStatus.length}
          hasActiveFilters={hasActiveFilters} tableSortingCount={tableSorting.length}
          updateSearch={updateSearch} setTimeRange={setTimeRange} clearFilters={clearFilters}
          extraButtons={hasStopTimes && compareTrips.length === 0 ? (
            <Button variant="outline" onClick={startPicking} className="w-full md:w-auto flex items-center justify-center">
              <BiGitCompare className="mr-2 h-5 w-5" />Compare Trips
            </Button>
          ) : undefined}
        />
      )}

      {/* Validation errors */}
      {editErrors.length > 0 && (() => {
        // Parse stop index from error strings like "Stop 3 (name): ..."
        const parseStopIdx = (err: string) => {
          const m = err.match(/^Stop (\d+)/);
          return m ? parseInt(m[1]) - 1 : null;
        };
        const [errorsExpanded, setErrorsExpanded] = [editErrors.length <= 3, null]; // auto-expand if few
        return (
          <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
            <button className="flex items-center gap-2 w-full text-left font-medium"
              onClick={() => setEditErrors((prev) => prev.length > 0 ? prev : prev)}>
              {editErrors.length <= 3
                ? <BiChevronUp className="h-4 w-4 shrink-0" />
                : <BiChevronDown className="h-4 w-4 shrink-0" />}
              <span>{editErrors.length} validation error{editErrors.length !== 1 ? "s" : ""}</span>
            </button>
            <details open={editErrors.length <= 3} className="mt-1">
              <summary className="sr-only">Show errors</summary>
              <div className="space-y-1 pt-1">
                {editErrors.map((err, i) => {
                  const stopIdx = parseStopIdx(err);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-1">{err}</span>
                      {stopIdx != null && (
                        <button
                          className="shrink-0 text-xs px-2 py-0.5 rounded border border-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          onClick={() => {
                            handleSelectEditStop(stopIdx);
                            setTripView("timetable");
                            setTimeout(() => {
                              const el = document.querySelector(`[data-stop-idx="${stopIdx}"]`);
                              el?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 100);
                          }}>
                          Go to stop #{stopIdx + 1}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        );
      })()}

      {/* Selected trip bar */}
      {selectedTrip && !isEditing && (
        <div
          className="flex min-w-0 items-center gap-3 rounded-md border bg-primary/5 px-4 py-3 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => handleTripSelect(undefined)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleTripSelect(undefined); }}>
          <BiX className="h-5 w-5 shrink-0 text-muted-foreground" />
          <EditIndicator status={selectedTrip.status} className="h-5 w-5" />
          <span className="h-3 w-6 rounded-sm border shrink-0"
            style={{ backgroundColor: selectedTrip.route_color_hex || getRouteTypeColor(selectedTrip.route_type_name) }} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
            <span className="font-semibold truncate">{selectedTrip.trip_id}</span>
            {selectedTrip.route_name && <span className="text-sm text-muted-foreground truncate">{selectedTrip.route_name}</span>}
            {hasStopTimes && (
              <span className="text-sm">{formatTripTime(selectedTrip.first_departure_seconds) || "?"} {"\u2192"} {formatTripTime(selectedTrip.last_arrival_seconds) || "?"}</span>
            )}
          </div>
        </div>
      )}

      {/* Edit mode header + toolbar */}
      {selectedTrip && isEditing && (
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-primary/50 bg-primary/5 px-4 py-2.5">
          <BiPencil className="h-4 w-4 shrink-0 text-primary" />
          <span className="h-3 w-6 rounded-sm border shrink-0"
            style={{ backgroundColor: selectedTrip.route_color_hex || getRouteTypeColor(selectedTrip.route_type_name) }} />
          <span className="font-semibold truncate">{selectedTrip.trip_id}</span>
          <span className="text-xs text-primary font-medium">Editing</span>
          {(() => {
            let changed = 0;
            for (let i = 0; i < editStops.length; i++) {
              const orig = stopTimes[i];
              if (!orig || editStops[i].stop_id !== orig.stop_id || editStops[i].arrival_time !== orig.arrival_time || editStops[i].departure_time !== orig.departure_time) changed++;
            }
            changed += deletedStopIndices.size;
            if (editStops.length !== stopTimes.length) changed = Math.max(changed, Math.abs(editStops.length - stopTimes.length));
            return changed > 0 ? (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                {changed} change{changed !== 1 ? "s" : ""}
              </span>
            ) : null;
          })()}
          {(() => {
            const noChanges = JSON.stringify(editStops) === JSON.stringify(stopTimes.map((s, i) => ({ ...s, _idx: i }))) && deletedStopIndices.size === 0;
            const noStops = editStops.length === 0 && stopTimes.length === 0;
            return (
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" onClick={handleUndo} disabled={undoStack.length === 0 || saveMutation.isPending} size="sm" className="flex items-center h-7 text-xs px-2">
                  <BiUndo className="mr-1 h-3 w-3" />Undo
                </Button>
                <Button variant="ghost" size="sm" disabled={noChanges || saveMutation.isPending}
                  onClick={() => { setEditStops(stopTimes.map((s, i) => ({ ...s, _idx: i }))); setDeletedStopIndices(new Set()); setEditErrors([]); setUndoStack([]); setAddStopId(undefined); setAddArrival(""); setAddDeparture(""); setAddStopSeqManual(null); }}
                  className="flex items-center h-7 text-xs px-2">
                  <BiReset className="mr-1 h-3 w-3" />Reset
                </Button>
                <span className="mx-0.5 h-4 border-l" />
                <Button variant="default" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || noChanges || noStops} size="sm" className="flex items-center h-7 text-xs px-3">
                  <BiSave className="mr-1 h-3 w-3" />{saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={saveMutation.isPending} size="sm" className="h-7 text-xs px-3">Cancel</Button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Non-edit action buttons */}
      {selectedTrip && !isEditing && !isPicking && (
        <div className="flex gap-2">
          {hasStopTimes && compareTrips.length === 0 && stopTimes.length > 0 && (
            <Button variant="outline" onClick={startEditing} size="sm" className="flex items-center">
              <BiPencil className="mr-1 h-4 w-4" />Edit
            </Button>
          )}
          {hasStopTimes && compareTrips.length === 0 && (
            <Button
              variant="outline"
              onClick={() => setShowReroute(true)}
              size="sm"
              className="flex items-center"
              disabled={
                stopTimesLoading ||
                stopTimes.length < 2 ||
                !!rerouteRoutesError ||
                (!rerouteRoutesLoading && rerouteRoutes.length === 0)
              }
              title={
                stopTimesLoading
                  ? "Checking trip stations"
                  : stopTimes.length < 2
                    ? "At least two stations are required to reroute this trip"
                    : rerouteRoutesLoading
                      ? "Checking shared reroute stations"
                      : rerouteRoutesError
                        ? rerouteRoutesError instanceof Error
                          ? rerouteRoutesError.message
                          : "Unable to check shared reroute stations"
                      : rerouteRoutes.length === 0
                        ? "No other route has a different stop section between shared stations at any schedule time"
                        : undefined
              }
            >
              <BiTransferAlt className="mr-1 h-4 w-4" />Reroute
            </Button>
          )}
          {hasStopTimes && compareTrips.length === 0 && stopTimes.length > 0 && (
            <Button variant="outline" onClick={startPicking} size="sm" className="flex items-center">
              <BiGitCompare className="mr-1 h-4 w-4" />Compare
            </Button>
          )}
        </div>
      )}
      {selectedTrip && selectedTripId ? (
        <RerouteTripDialog
          key={selectedTripId}
          open={showReroute}
          tripId={selectedTripId}
          onOpenChange={setShowReroute}
        />
      ) : null}
      {/* Compare trips chips */}
      {compareTrips.length > 0 && !isPicking && !isEditing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={startPicking} size="sm" disabled={compareTrips.length >= maxCompareSlots}
              className="flex items-center h-7 text-xs shrink-0">
              <BiPlus className="mr-1 h-3 w-3" />Add
            </Button>
            <Button variant="ghost" onClick={() => setCompareTripIds([])} size="sm"
              className="flex items-center h-7 text-xs shrink-0">
              <BiX className="mr-1 h-3 w-3" />Clear
            </Button>
            <Button variant="outline" onClick={() => { setCompareTripIds([]); if (selectedTrip) updateSearch({ selectedTripId: undefined }); }} size="sm"
              className="flex items-center h-7 text-xs shrink-0 ml-auto">
              <BiReset className="mr-1 h-3 w-3" />Reset
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {compareTrips.map((ct, idx) => {
              const colorIdx = selectedTrip ? idx + 1 : idx;
              return (
                <div key={ct.trip_id}
                  className="flex items-center gap-1.5 rounded-md border bg-primary/5 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => setCompareTripIds((prev) => prev.filter((id) => id !== ct.trip_id))}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setCompareTripIds((prev) => prev.filter((id) => id !== ct.trip_id)); }}>
                  <BiX className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: TRIP_LINE_COLORS[colorIdx % TRIP_LINE_COLORS.length] }} />
                  <span className="font-medium truncate">{ct.trip_id}</span>
                  {ct.route_name && <span className="text-muted-foreground truncate max-w-[100px]">{ct.route_name}</span>}
                  {ct.service_id && <span className="text-muted-foreground/60 truncate max-w-[80px]">{ct.service_id}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters (when picking compare trip) */}
      {isPicking && (
        <TripsHeader
          hasStopTimes={hasStopTimes} tripId={tripId} routeId={routeId} routeType={routeType}
          availableTripIds={availableTripIds} availableRouteIds={availableRouteIds} availableRouteTypes={availableRouteTypes}
          timeRange={timeRange} sliderBounds={sliderBounds} tripsCount={tripsWithStatus.length}
          hasActiveFilters={hasActiveFilters} tableSortingCount={tableSorting.length}
          updateSearch={updateSearch} setTimeRange={setTimeRange} clearFilters={clearFilters}
          extraButtons={
            <Button variant="outline" onClick={cancelPicking} size="default" className="w-full md:w-auto flex items-center justify-center bg-primary/10 border-primary/50">
              <BiX className="mr-2 h-5 w-5" />Cancel
            </Button>
          }
        />
      )}

      {/* Table */}
      {((!selectedTrip && compareTrips.length === 0) || isPicking) && (
        <TableComponent
          key={isPicking ? "pick" : "select"}
          data={isPicking ? filteredTrips.filter((t) => !allSelectedIds.has(String(t.trip_id))) : filteredTrips}
          columns={columns} ClickInfo={undefined}
          setClickInfo={(trip: TripRow | undefined) => {
            if (!trip) return;
            if (isPicking) { setCompareTripIds((prev) => [...prev, String(trip.trip_id)]); setIsPicking(false); }
            else handleTripSelect(trip);
          }}
          selectionKey="trip_id" hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters}
          onSortingChange={setTableSorting} clearSortingTrigger={clearSortingTrigger}>
          <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
            {isPicking ? "Select a trip to compare with" : hasStopTimes ? "Select a trip row to view its stops" : "Select a trip row to view details"}
          </div>
        </TableComponent>
      )}

      {/* Saving overlay — blocks all interaction while save is processing */}
      {saveMutation.isPending && (
        <div className="relative rounded-md border bg-background/80 backdrop-blur-[2px] p-8">
          <div className="flex items-center justify-center gap-3 text-sm font-medium">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Saving changes...
          </div>
        </div>
      )}

      {/* Trip detail views */}
      {selectedTrip && !isPicking && !hasStopTimes && !saveMutation.isPending && (
        <div className="text-sm text-yellow-800 dark:text-yellow-200 p-3 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20">
          stop_times.txt not imported — stop times, editing, comparison, and timeline views are disabled
        </div>
      )}

      {selectedTrip && !isPicking && hasStopTimes && !saveMutation.isPending && (
        <div className="space-y-3">
          {!isEditing && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border p-3 text-sm">
              <div><span className="text-xs text-muted-foreground">Time</span>
                <div className={`font-medium ${!selectedTrip.first_departure_seconds && !selectedTrip.last_arrival_seconds ? "text-muted-foreground/50" : ""}`}>
                  {formatTripTime(selectedTrip.first_departure_seconds) || "\u2014"} {"\u2192"} {formatTripTime(selectedTrip.last_arrival_seconds) || "\u2014"}
                </div></div>
              <div><span className="text-xs text-muted-foreground">Headsign</span>
                <div className={`font-medium ${!selectedTrip.trip_headsign ? "text-muted-foreground/50" : ""}`}>{selectedTrip.trip_headsign || "\u2014"}</div></div>
              {selectedTrip.route_name && (
                <div><span className="text-xs text-muted-foreground">Route</span>
                  <div className="font-medium">
                    <Link to="/routes/info" search={{ selectedRouteId: selectedTrip.route_id }}
                      className="inline-flex items-center rounded px-1.5 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors">{selectedTrip.route_name}</Link>
                  </div>
                </div>
              )}
              {selectedTrip.service_id && (
                <div><span className="text-xs text-muted-foreground">Service</span>
                  <div className="font-medium">
                    <Link to="/routes/service" search={{ selectedRouteId: selectedTrip.route_id, selectedServiceId: selectedTrip.service_id }}
                      className="inline-flex items-center rounded px-1.5 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors">{selectedTrip.service_id}</Link>
                  </div>
                </div>
              )}
              <div><span className="text-xs text-muted-foreground">{stopView === "stations" ? "Stations" : "Stops"}</span>
                <div className={`font-medium ${stopTimes.length === 0 ? "text-muted-foreground/50" : ""}`}>{stopTimesLoading ? "..." : stopTimes.length}</div></div>
            </div>
          )}

          {/* No stop times — show Add Stop prompt */}
          {!isEditing && !stopTimesLoading && stopTimes.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center space-y-2">
              <div className="text-sm text-muted-foreground">No stop times available</div>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <BiPlus className="mr-1 h-4 w-4" />Add Stop
              </Button>
            </div>
          )}

          {(() => {
            const stopsToCheck = isEditing ? editStops : stopTimes;
            const hasPreview = isEditing && addStopSeqManual != null;
            if (stopsToCheck.length === 0 && !hasPreview) return null;
            const addingNoStops = isEditing && editStops.length === 0 && hasPreview;
            const hasAddTime = Boolean(addArrival || addDeparture);
            const hasAddStop = Boolean(addStopId);
            const hasAnyTime = stopsToCheck.some((s) => s.arrival_time || s.departure_time);
            const timelineDisabled = addingNoStops ? !hasAddTime : (isEditing && !hasAnyTime && !hasAddTime);
            const mapDisabled = addingNoStops ? !hasAddStop : false;
            return (
              <Tabs value={tripView} onValueChange={(v) => { const view = v as typeof tripView; setTripView(view); updateSearch({ view: view === "timetable" ? undefined : view }); }}>
                <TabsList className="h-8">
                  <TabsTrigger value="timetable" className="text-xs px-3 py-1">Timetable</TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs px-3 py-1" disabled={timelineDisabled}>Timeline</TabsTrigger>
                  <TabsTrigger value="map" className="text-xs px-3 py-1" disabled={mapDisabled}>Map</TabsTrigger>
                </TabsList>
              </Tabs>
            );
          })()}

          {stopTimesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : stopTimesError ? (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">Error loading trip stop times.</div>
          ) : isEditing ? (
            tripView === "timetable" ? (<>
              {renderStopPanel()}
              {editStops.length > 0 && (
                <Timetable editable stops={editStops} onUpdate={handleEditStopUpdate}
                  originalStops={stopTimes}
                  selectedStopIdx={selectedEditIdx}
                  onSelectStop={handleSelectEditStop}
                  addStopPreview={selectedEditIdx == null && selectedAddStop
                    ? { name: selectedAddStop.stop_name || selectedAddStop.stop_id, stopId: selectedAddStop.stop_id, arrival: addArrival, departure: addDeparture, stopSequence: addStopSequence }
                    : (selectedEditIdx == null && addStopSeqManual != null)
                      ? { name: "", arrival: addArrival, departure: addDeparture, stopSequence: addStopSequence }
                      : undefined}
                  onInsertAt={(seq, arr, dep) => {
                    if (!arr && !dep) {
                      setAddStopSeqManual(null); setAddStopId(undefined); setAddArrival(""); setAddDeparture("");
                    } else if (addStopSeqManual === seq && !addStopId) {
                      setAddStopSeqManual(null); setAddArrival(""); setAddDeparture("");
                    } else {
                      setSelectedEditIdx(null); setAddStopSeqManual(seq); setAddArrival(arr); setAddDeparture(dep);
                    }
                  }} />
              )}
            </>
            ) : tripView === "timeline" ? (<>
              <Timeline editable trips={[{ trip: selectedTrip, stops: editStops }]} onUpdateStop={handleTimelineStopUpdate}
                onUpdateStopBoth={(_ti, si, arr, dep) => setEditStops((prev) => prev.map((s, i) => (i === si ? { ...s, arrival_time: arr, departure_time: dep } : s)))}
                originalStops={stopTimes}
                selectedStopIdx={selectedEditIdx}
                onSelectStop={handleSelectEditStop}
                addStopPreview={selectedEditIdx == null && selectedAddStop
                  ? { name: selectedAddStop.stop_name || selectedAddStop.stop_id, arrival: addArrival, departure: addDeparture, stopSequence: addStopSequence }
                  : (selectedEditIdx == null && addStopSeqManual != null)
                    ? { name: "", arrival: addArrival, departure: addDeparture, stopSequence: addStopSequence }
                    : undefined}
                onAddArrivalChange={setAddArrival} onAddDepartureChange={setAddDeparture}
                onInsertAt={(seq, arr, dep) => {
                  if (!arr && !dep) {
                    setAddStopSeqManual(null); setAddStopId(undefined); setAddArrival(""); setAddDeparture("");
                  } else {
                    setSelectedEditIdx(null); setAddStopSeqManual(seq); if (arr) setAddArrival(arr); if (dep) setAddDeparture(dep);
                  }
                }}
                onDragStart={() => {
                  setUndoStack((prev) => [...prev.slice(-19), { stops: editStopsRef.current, deleted: new Set(deletedStopIndicesRef.current) }]);
                }} />
              {renderStopPanel()}
            </>
            ) : (<>
              {selectedEditIdx == null && addStopSeqManual == null && !addStopId && editStops.length > 0 && (
                <Button variant="outline" size="sm" className="flex items-center"
                  onClick={() => setAddStopSeqManual(editStops.length + 1)}>
                  <BiPlus className="mr-1 h-4 w-4" />Add Stop
                </Button>
              )}
              <TripMap
                trips={[{ trip: selectedTrip, stopTimes: editStops }]}
                editable
                onDeleteStop={handleDeleteStop}
                onRestoreStop={handleRestoreStop}
                deletedStopIndices={deletedStopIndices}
                onReplaceStop={handleReplaceStop}
                routeStops={routeStops}
                originalStops={stopTimes}
                selectedStopIdx={selectedEditIdx}
                onSelectStop={handleSelectEditStop}
                addStopPreview={selectedEditIdx == null && selectedAddStop && Number.isFinite(Number(selectedAddStop.stop_lat)) && Number.isFinite(Number(selectedAddStop.stop_lon)) ? { lon: Number(selectedAddStop.stop_lon), lat: Number(selectedAddStop.stop_lat), name: selectedAddStop.stop_name || selectedAddStop.stop_id, stopSequence: addStopSequence } : undefined}
                onUpdateStopTime={(stopIdx, field, value) => {
                  pushEdit(editStops.map((s, i) => (i === stopIdx ? { ...s, [field]: value } : s)));
                }}
                editPanel={(selectedEditIdx != null || addStopSeqManual != null || addStopId || editStops.length === 0) ? renderStopPanel(true) : undefined}
                zoomToStopRef={zoomToStopRef}
              />
            </>)
          ) : (
            tripView === "map" ? (
              compareLoading && compareTrips.length > 0 ? <Skeleton className="h-[50vh] w-full" /> : (
                <TripMap trips={[
                  { trip: selectedTrip, stopTimes },
                  ...compareTrips.map((ct) => ({ trip: ct, stopTimes: compareStopTimesMap[ct.trip_id] || [] })),
                ]}
                  selectedStopIdx={viewSelectedIdx}
                  onSelectStop={setViewSelectedIdx}
                  zoomToStopRef={zoomToStopRef}
                  onClickAnyStop={(info) => { setViewSelectedIdx(info.stopIdx); setViewSelectedTripIdx(info.tripIdx); }}
                  hiddenTripIndices={hiddenTripIndices}
                  onToggleTripVisibility={toggleTripVisibility} />
              )
            ) : tripView === "timeline" ? (
              compareLoading && compareTrips.length > 0 ? <Skeleton className="h-64 w-full" /> : (<>
              {compareTrips.length > 0 && renderTripLegend([selectedTrip, ...compareTrips])}
              <div
                onClick={(e) => {
                  // Click outside a stop dot or the popup → deselect
                  const target = e.target as HTMLElement;
                  if (!target.closest("[data-stop-idx]") && !target.closest("[data-stop-popup]")) {
                    setViewSelectedIdx(null);
                  }
                }}>
                <Timeline trips={[
                  { trip: selectedTrip, stopTimes },
                  ...compareTrips.map((ct) => ({ trip: ct, stopTimes: compareStopTimesMap[ct.trip_id] || [] })),
                ]}
                  selectedStopIdx={viewSelectedIdx}
                  onSelectStop={setViewSelectedIdx}
                  selectedTripIdx={viewSelectedTripIdx}
                  onSelectStopWithTrip={(ti, idx) => { setViewSelectedTripIdx(ti); setViewSelectedIdx(idx); }}
                  hiddenTripIndices={hiddenTripIndices} />
                {viewSelectedIdx != null && (() => {
                  const allTrips = [{ trip: selectedTrip, stopTimes }, ...compareTrips.map((ct) => ({ trip: ct, stopTimes: compareStopTimesMap[ct.trip_id] || [] }))];
                  const tripData = allTrips[viewSelectedTripIdx] || allTrips[0];
                  const st = tripData?.stopTimes[viewSelectedIdx];
                  if (!st) return null;
                  // Match stops across trips by stop_id or parent_station (same as map)
                  const stopsAcrossTrips = allTrips.map((t, ti) => {
                    const match = t.stopTimes.find((s) => {
                      if (st.stop_id && s.stop_id && st.stop_id === s.stop_id) return true;
                      if ((st as any).parent_station && (s as any).parent_station && (st as any).parent_station === (s as any).parent_station) return true;
                      return false;
                    }) || (ti === viewSelectedTripIdx ? st : undefined);
                    return match ? { trip: t.trip, st: match, ti } : null;
                  }).filter(Boolean) as Array<{ trip: typeof selectedTrip; st: typeof st; ti: number }>;
                  const hasCompare = compareTrips.length > 0 && stopsAcrossTrips.length > 1;
                  // Compute time diffs relative to the selected trip
                  const toSec = (t?: string) => { if (!t) return null; const p = t.split(":").map(Number); return p.length >= 2 ? p[0] * 3600 + p[1] * 60 + (p[2] || 0) : null; };
                  const baseDep = toSec(st.departure_time) ?? toSec(st.arrival_time);
                  const baseArr = toSec(st.arrival_time) ?? toSec(st.departure_time);
                  return (
                    <div data-stop-popup className="rounded-md border bg-background p-3 text-sm space-y-2 mt-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{st.stop_name || st.stop_id}</span>
                        <button onClick={() => scrollToStop(viewSelectedIdx)} className="ml-auto text-muted-foreground hover:text-foreground shrink-0" title="Zoom to stop"><BiCrosshair className="h-4 w-4" /></button>
                        <button onClick={() => setViewSelectedIdx(null)} className="text-muted-foreground hover:text-foreground shrink-0"><BiX className="h-4 w-4" /></button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{st.stop_id}</span>
                        <span>·</span>
                        <span>#{viewSelectedIdx + 1}</span>
                        {(st as any).parent_station || st.location_type_name === "Station" ? (
                          <Link to="/stations/info" search={{ selectedStationId: (st as any).parent_station || st.stop_id }}
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors">
                            <BiMapPin className="h-3 w-3" />Station
                          </Link>
                        ) : (
                          <Link to="/stops/map" search={{ selectedStopId: st.stop_id }}
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors">
                            <BiMapPin className="h-3 w-3" />Stop
                          </Link>
                        )}
                      </div>
                      {hasCompare ? (
                        <div className="space-y-1 pt-1 border-t">
                          {stopsAcrossTrips.map(({ trip: t, st: s, ti }) => {
                            const isPrimary = ti === viewSelectedTripIdx;
                            const sArr = toSec(s.arrival_time);
                            const sDep = toSec(s.departure_time);
                            const arrDiff = sArr != null && baseArr != null ? sArr - baseArr : null;
                            const depDiff = sDep != null && baseDep != null ? sDep - baseDep : null;
                            const fmtDiff = (d: number | null) => {
                              if (d == null || d === 0) return null;
                              const m = Math.round(d / 60);
                              return m > 0 ? `+${m}m` : `${m}m`;
                            };
                            return (
                              <div key={ti} className={`flex items-center gap-2 text-xs rounded px-1.5 py-1 ${isPrimary ? "bg-primary/10 font-medium" : ""}`}>
                                <span className="rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: TRIP_LINE_COLORS[ti % TRIP_LINE_COLORS.length] }} />
                                <span className="truncate max-w-[100px]">{t.trip_headsign || t.trip_id}</span>
                                <span className="ml-auto text-muted-foreground whitespace-nowrap">
                                  {s.arrival_time || "\u2014"}
                                  {s.departure_time && s.departure_time !== s.arrival_time ? ` \u2192 ${s.departure_time}` : ""}
                                </span>
                                {!isPrimary && (arrDiff != null || depDiff != null) && (
                                  <span className={`text-[10px] font-medium ${(arrDiff ?? 0) > 0 ? "text-red-500" : (arrDiff ?? 0) < 0 ? "text-green-500" : "text-muted-foreground"}`}>
                                    {fmtDiff(arrDiff) || fmtDiff(depDiff)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        (st.arrival_time || st.departure_time) ? (
                          <div className="flex gap-4 text-xs pt-1 border-t">
                            {st.arrival_time && <span>Arr: {st.arrival_time}</span>}
                            {st.departure_time && <span>Dep: {st.departure_time}</span>}
                          </div>
                        ) : null
                      )}
                    </div>
                  );
                })()}
              </div></>)
            ) : compareTrips.length > 0 ? (
              compareLoading ? <Skeleton className="h-64 w-full" /> : (<>
                {renderTripLegend([selectedTrip, ...compareTrips])}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {!hiddenTripIndices.has(0) && <TripStopPanel trip={selectedTrip} stopTimes={stopTimes} view={stopView} />}
                  {compareTrips.map((ct, idx) => (
                    !hiddenTripIndices.has(idx + 1) && <TripStopPanel key={ct.trip_id} trip={ct} stopTimes={compareStopTimesMap[ct.trip_id] || []} view={stopView} />
                  ))}
                </div>
              </>)
            ) : stopTimes.length > 0 ? (
              <Timetable stopTimes={stopTimes} view={stopView} />
            ) : null
          )}

        </div>
      )}


      {/* Compare-only views (no selected trip) */}
      {!selectedTrip && !isPicking && compareTrips.length > 0 && hasStopTimes && (
        <div className="space-y-3">
          <Tabs value={tripView} onValueChange={(v) => { const view = v as typeof tripView; setTripView(view); updateSearch({ view: view === "timetable" ? undefined : view }); }}>
            <TabsList className="h-8">
              <TabsTrigger value="timetable" className="text-xs px-3 py-1">Timetable</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs px-3 py-1">Timeline</TabsTrigger>
              <TabsTrigger value="map" className="text-xs px-3 py-1">Map</TabsTrigger>
            </TabsList>
          </Tabs>
          {renderTripLegend(compareTrips)}
          {compareLoading ? <Skeleton className="h-64 w-full" /> : (
            tripView === "map" ? (
              <TripMap trips={compareTrips.map((ct) => ({ trip: ct, stopTimes: compareStopTimesMap[ct.trip_id] || [] }))}
                selectedStopIdx={viewSelectedIdx}
                onSelectStop={setViewSelectedIdx}
                zoomToStopRef={zoomToStopRef}
                onClickAnyStop={(info) => { setViewSelectedIdx(info.stopIdx); setViewSelectedTripIdx(info.tripIdx); }}
                hiddenTripIndices={hiddenTripIndices}
                onToggleTripVisibility={toggleTripVisibility} />
            ) : tripView === "timeline" ? (
              <div onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest("[data-stop-idx]") && !target.closest("[data-stop-popup]")) setViewSelectedIdx(null);
              }}>
                <Timeline trips={compareTrips.map((ct) => ({ trip: ct, stopTimes: compareStopTimesMap[ct.trip_id] || [] }))}
                  selectedStopIdx={viewSelectedIdx}
                  onSelectStop={setViewSelectedIdx}
                  selectedTripIdx={viewSelectedTripIdx}
                  onSelectStopWithTrip={(ti, idx) => { setViewSelectedTripIdx(ti); setViewSelectedIdx(idx); }}
                  hiddenTripIndices={hiddenTripIndices} />
                {viewSelectedIdx != null && (() => {
                  const allTripsData = compareTrips.map((ct) => ({ trip: ct, stopTimes: compareStopTimesMap[ct.trip_id] || [] }));
                  const tripData = allTripsData[viewSelectedTripIdx] || allTripsData[0];
                  const st = tripData?.stopTimes[viewSelectedIdx];
                  if (!st) return null;
                  // Match stops across trips by stop_id or parent_station (same as map)
                  const stopsAcrossTrips = allTripsData.map((t, ti) => {
                    const match = t.stopTimes.find((s) => {
                      if (st.stop_id && s.stop_id && st.stop_id === s.stop_id) return true;
                      if ((st as any).parent_station && (s as any).parent_station && (st as any).parent_station === (s as any).parent_station) return true;
                      return false;
                    }) || (ti === viewSelectedTripIdx ? st : undefined);
                    return match ? { trip: t.trip, st: match, ti } : null;
                  }).filter(Boolean) as Array<{ trip: TripRow; st: typeof st; ti: number }>;
                  const hasCompare = stopsAcrossTrips.length > 1;
                  const toSec = (t?: string) => { if (!t) return null; const p = t.split(":").map(Number); return p.length >= 2 ? p[0] * 3600 + p[1] * 60 + (p[2] || 0) : null; };
                  const baseDep = toSec(st.departure_time) ?? toSec(st.arrival_time);
                  const baseArr = toSec(st.arrival_time) ?? toSec(st.departure_time);
                  return (
                    <div data-stop-popup className="rounded-md border bg-background p-3 text-sm space-y-2 mt-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{st.stop_name || st.stop_id}</span>
                        <button onClick={() => setViewSelectedIdx(null)} className="ml-auto text-muted-foreground hover:text-foreground shrink-0"><BiX className="h-4 w-4" /></button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{st.stop_id}</span>
                        <span>·</span>
                        <span>#{viewSelectedIdx + 1}</span>
                      </div>
                      {hasCompare ? (
                        <div className="space-y-1 pt-1 border-t">
                          {stopsAcrossTrips.map(({ trip: t, st: s, ti }) => {
                            const isPrimary = ti === viewSelectedTripIdx;
                            const sArr = toSec(s.arrival_time);
                            const sDep = toSec(s.departure_time);
                            const arrDiff = sArr != null && baseArr != null ? sArr - baseArr : null;
                            const depDiff = sDep != null && baseDep != null ? sDep - baseDep : null;
                            const fmtDiff = (d: number | null) => { if (d == null || d === 0) return null; const m = Math.round(d / 60); return m > 0 ? `+${m}m` : `${m}m`; };
                            return (
                              <div key={ti} className={`flex items-center gap-2 text-xs rounded px-1.5 py-1 ${isPrimary ? "bg-primary/10 font-medium" : ""}`}>
                                <span className="rounded-full shrink-0" style={{ width: 8, height: 8, backgroundColor: TRIP_LINE_COLORS[ti % TRIP_LINE_COLORS.length] }} />
                                <span className="truncate max-w-[100px]">{t.trip_headsign || t.trip_id}</span>
                                <span className="ml-auto text-muted-foreground whitespace-nowrap">
                                  {s.arrival_time || "\u2014"}{s.departure_time && s.departure_time !== s.arrival_time ? ` \u2192 ${s.departure_time}` : ""}
                                </span>
                                {!isPrimary && (arrDiff != null || depDiff != null) && (
                                  <span className={`text-[10px] font-medium ${(arrDiff ?? 0) > 0 ? "text-red-500" : (arrDiff ?? 0) < 0 ? "text-green-500" : "text-muted-foreground"}`}>
                                    {fmtDiff(arrDiff) || fmtDiff(depDiff)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        (st.arrival_time || st.departure_time) ? (
                          <div className="flex gap-4 text-xs pt-1 border-t">
                            {st.arrival_time && <span>Arr: {st.arrival_time}</span>}
                            {st.departure_time && <span>Dep: {st.departure_time}</span>}
                          </div>
                        ) : null
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {compareTrips.map((ct, idx) => (
                  !hiddenTripIndices.has(idx) && <TripStopPanel key={ct.trip_id} trip={ct} stopTimes={compareStopTimesMap[ct.trip_id] || []} view={stopView} />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Stop creation form */}
      {showStopForm && (
        <EntityForm
          Data={editStops.filter((s) => s.stop_lat != null && s.stop_lon != null).map((s) => ({
            stop_id: s.stop_id, stop_name: s.stop_name,
            stop_lat: s.stop_lat, stop_lon: s.stop_lon,
            location_type_name: "Stop",
          }))}
          OpenValue={{ formType: "add", state: true }}
          setOpenValue={({ state }) => { if (!state) setShowStopForm(false); }}
          ClickInfo={undefined}
          setClickInfo={() => {}}
          type="stop"
        />
      )}
    </div>
  );
}

export default AllTrips;
