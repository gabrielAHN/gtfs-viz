// ─── Types ────────────────────────────────────────────────────────
export type TripStopTime = {
  trip_id: string;
  stop_sequence?: number;
  arrival_time?: string;
  departure_time?: string;
  stop_id?: string;
  stop_name?: string;
  station_name?: string;
  location_type_name?: string;
  parent_station?: string;
  stop_headsign?: string;
  pickup_type?: number;
  drop_off_type?: number;
  shape_dist_traveled?: number;
  stop_lat?: number;
  stop_lon?: number;
  status?: string;
  edit_status?: "new" | "edit";
  edit_type?: string;
  edit_from_stop_name?: string;
  edit_to_stop_name?: string;
};

export type TripInfo = {
  trip_id: string;
  trip_headsign?: string;
  direction_id?: number;
  first_departure_seconds?: number;
  last_arrival_seconds?: number;
};

export type EditableStop = TripStopTime & { _idx: number };

export type RouteStopOption = {
  stop_id: string;
  stop_name: string;
  stop_lat?: number;
  stop_lon?: number;
  on_route?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────
export const TRIP_COLORS = ["bg-primary", "bg-orange-500", "bg-violet-500", "bg-teal-500", "bg-rose-500"];
export const TRIP_LINE_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#14b8a6", "#f43f5e"];

const STATION_ROUTE_TYPES = new Set(["Subway, Metro", "Rail", "Tram, Streetcar, Light rail", "Monorail", "Funicular"]);
export const defaultStopView = (rt?: string): "stops" | "stations" =>
  rt && STATION_ROUTE_TYPES.has(rt) ? "stations" : "stops";

const stopValue = (value: unknown) => String(value ?? "");

const hasStopTimeChanges = (current: TripStopTime, original: TripStopTime) =>
  stopValue(current.arrival_time) !== stopValue(original.arrival_time) ||
  stopValue(current.departure_time) !== stopValue(original.departure_time) ||
  stopValue(current.stop_headsign) !== stopValue(original.stop_headsign) ||
  stopValue(current.pickup_type) !== stopValue(original.pickup_type) ||
  stopValue(current.drop_off_type) !== stopValue(original.drop_off_type) ||
  stopValue(current.shape_dist_traveled) !== stopValue(original.shape_dist_traveled);

export const getEditableStopStatus = (
  current: TripStopTime,
  original?: TripStopTime,
): TripStopTime["edit_status"] => {
  if (!original) return "new";
  if (
    stopValue(current.stop_id) !== stopValue(original.stop_id) ||
    hasStopTimeChanges(current, original)
  ) {
    return current.edit_status === "new" ? "new" : "edit";
  }
  return current.edit_status;
};

export const markPersistedStopTimeEdits = (
  currentStops: TripStopTime[],
  originalStops: TripStopTime[],
) => {
  const lengths = Array.from({ length: originalStops.length + 1 }, () =>
    Array<number>(currentStops.length + 1).fill(0),
  );
  for (let originalIndex = 1; originalIndex <= originalStops.length; originalIndex++) {
    for (let currentIndex = 1; currentIndex <= currentStops.length; currentIndex++) {
      lengths[originalIndex][currentIndex] =
        originalStops[originalIndex - 1].stop_id === currentStops[currentIndex - 1].stop_id
          ? lengths[originalIndex - 1][currentIndex - 1] + 1
          : Math.max(
              lengths[originalIndex - 1][currentIndex],
              lengths[originalIndex][currentIndex - 1],
            );
    }
  }

  const originalIndexByCurrentIndex = new Map<number, number>();
  let originalIndex = originalStops.length;
  let currentIndex = currentStops.length;
  while (originalIndex > 0 && currentIndex > 0) {
    if (originalStops[originalIndex - 1].stop_id === currentStops[currentIndex - 1].stop_id) {
      originalIndexByCurrentIndex.set(currentIndex - 1, originalIndex - 1);
      originalIndex--;
      currentIndex--;
    } else if (lengths[originalIndex - 1][currentIndex] >= lengths[originalIndex][currentIndex - 1]) {
      originalIndex--;
    } else {
      currentIndex--;
    }
  }

  const markedStops = currentStops.map((stop, index) => {
    const matchedOriginalIndex = originalIndexByCurrentIndex.get(index);
    if (matchedOriginalIndex === undefined) return { ...stop, edit_status: "new" as const };
    if (hasStopTimeChanges(stop, originalStops[matchedOriginalIndex])) {
      return { ...stop, edit_status: "edit" as const };
    }
    return stop;
  });
  const rerouteStop = markedStops.find(
    (stop) => stop.edit_type === "reroute" && stop.edit_from_stop_name && stop.edit_to_stop_name,
  );
  if (!rerouteStop) return markedStops;
  const fromIndex = markedStops.findIndex(
    (stop) =>
      stop.station_name === rerouteStop.edit_from_stop_name ||
      stop.stop_name === rerouteStop.edit_from_stop_name,
  );
  const toIndex = markedStops.findIndex(
    (stop) =>
      stop.station_name === rerouteStop.edit_to_stop_name ||
      stop.stop_name === rerouteStop.edit_to_stop_name,
  );
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return markedStops;
  const startIndex = Math.min(fromIndex, toIndex);
  const endIndex = Math.max(fromIndex, toIndex);
  return markedStops.map((stop, index) =>
    index >= startIndex && index <= endIndex && !stop.edit_status
      ? { ...stop, edit_status: "edit" as const }
      : stop,
  );
};

// ─── Utilities ────────────────────────────────────────────────────
export const secondsValue = (value?: number | string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export const formatTripTime = (value?: number | string) => {
  const s = secondsValue(value);
  if (s === undefined) return "";
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
};

export const formatTimeRange = (v: [number, number]) =>
  `${formatTripTime(v[0])} - ${formatTripTime(v[1])}`;

// ─── Time Parsing ─────────────────────────────────────────────────
const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export const parseTime = (val: string): string | null => {
  const m = val.trim().match(TIME_RE);
  if (!m) return null;
  const h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const sec = parseInt(m[3] ?? "0");
  if (min > 59 || sec > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const timeToSec = (t?: string) => {
  if (!t) return undefined;
  const m = t.match(TIME_RE);
  if (!m) return undefined;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3] ?? "0");
};

export const secToTime = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const fmtTime = (sec: number) =>
  `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;

export const validateStopTimes = (stops: EditableStop[]): string[] => {
  const errors: string[] = [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const arr = timeToSec(s.arrival_time);
    const dep = timeToSec(s.departure_time);
    if (arr != null && dep != null && dep < arr) {
      errors.push(`Stop ${i + 1} (${s.stop_name || s.stop_id}): departure before arrival`);
    }
    if (i > 0) {
      const prevDep = timeToSec(stops[i - 1].departure_time) ?? timeToSec(stops[i - 1].arrival_time);
      const curArr = arr ?? dep;
      if (prevDep != null && curArr != null && curArr < prevDep) {
        errors.push(`Stop ${i + 1} (${s.stop_name || s.stop_id}): arrives before previous stop departs`);
      }
    }
  }
  return errors;
};

// ─── Time Options ─────────────────────────────────────────────────
export const TIME_OPTIONS = (() => {
  const opts: Array<{ value: string; label: string }> = [];
  for (let h = 0; h < 30; h++) {
    for (let m = 0; m < 60; m += 5) {
      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const label = `${h}:${String(m).padStart(2, "0")}`;
      opts.push({ value: t, label });
    }
  }
  return opts;
})();
