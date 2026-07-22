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
  stop_lat?: number;
  stop_lon?: number;
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
