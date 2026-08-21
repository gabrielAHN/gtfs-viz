import { GTFS_REROUTE_SQL } from "@gtfs-viz/duckdb-extension";
import { executeQuery } from "@/lib/duckdb/QueryHelper";
import {
  fetchServiceTripStopTimesData,
  saveStopTimesEdits,
} from "@/lib/duckdb/DataFetching/fetchRouteData";

export type RerouteRouteOption = {
  route_id: string;
  route_name: string;
  route_short_name?: string;
  route_type_name?: string;
  route_color_hex?: string;
  donor_trip_id: string;
  shared_station_count: number;
};

export type RerouteBoundaryPair = {
  fromStation: string;
  toStation: string;
  affectedFromSequence: number;
  affectedToSequence: number;
  donorFromSequence: number;
  donorToSequence: number;
};

export type RerouteStop = {
  stop_sequence: number;
  stop_id: string;
  stop_name: string;
  station_name: string;
  stop_lat?: number;
  stop_lon?: number;
  parent_station?: string;
  location_type_name?: string;
  arrival_time?: string;
  departure_time?: string;
};

export type TripReroutePreview = {
  tripId: string;
  donorTripId: string;
  fromStation: string;
  toStation: string;
  originalSegment: RerouteStop[];
  replacementSegment: RerouteStop[];
  originalStops: RerouteStop[];
  mergedStops: RerouteStop[];
  hasChanges: boolean;
};

const escapeSql = (value: string) => value.replace(/'/g, "''");

let installedConnection: any;

const ensureRerouteMacros = async (conn: any) => {
  if (installedConnection === conn) return;
  const statements = GTFS_REROUTE_SQL.split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) await conn.query(statement);
  installedConnection = conn;
};

const normalizeStop = (row: Record<string, any>): RerouteStop => ({
  stop_sequence: Number(row.stop_sequence),
  stop_id: String(row.stop_id),
  stop_name: String(row.stop_name || row.stop_id),
  station_name: String(row.station_name || row.stop_name || row.stop_id),
  stop_lat: row.stop_lat == null ? undefined : Number(row.stop_lat),
  stop_lon: row.stop_lon == null ? undefined : Number(row.stop_lon),
  parent_station: row.parent_station ? String(row.parent_station) : undefined,
  location_type_name: row.location_type_name ? String(row.location_type_name) : undefined,
  arrival_time: row.arrival_time ? String(row.arrival_time) : undefined,
  departure_time: row.departure_time ? String(row.departure_time) : undefined,
});

export const ensureRerouteEditColumns = async (conn: any) => {
  await conn.query("ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_type TEXT");
  await conn.query(
    "ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_source_trip_id TEXT",
  );
  await conn.query(
    "ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_from_stop_name TEXT",
  );
  await conn.query(
    "ALTER TABLE EditStopTimesTable ADD COLUMN IF NOT EXISTS edit_to_stop_name TEXT",
  );
};

const segmentBetween = (stops: RerouteStop[], fromStation: string, toStation: string) => {
  const fromIndex = stops.findIndex(
    (stop) => stop.station_name === fromStation || stop.stop_name === fromStation,
  );
  const toIndex = stops.findIndex(
    (stop, index) =>
      index > fromIndex && (stop.station_name === toStation || stop.stop_name === toStation),
  );
  if (fromIndex < 0 || toIndex < 0) throw new Error("The selected stations do not bound this trip");
  return stops.slice(fromIndex + 1, toIndex);
};

export const fetchTripRerouteRoutes = async (
  conn: any,
  tripId: string,
): Promise<RerouteRouteOption[]> => {
  await ensureRerouteMacros(conn);
  const tid = escapeSql(tripId);
  const rows = await executeQuery(
    conn,
    `SELECT * FROM get_trip_reroute_routes('${tid}')`,
  );
  return rows.map((row) => ({
    route_id: String(row.route_id),
    route_name: String(row.route_name || row.route_short_name || row.route_id),
    route_short_name: row.route_short_name ? String(row.route_short_name) : undefined,
    route_type_name: row.route_type_name ? String(row.route_type_name) : undefined,
    route_color_hex: row.route_color_hex ? String(row.route_color_hex) : undefined,
    donor_trip_id: String(row.donor_trip_id),
    shared_station_count: Number(row.shared_station_count),
  }));
};

