/**
 * Shared GTFS edit writers for the CLI.
 *
 * Ports the web app's edit logic (packages/web/src/lib/duckdb/DataFetching/fetchRouteData.tsx)
 * so CLI-applied edits are byte-for-byte compatible with UI-applied edits: same Edit*Table rows,
 * same `new` / `new edit` / `edit` / `deleted` status state-machine.
 *
 * Writers are pure DML — they do NOT refresh materialized tables. Callers refresh once after a
 * batch via {@link refreshTrips} / {@link refreshCalendar} (mirrors the web's refreshMaterializedTable,
 * packages/web/src/lib/duckdb/DataEditing/insertData.tsx:110).
 */
import { GTFS_REROUTE_SQL } from "@gtfs-viz/duckdb-extension";
import { executeRows, queryRows } from "./runner.js";

// ── SQL value helpers (mirror index.ts escapeSql/sqlString) ──────────────────
const esc = (v: string) => String(v).replace(/'/g, "''");
/** Quote a required string (always emits a quoted literal). */
const qReq = (v: string) => `'${esc(v)}'`;
/** Quote an optional string: null/undefined/"" → NULL (matches web formatSqlValue). */
const q = (v: string | null | undefined) =>
  v === null || v === undefined || v === "" ? "NULL" : `'${esc(String(v))}'`;
/** Number or NULL. */
const num = (v: number | string | null | undefined) => {
  if (v === null || v === undefined || v === "") return "NULL";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "NULL";
};
/** Weekday flag → 0/1 (defaults to 0 like the web). */
const day = (v: number | string | boolean | null | undefined) => {
  if (v === true) return "1";
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? "1" : "0";
};

const nextStatus = (prev: string | null): "edit" | "new edit" =>
  prev === "new" || prev === "new edit" ? "new edit" : "edit";

// ── Materialized-table refresh (call after a batch of edits) ─────────────────
export const refreshTrips = (dbPath: string) =>
  executeRows(dbPath, `CREATE OR REPLACE TABLE TripsTable AS SELECT * FROM get_trips_table_data()`);
export const refreshCalendar = (dbPath: string) =>
  executeRows(dbPath, `CREATE OR REPLACE TABLE CalendarTable AS SELECT * FROM get_calendar_table_data()`);

// ── Types ────────────────────────────────────────────────────────────────────
export type TripData = {
  trip_id: string;
  route_id?: string;
  service_id?: string;
  trip_headsign?: string;
  direction_id?: number;
  shape_id?: string;
};
export type StopTimeData = {
  stop_sequence: number;
  stop_id: string;
  arrival_time?: string;
  departure_time?: string;
  stop_headsign?: string;
  pickup_type?: number;
  drop_off_type?: number;
  shape_dist_traveled?: number;
};
type RerouteMetadata = {
  edit_source_trip_id: string;
  edit_from_stop_name: string;
  edit_to_stop_name: string;
};
export type CalendarData = {
  service_id: string;
  monday?: number; tuesday?: number; wednesday?: number; thursday?: number;
  friday?: number; saturday?: number; sunday?: number;
  start_date?: string; end_date?: string;
};
export type CalendarDateData = { service_id: string; date: string; exception_type: number };

export const ensureStopTimeEditMetadata = (dbPath: string) =>
  executeRows(
    dbPath,
    `ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_type TEXT;
     ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_source_trip_id TEXT;
     ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_from_stop_name TEXT;
     ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_to_stop_name TEXT;`,
  );

// ── Trips (EditTripsTable) — ports saveTripEdit/deleteTrip ────────────────────
/** Insert/update a trip edit. isNew=true → status 'new'; else merges missing fields from TripsView. */
export async function upsertTrip(dbPath: string, data: TripData, isNew: boolean) {
  const tid = data.trip_id;
  if (!tid) throw new Error("trip_id is required");
  let status = "new";
  let merged: TripData = data;
  if (!isNew) {
    const [current] = await queryRows(dbPath, `SELECT * FROM TripsView WHERE trip_id = ${qReq(tid)}`);
    if (!current) throw new Error(`No trip found with trip_id: ${tid} (use trip.add for a new trip)`);
    merged = {
      trip_id: tid,
      route_id: data.route_id ?? (current.route_id as string),
      service_id: data.service_id ?? (current.service_id as string),
      trip_headsign: data.trip_headsign ?? (current.trip_headsign as string),
      direction_id: data.direction_id ?? (current.direction_id as number),
      shape_id: data.shape_id ?? (current.shape_id as string),
    };
    const existing = await queryRows(dbPath, `SELECT status FROM EditTripsTable WHERE trip_id = ${qReq(tid)}`);
    status = nextStatus(existing.length ? String(existing[0].status) : null);
    await executeRows(dbPath, `DELETE FROM EditTripsTable WHERE trip_id = ${qReq(tid)}`);
  } else if (!data.route_id || !data.service_id) {
    throw new Error("trip.add requires route_id and service_id");
  }
  await executeRows(
    dbPath,
    `INSERT INTO EditTripsTable (row_id, route_id, service_id, trip_id, trip_headsign, trip_short_name, direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed, status)
     VALUES ('edit_${esc(tid)}', ${q(merged.route_id)}, ${q(merged.service_id)}, ${qReq(tid)}, ${q(merged.trip_headsign)}, NULL, ${num(merged.direction_id)}, NULL, ${q(merged.shape_id)}, NULL, NULL, ${qReq(status)})`,
  );
}

/** Delete a trip and cascade-delete its stop_times (mirrors web deleteTripCascade). */
export async function deleteTrip(dbPath: string, tripId: string) {
  if (!tripId) throw new Error("trip_id is required");
  const [current] = await queryRows(dbPath, `SELECT status FROM TripsView WHERE trip_id = ${qReq(tripId)}`);
  if (!current) throw new Error(`No trip found with trip_id: ${tripId}`);
  const status = String(current.status || "");
  // Always clear any pending stop-time edits for this trip first.
  await executeRows(dbPath, `DELETE FROM EditStopTimesTable WHERE trip_id = ${qReq(tripId)}`);
  await executeRows(dbPath, `DELETE FROM EditTripsTable WHERE trip_id = ${qReq(tripId)}`);
  if (status === "new" || status === "new edit") return; // trip only existed as an edit → fully removed
  // Base trip: tombstone the trip and each of its base stop_times so neither is exported.
  await executeRows(
    dbPath,
    `INSERT INTO EditTripsTable (row_id, route_id, service_id, trip_id, status) VALUES ('del_${esc(tripId)}', '', '', ${qReq(tripId)}, 'deleted')`,
  );
  await executeRows(
    dbPath,
    `INSERT INTO EditStopTimesTable (row_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time, status)
     SELECT CAST(row_id AS TEXT), trip_id, stop_sequence, stop_id, arrival_time, departure_time, 'deleted'
     FROM stop_times WHERE trip_id = ${qReq(tripId)}`,
  );
}

// ── Stop times (EditStopTimesTable) — ports saveStopTimesEdits ────────────────
/** Replace a trip's stop_times with `stops`, diffing vs original for per-row status. Returns true if changed. */
export async function setStopTimes(
  dbPath: string,
  tripId: string,
  stops: StopTimeData[],
  rerouteMetadata?: RerouteMetadata,
): Promise<boolean> {
  if (!tripId) throw new Error("trip_id is required");
  await ensureStopTimeEditMetadata(dbPath);
  let preservedRerouteMetadata: Record<string, unknown> | undefined;
  let hasOtherPendingEdits = false;
  if (rerouteMetadata) {
    const [row] = await queryRows(
      dbPath,
      `SELECT COUNT(*) AS count
       FROM EditStopTimesTable
       WHERE trip_id = ${qReq(tripId)} AND (edit_type IS NULL OR edit_type <> 'reroute')`,
    );
    hasOtherPendingEdits = Number(row?.count ?? 0) > 0;
  } else {
    [preservedRerouteMetadata] = await queryRows(
      dbPath,
      `SELECT edit_source_trip_id, edit_from_stop_name, edit_to_stop_name
       FROM EditStopTimesTable
       WHERE trip_id = ${qReq(tripId)} AND edit_type = 'reroute'
       LIMIT 1`,
    );
  }
  await executeRows(dbPath, `DELETE FROM EditStopTimesTable WHERE trip_id = ${qReq(tripId)}`);

  const origRows = await queryRows(
    dbPath,
    `SELECT row_id, stop_id, stop_sequence, arrival_time, departure_time FROM stop_times WHERE trip_id = ${qReq(tripId)} ORDER BY stop_sequence`,
  );

  let hasChanges = origRows.length !== stops.length;
  if (!hasChanges) {
    for (let i = 0; i < stops.length; i += 1) {
      const o = origRows[i];
      const c = stops[i];
      if (
        String(o.stop_id ?? "") !== (c.stop_id ?? "") ||
        String(o.arrival_time ?? "") !== (c.arrival_time ?? "") ||
        String(o.departure_time ?? "") !== (c.departure_time ?? "")
      ) { hasChanges = true; break; }
    }
  }
  if (!hasChanges) return false;

  // Per-stop status via multiset matching against the originals (mirrors web logic).
  const origIdCounts = new Map<string, number>();
  for (const r of origRows) {
    const id = String(r.stop_id ?? "");
    origIdCounts.set(id, (origIdCounts.get(id) || 0) + 1);
  }
  const used = new Map<string, number>();
  const inserts: string[] = [];
  for (const st of stops) {
    if (!st.stop_id) throw new Error(`stop_times entry missing stop_id (stop_sequence ${st.stop_sequence})`);
    const id = st.stop_id;
    const seen = used.get(id) || 0;
    const isNew = seen >= (origIdCounts.get(id) || 0);
    used.set(id, seen + 1);
    inserts.push(
      `('edit_${esc(tripId)}_${esc(String(st.stop_sequence))}', ${qReq(tripId)}, ${num(st.stop_sequence)}, ${qReq(id)}, ${q(st.arrival_time)}, ${q(st.departure_time)}, ${q(st.stop_headsign)}, ${num(st.pickup_type)}, ${num(st.drop_off_type)}, ${num(st.shape_dist_traveled)}, ${qReq(isNew ? "new" : "new edit")})`,
    );
  }

  // Tombstone removed originals (multiset difference).
  const newIdCounts = new Map<string, number>();
  for (const st of stops) newIdCounts.set(st.stop_id, (newIdCounts.get(st.stop_id) || 0) + 1);
  const toDelete = new Map<string, number>();
  for (const [id, oc] of origIdCounts) {
    const diff = oc - (newIdCounts.get(id) || 0);
    if (diff > 0) toDelete.set(id, diff);
  }
  for (const r of origRows) {
    const id = String(r.stop_id ?? "");
    const left = toDelete.get(id) || 0;
    if (left > 0) {
      toDelete.set(id, left - 1);
      inserts.push(
        `(${qReq(String(r.row_id))}, ${qReq(tripId)}, ${num(Number(r.stop_sequence))}, ${qReq(id)}, ${q(String(r.arrival_time ?? ""))}, ${q(String(r.departure_time ?? ""))}, NULL, NULL, NULL, NULL, 'deleted')`,
      );
    }
  }

  await executeRows(
    dbPath,
    `INSERT INTO EditStopTimesTable (row_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time, stop_headsign, pickup_type, drop_off_type, shape_dist_traveled, status) VALUES ${inserts.join(", ")}`,
  );
  const appliedRerouteMetadata = rerouteMetadata ?? preservedRerouteMetadata;
  if (appliedRerouteMetadata) {
    const metadataTarget = rerouteMetadata && !hasOtherPendingEdits
      ? `trip_id = ${qReq(tripId)}`
      : `row_id = (
         SELECT row_id
         FROM EditStopTimesTable
         WHERE trip_id = ${qReq(tripId)} AND status IN ('new', 'edit', 'new edit')
         ORDER BY stop_sequence
         LIMIT 1
       )`;
    await executeRows(
      dbPath,
      `UPDATE EditStopTimesTable
       SET edit_type = 'reroute',
           edit_source_trip_id = ${qReq(String(appliedRerouteMetadata.edit_source_trip_id ?? ""))},
           edit_from_stop_name = ${qReq(String(appliedRerouteMetadata.edit_from_stop_name ?? ""))},
           edit_to_stop_name = ${qReq(String(appliedRerouteMetadata.edit_to_stop_name ?? ""))}
       WHERE ${metadataTarget}`,
    );
  }
  return true;
}

/**
 * Reroute a trip onto a donor route between two shared boundary stops, splicing the donor's stops
 * (with the donor's stop_ids) and carrying the donor's real timing scaled into the affected trip's
 * window. Uses the extension's get_reroute_stop_times macro (ensured to exist first, so datasets
 * imported before this feature still work), then applies the result via setStopTimes.
 */
export async function rerouteViaDonor(
  dbPath: string,
  tripId: string,
  donorTripId: string,
  fromName: string,
  toName: string,
): Promise<boolean> {
  if (!tripId || !donorTripId || !fromName || !toName)
    throw new Error("reroute requires trip, donor trip, and the two boundary stop names");
  // Idempotently ensure the reroute macros exist (self-heals older imports).
  await executeRows(dbPath, GTFS_REROUTE_SQL);
  const rows = await queryRows(
    dbPath,
    `SELECT stop_sequence, stop_id, arrival_time, departure_time
     FROM get_reroute_stop_times(${qReq(tripId)}, ${qReq(donorTripId)}, ${qReq(fromName)}, ${qReq(toName)})
     ORDER BY stop_sequence`,
  );
  if (rows.length === 0)
    throw new Error(
      `Reroute produced no stops — check the trip ids and that both trips stop at "${fromName}" and "${toName}".`,
    );
  const stops = rows.map((r) => ({
    stop_sequence: Number(r.stop_sequence),
    stop_id: String(r.stop_id),
    arrival_time: r.arrival_time == null ? undefined : String(r.arrival_time),
    departure_time: r.departure_time == null ? undefined : String(r.departure_time),
  }));
  return setStopTimes(dbPath, tripId, stops, {
    edit_source_trip_id: donorTripId,
    edit_from_stop_name: fromName,
    edit_to_stop_name: toName,
  });
}

// ── Stop add/remove + split (macro-backed) ───────────────────────────────────
const rowsToStops = (rows: Record<string, unknown>[]): StopTimeData[] =>
  rows.map((r) => ({
    stop_sequence: Number(r.stop_sequence),
    stop_id: String(r.stop_id),
    arrival_time: r.arrival_time == null ? undefined : String(r.arrival_time),
    departure_time: r.departure_time == null ? undefined : String(r.departure_time),
  }));

/**
 * Shared core for remove/truncate/split: select a trip's stops = keep those in
 * [firstName..lastName] (inclusive; undefined = open end) minus any in removeNames, via the single
 * get_trip_stops macro. A skip is "full range, remove these names"; a truncate/short-turn is
 * "remove nothing, restrict the range" — one macro/code path behind all three.
 */
async function selectTripStops(
  dbPath: string,
  tripId: string,
  removeNames: string[],
  firstName?: string,
  lastName?: string,
): Promise<Record<string, unknown>[]> {
  await executeRows(dbPath, GTFS_REROUTE_SQL);
  const list = `[${removeNames.map((n) => qReq(n)).join(", ")}]`;
  return queryRows(
    dbPath,
    `SELECT stop_sequence, stop_id, arrival_time, departure_time
     FROM get_trip_stops(${qReq(tripId)}, ${list}, ${firstName ? qReq(firstName) : "NULL"}, ${lastName ? qReq(lastName) : "NULL"})
     ORDER BY stop_sequence`,
  );
}

/** Skip/express or station bypass: drop the named stops from a trip. */
export async function removeStops(dbPath: string, tripId: string, names: string[]): Promise<boolean> {
  if (!tripId || names.length === 0) throw new Error("remove_stops requires a trip and at least one stop name");
  const rows = await selectTripStops(dbPath, tripId, names);
  if (rows.length === 0) throw new Error(`Removing those stops would leave trip ${tripId} empty — check the names`);
  return setStopTimes(dbPath, tripId, rowsToStops(rows));
}

/** Short-turn / ends-early / segment truncation: keep only stops between firstName and lastName.
 *  A truncate is just a remove with no names dropped and the range restricted — same code path. */
export async function truncateTripStops(
  dbPath: string,
  tripId: string,
  firstName?: string,
  lastName?: string,
): Promise<boolean> {
  if (!tripId || (!firstName && !lastName)) throw new Error("truncate_trip requires a trip and --from and/or --to");
  const rows = await selectTripStops(dbPath, tripId, [], firstName, lastName);
  if (rows.length === 0) throw new Error(`Truncation left trip ${tripId} with no stops — check the boundary names`);
  return setStopTimes(dbPath, tripId, rowsToStops(rows));
}

/** Two-section split: truncate the original to end at gapFrom, and add newTripId running gapTo→end. */
export async function splitTrip(
  dbPath: string,
  tripId: string,
  gapFrom: string,
  gapTo: string,
  newTripId: string,
  newHeadsign?: string,
): Promise<void> {
  if (!tripId || !gapFrom || !gapTo || !newTripId)
    throw new Error("split_trip requires --trip, --gap-from, --gap-to, and --new-trip-id");
  const [cur] = await queryRows(
    dbPath,
    `SELECT route_id, service_id, trip_headsign, direction_id, shape_id FROM TripsView WHERE trip_id = ${qReq(tripId)}`,
  );
  if (!cur) throw new Error(`No trip found with trip_id: ${tripId}`);
  // Second section as a new trip (gapTo → end of the original).
  await upsertTrip(
    dbPath,
    {
      trip_id: newTripId,
      route_id: String(cur.route_id),
      service_id: String(cur.service_id),
      trip_headsign: newHeadsign ?? (cur.trip_headsign == null ? undefined : String(cur.trip_headsign)),
      direction_id: cur.direction_id == null ? undefined : Number(cur.direction_id),
      shape_id: cur.shape_id == null ? undefined : String(cur.shape_id),
    },
    true,
  );
  const second = await selectTripStops(dbPath, tripId, [], gapTo, undefined);
  if (second.length === 0) throw new Error(`No stops from "${gapTo}" onward — check the gap boundary names`);
  await setStopTimes(dbPath, newTripId, rowsToStops(second));
  // First section: truncate the original to end at gapFrom (same selectTripStops path).
  const first = await selectTripStops(dbPath, tripId, [], undefined, gapFrom);
  if (first.length === 0) throw new Error(`No stops up to "${gapFrom}" — check the gap boundary names`);
  await setStopTimes(dbPath, tripId, rowsToStops(first));
}

// ── Calendar (EditCalendarTable) — ports saveCalendarEdit/deleteCalendar ──────
export async function upsertCalendar(dbPath: string, data: CalendarData, isNew: boolean) {
  const id = data.service_id;
  if (!id) throw new Error("service_id is required");
  let status = "new";
  let merged: CalendarData = data;
  if (!isNew) {
    const [current] = await queryRows(dbPath, `SELECT * FROM CalendarView WHERE service_id = ${qReq(id)}`);
    if (!current) throw new Error(`No service found with service_id: ${id} (use calendar.add for a new service)`);
    const pick = <K extends keyof CalendarData>(k: K): CalendarData[K] =>
      data[k] ?? (current[k] as CalendarData[K]);
    merged = {
      service_id: id,
      monday: pick("monday"), tuesday: pick("tuesday"), wednesday: pick("wednesday"),
      thursday: pick("thursday"), friday: pick("friday"), saturday: pick("saturday"),
      sunday: pick("sunday"), start_date: pick("start_date"), end_date: pick("end_date"),
    };
    const existing = await queryRows(dbPath, `SELECT status FROM EditCalendarTable WHERE service_id = ${qReq(id)}`);
    status = nextStatus(existing.length ? String(existing[0].status) : null);
    await executeRows(dbPath, `DELETE FROM EditCalendarTable WHERE service_id = ${qReq(id)}`);
  }
  await executeRows(
    dbPath,
    `INSERT INTO EditCalendarTable (row_id, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, status)
     VALUES ('edit_${esc(id)}', ${qReq(id)}, ${day(merged.monday)}, ${day(merged.tuesday)}, ${day(merged.wednesday)}, ${day(merged.thursday)}, ${day(merged.friday)}, ${day(merged.saturday)}, ${day(merged.sunday)}, ${q(merged.start_date)}, ${q(merged.end_date)}, ${qReq(status)})`,
  );
}

export async function deleteCalendar(dbPath: string, serviceId: string) {
  if (!serviceId) throw new Error("service_id is required");
  const [current] = await queryRows(dbPath, `SELECT status FROM CalendarView WHERE service_id = ${qReq(serviceId)}`);
  const status = current ? String(current.status || "") : "";
  await executeRows(dbPath, `DELETE FROM EditCalendarTable WHERE service_id = ${qReq(serviceId)}`);
  if (current && (status === "new" || status === "new edit")) return; // edit-only service → fully removed
  await executeRows(
    dbPath,
    `INSERT INTO EditCalendarTable (row_id, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, status)
     VALUES ('del_${esc(serviceId)}', ${qReq(serviceId)}, 0, 0, 0, 0, 0, 0, 0, '', '', 'deleted')`,
  );
}

// ── Calendar dates / exceptions (EditCalendarDatesTable) — new ────────────────
export async function upsertCalendarDate(dbPath: string, data: CalendarDateData) {
  const { service_id, date } = data;
  if (!service_id || !date) throw new Error("service_id and date are required");
  const exc = Number(data.exception_type);
  if (exc !== 1 && exc !== 2) throw new Error("exception_type must be 1 (added) or 2 (removed)");
  const [current] = await queryRows(
    dbPath,
    `SELECT status FROM CalendarDatesView WHERE service_id = ${qReq(service_id)} AND date = ${qReq(date)}`,
  );
  let status = "new";
  if (current) status = nextStatus(String(current.status || ""));
  await executeRows(
    dbPath,
    `DELETE FROM EditCalendarDatesTable WHERE service_id = ${qReq(service_id)} AND date = ${qReq(date)}`,
  );
  await executeRows(
    dbPath,
    `INSERT INTO EditCalendarDatesTable (row_id, service_id, date, exception_type, status)
     VALUES ('edit_${esc(service_id)}_${esc(date)}', ${qReq(service_id)}, ${qReq(date)}, ${exc}, ${qReq(status)})`,
  );
}

export async function deleteCalendarDate(dbPath: string, serviceId: string, date: string) {
  if (!serviceId || !date) throw new Error("service_id and date are required");
  const [current] = await queryRows(
    dbPath,
    `SELECT status, exception_type FROM CalendarDatesView WHERE service_id = ${qReq(serviceId)} AND date = ${qReq(date)}`,
  );
  if (!current) throw new Error(`No calendar exception for service ${serviceId} on ${date}`);
  const status = String(current.status || "");
  await executeRows(
    dbPath,
    `DELETE FROM EditCalendarDatesTable WHERE service_id = ${qReq(serviceId)} AND date = ${qReq(date)}`,
  );
  if (status === "new" || status === "new edit") return; // edit-only exception → fully removed
  await executeRows(
    dbPath,
    `INSERT INTO EditCalendarDatesTable (row_id, service_id, date, exception_type, status)
     VALUES ('del_${esc(serviceId)}_${esc(date)}', ${qReq(serviceId)}, ${qReq(date)}, ${num(current.exception_type as number)}, 'deleted')`,
  );
}

// ── Batch changeset ───────────────────────────────────────────────────────────
export type ChangeOp =
  | ({ op: "trip.add" | "trip.update" } & TripData)
  | { op: "trip.delete"; trip_id: string }
  | { op: "stop_times.set"; trip_id: string; stops: StopTimeData[] }
  | ({ op: "calendar.add" | "calendar.update" } & CalendarData)
  | { op: "calendar.delete"; service_id: string }
  | ({ op: "calendar_date.add" } & CalendarDateData)
  | { op: "calendar_date.delete"; service_id: string; date: string };

export type ApplySummary = { total: number; byOp: Record<string, number>; skipped: string[] };

/**
 * Apply a batch of typed edit ops. Refreshes affected materialized tables once at the end.
 * Ops run sequentially in array order; a failing op throws (caller decides transactional behavior).
 */
export async function applyChangeset(dbPath: string, ops: ChangeOp[]): Promise<ApplySummary> {
  const summary: ApplySummary = { total: 0, byOp: {}, skipped: [] };
  let touchedTrips = false;
  let touchedCalendar = false;
  const bump = (op: string) => { summary.byOp[op] = (summary.byOp[op] || 0) + 1; summary.total += 1; };

  for (const op of ops) {
    switch (op.op) {
      case "trip.add": await upsertTrip(dbPath, op, true); touchedTrips = true; bump(op.op); break;
      case "trip.update": await upsertTrip(dbPath, op, false); touchedTrips = true; bump(op.op); break;
      case "trip.delete": await deleteTrip(dbPath, op.trip_id); touchedTrips = true; bump(op.op); break;
      case "stop_times.set": {
        const changed = await setStopTimes(dbPath, op.trip_id, op.stops);
        touchedTrips = true;
        if (changed) bump(op.op);
        else summary.skipped.push(`stop_times.set ${op.trip_id} (no change)`);
        break;
      }
      case "calendar.add": await upsertCalendar(dbPath, op, true); touchedCalendar = true; bump(op.op); break;
      case "calendar.update": await upsertCalendar(dbPath, op, false); touchedCalendar = true; bump(op.op); break;
      case "calendar.delete": await deleteCalendar(dbPath, op.service_id); touchedCalendar = true; bump(op.op); break;
      case "calendar_date.add": await upsertCalendarDate(dbPath, op); bump(op.op); break;
      case "calendar_date.delete": await deleteCalendarDate(dbPath, op.service_id, op.date); bump(op.op); break;
      default:
        summary.skipped.push(`unknown op: ${(op as { op?: string }).op ?? "(missing)"}`);
    }
  }

  if (touchedTrips) await refreshTrips(dbPath);
  if (touchedCalendar) await refreshCalendar(dbPath);
  return summary;
}
