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
  currentRouteId: string,
): Promise<RerouteRouteOption[]> => {
  const tid = escapeSql(tripId);
  const rid = escapeSql(currentRouteId);
  const rows = await executeQuery(
    conn,
    `
      WITH affected_stations AS (
        SELECT sv.stop_name AS station_name, MIN(st.stop_sequence) AS affected_sequence
        FROM StopTimesView st
        JOIN StopsView sv ON sv.stop_id = st.stop_id
        WHERE st.trip_id = '${tid}'
          AND sv.stop_name IS NOT NULL
        GROUP BY sv.stop_name
      ),
      shared_stations AS (
        SELECT t.route_id, t.trip_id AS donor_trip_id, shared.station_name,
               shared.affected_sequence, MIN(st.stop_sequence) AS donor_sequence
        FROM trips t
        JOIN StopTimesView st ON st.trip_id = t.trip_id
        JOIN StopsView sv ON sv.stop_id = st.stop_id
        JOIN affected_stations shared ON shared.station_name = sv.stop_name
        WHERE t.trip_id != '${tid}'
          AND t.route_id != '${rid}'
        GROUP BY t.route_id, t.trip_id, shared.station_name, shared.affected_sequence
      ),
      ordered_candidates AS (
        SELECT DISTINCT start_station.route_id, start_station.donor_trip_id
        FROM shared_stations start_station
        JOIN shared_stations end_station
          ON end_station.route_id = start_station.route_id
         AND end_station.donor_trip_id = start_station.donor_trip_id
         AND end_station.affected_sequence > start_station.affected_sequence
         AND end_station.donor_sequence > start_station.donor_sequence
      ),
      candidate_trips AS (
        SELECT shared.route_id, shared.donor_trip_id,
               COUNT(DISTINCT shared.station_name) AS shared_station_count
        FROM shared_stations shared
        JOIN ordered_candidates ordered
          ON ordered.route_id = shared.route_id
         AND ordered.donor_trip_id = shared.donor_trip_id
        GROUP BY shared.route_id, shared.donor_trip_id
        HAVING COUNT(DISTINCT shared.station_name) >= 2
      ),
      trip_patterns AS (
        SELECT candidate_trips.*, STRING_AGG(st.stop_id, '>' ORDER BY st.stop_sequence) AS stop_pattern
        FROM candidate_trips
        JOIN StopTimesView st ON st.trip_id = candidate_trips.donor_trip_id
        GROUP BY candidate_trips.route_id, candidate_trips.donor_trip_id,
                 candidate_trips.shared_station_count
      ),
      pattern_candidates AS (
        SELECT *,
               COUNT(*) OVER (PARTITION BY route_id, stop_pattern) AS pattern_trip_count,
               ROW_NUMBER() OVER (
                 PARTITION BY route_id, stop_pattern
                 ORDER BY donor_trip_id
               ) AS pattern_trip_rank
        FROM trip_patterns
      ),
      pattern_representatives AS (
        SELECT *
        FROM pattern_candidates
        WHERE pattern_trip_rank = 1
      ),
      pattern_pairs AS (
        SELECT patterns.route_id, patterns.donor_trip_id,
               patterns.shared_station_count, patterns.pattern_trip_count,
               start_station.affected_sequence AS affected_from_sequence,
               end_station.affected_sequence AS affected_to_sequence,
               start_station.donor_sequence AS donor_from_sequence,
               end_station.donor_sequence AS donor_to_sequence
        FROM pattern_representatives patterns
        JOIN shared_stations start_station
          ON start_station.route_id = patterns.route_id
         AND start_station.donor_trip_id = patterns.donor_trip_id
        JOIN shared_stations end_station
          ON end_station.route_id = patterns.route_id
         AND end_station.donor_trip_id = patterns.donor_trip_id
         AND end_station.affected_sequence > start_station.affected_sequence
         AND end_station.donor_sequence > start_station.donor_sequence
      ),
      changed_patterns AS (
        SELECT DISTINCT pairs.route_id, pairs.donor_trip_id,
               pairs.shared_station_count, pairs.pattern_trip_count
        FROM pattern_pairs pairs
        WHERE COALESCE((
          SELECT STRING_AGG(st.stop_id, '>' ORDER BY st.stop_sequence)
          FROM StopTimesView st
          WHERE st.trip_id = '${tid}'
            AND st.stop_sequence > pairs.affected_from_sequence
            AND st.stop_sequence < pairs.affected_to_sequence
        ), '') <> COALESCE((
          SELECT STRING_AGG(st.stop_id, '>' ORDER BY st.stop_sequence)
          FROM StopTimesView st
          WHERE st.trip_id = pairs.donor_trip_id
            AND st.stop_sequence > pairs.donor_from_sequence
            AND st.stop_sequence < pairs.donor_to_sequence
        ), '')
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY route_id
          ORDER BY pattern_trip_count DESC, shared_station_count DESC, donor_trip_id
        ) AS route_rank
        FROM changed_patterns
      )
      SELECT r.route_id, r.route_name, r.route_short_name, r.route_type_name,
             r.route_color_hex, ranked.donor_trip_id, ranked.shared_station_count
      FROM ranked
      JOIN RoutesView r ON r.route_id = ranked.route_id
      WHERE ranked.route_rank = 1
      ORDER BY r.route_sort_order NULLS LAST, r.route_name, r.route_id
    `,
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
  const tid = escapeSql(tripId);
  const donor = escapeSql(donorTripId);
  const rows = await executeQuery(
    conn,
    `
      WITH affected AS (
        SELECT sv.stop_name AS station_name, MIN(st.stop_sequence) AS affected_sequence
        FROM StopTimesView st
        JOIN StopsView sv ON sv.stop_id = st.stop_id
        WHERE st.trip_id = '${tid}'
          AND sv.stop_name IS NOT NULL
        GROUP BY sv.stop_name
      ),
      donor AS (
        SELECT sv.stop_name AS station_name, MIN(st.stop_sequence) AS donor_sequence
        FROM StopTimesView st
        JOIN StopsView sv ON sv.stop_id = st.stop_id
        WHERE st.trip_id = '${donor}'
          AND sv.stop_name IS NOT NULL
        GROUP BY sv.stop_name
      ),
      shared AS (
        SELECT affected.station_name, affected.affected_sequence, donor.donor_sequence
        FROM affected
        JOIN donor USING (station_name)
      ),
      pairs AS (
        SELECT start_station.station_name AS from_station,
               end_station.station_name AS to_station,
               start_station.affected_sequence AS affected_from_sequence,
               end_station.affected_sequence AS affected_to_sequence,
               start_station.donor_sequence AS donor_from_sequence,
               end_station.donor_sequence AS donor_to_sequence
        FROM shared start_station
        JOIN shared end_station
          ON end_station.affected_sequence > start_station.affected_sequence
         AND end_station.donor_sequence > start_station.donor_sequence
      )
      SELECT *
      FROM pairs
      WHERE COALESCE((
        SELECT STRING_AGG(st.stop_id, '>' ORDER BY st.stop_sequence)
        FROM StopTimesView st
        WHERE st.trip_id = '${tid}'
          AND st.stop_sequence > pairs.affected_from_sequence
          AND st.stop_sequence < pairs.affected_to_sequence
      ), '') <> COALESCE((
        SELECT STRING_AGG(st.stop_id, '>' ORDER BY st.stop_sequence)
        FROM StopTimesView st
        WHERE st.trip_id = '${donor}'
          AND st.stop_sequence > pairs.donor_from_sequence
          AND st.stop_sequence < pairs.donor_to_sequence
      ), '')
      ORDER BY affected_from_sequence, affected_to_sequence
    `,
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