export const fetchTripRerouteBoundaryPairs = async (
  conn: any,
  tripId: string,
  donorTripId: string,
): Promise<RerouteBoundaryPair[]> => {
  await ensureRerouteMacros(conn);
  const tid = escapeSql(tripId);
  const donor = escapeSql(donorTripId);
  const rows = await executeQuery(
    conn,
    `SELECT * FROM get_trip_reroute_boundary_pairs('${tid}', '${donor}')`,
  );
  return rows.map((row) => ({
    fromStation: String(row.from_station),
    toStation: String(row.to_station),
    affectedFromSequence: Number(row.affected_from_sequence),
    affectedToSequence: Number(row.affected_to_sequence),
    donorFromSequence: Number(row.donor_from_sequence),
    donorToSequence: Number(row.donor_to_sequence),
  }));
};

export const fetchTripReroutePreview = async (
  conn: any,
  tripId: string,
  donorTripId: string,
  fromStation: string,
  toStation: string,
): Promise<TripReroutePreview> => {
  await ensureRerouteMacros(conn);
  const tid = escapeSql(tripId);
  const donor = escapeSql(donorTripId);
  const from = escapeSql(fromStation);
  const to = escapeSql(toStation);
  const originalRows = await executeQuery(
    conn,
    `
      SELECT st.stop_sequence, st.stop_id, sv.stop_name, sv.stop_lat, sv.stop_lon,
             sv.parent_station, sv.location_type_name,
             COALESCE(station.stop_name, sv.stop_name) AS station_name,
             st.arrival_time, st.departure_time
      FROM StopTimesView st
      JOIN StopsView sv ON sv.stop_id = st.stop_id
      LEFT JOIN StopsView station
        ON station.stop_id = COALESCE(NULLIF(sv.parent_station, ''), sv.stop_id)
       AND station.location_type_name = 'Station'
      WHERE st.trip_id = '${tid}'
      ORDER BY st.stop_sequence
    `,
  );
  const mergedRows = await executeQuery(
    conn,
    `
      SELECT rerouted.stop_sequence, rerouted.stop_id, sv.stop_name, sv.stop_lat, sv.stop_lon,
             sv.parent_station, sv.location_type_name,
             COALESCE(station.stop_name, sv.stop_name) AS station_name,
             rerouted.arrival_time, rerouted.departure_time
      FROM get_reroute_stop_times('${tid}', '${donor}', '${from}', '${to}') rerouted
      JOIN StopsView sv ON sv.stop_id = rerouted.stop_id
      LEFT JOIN StopsView station
        ON station.stop_id = COALESCE(NULLIF(sv.parent_station, ''), sv.stop_id)
       AND station.location_type_name = 'Station'
      ORDER BY rerouted.stop_sequence
    `,
  );
  const originalStops = originalRows.map(normalizeStop);
  const mergedStops = mergedRows.map(normalizeStop);
  if (mergedStops.length === 0) throw new Error("The reroute macro returned no stops");
  const originalSegment = segmentBetween(originalStops, fromStation, toStation);
  const replacementSegment = segmentBetween(mergedStops, fromStation, toStation);
  const hasChanges =
    originalStops.length !== mergedStops.length ||
    originalStops.some((stop, index) => {
      const replacement = mergedStops[index];
      return !replacement || stop.stop_id !== replacement.stop_id;
    });
  return {
    tripId,
    donorTripId,
    fromStation,
    toStation,
    originalSegment,
    replacementSegment,
    originalStops,
    mergedStops,
    hasChanges,
  };
};

export const saveTripReroute = async (
  conn: any,
  selectedTripId: string,
  preview: TripReroutePreview,
) => {
  if (preview.tripId !== selectedTripId) {
    throw new Error("The reroute preview does not match the selected trip");
  }
  await ensureRerouteEditColumns(conn);
  await saveStopTimesEdits(conn, selectedTripId, preview.mergedStops, {
    edit_source_trip_id: preview.donorTripId,
    edit_from_stop_name: preview.fromStation,
    edit_to_stop_name: preview.toStation,
  });
  return fetchServiceTripStopTimesData(conn, selectedTripId);
};
