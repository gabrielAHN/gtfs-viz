import { executeQuery, escapeSql } from "@/lib/duckdb/QueryHelper";
import { insertTableRow, deleteEditRow, refreshMaterializedTable } from "@/lib/duckdb/DataEditing/insertData";
import { logger } from "@/lib/logger";
import { markPersistedStopTimeEdits } from "@/lib/tripUtils";
import { getPathfindingFunctions } from "./pathways/hybridPathfinding";

export const fetchRouteData = async (props) => {
  const { conn, StationView } = props;

  try {
    logger.log(`🔍 Fetching route data for station ${StationView.stop_id}`);

    const functions = await getPathfindingFunctions(conn);

    let query: string;
    if (functions.method === "onager_direct") {
      query = `SELECT * FROM get_station_routes_direct('${StationView.stop_id}')`;
      logger.log(`  Using Onager direct mode (all-pairs Dijkstra)`);
    } else {
      query = `SELECT * FROM get_station_routes('${StationView.stop_id}')`;
      logger.log(`  Using recursive CTE mode (with cache)`);
    }

    const results = await executeQuery(conn, query);

    logger.log(`  ✅ Found ${results.length} routes for station ${StationView.stop_id}`);

    return results;
  } catch (error) {
    logger.error("Error executing RouteDataQuery:", error);
    throw error;
  }
};


const routeIdListSql = (routeIds: string[]) => {
  return `[${routeIds.map((id) => `'${escapeSql(id)}'`).join(", ")}]`;
};

export const fetchServiceRoutesData = async (conn: any) => {
  return executeQuery(conn, "SELECT * FROM RoutesTable");
};

export const fetchServiceRouteInfoData = async (conn: any, routeId: string) => {
  return (
    await executeQuery(conn, `SELECT * FROM RoutesTable WHERE route_id = '${escapeSql(routeId)}'`)
  )[0];
};

export const fetchServiceRouteTripsData = async (conn: any, routeId: string) => {
  return executeQuery(
    conn,
    `
      SELECT route_id, service_id, trip_id, trip_headsign, trip_short_name,
             direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed
      FROM TripsView
      WHERE route_id = '${escapeSql(routeId)}'
      ORDER BY trip_id
    `,
  );
};

const ensureServiceTables = async (conn: any) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS calendar (
      row_id INTEGER, service_id VARCHAR, monday INTEGER, tuesday INTEGER,
      wednesday INTEGER, thursday INTEGER, friday INTEGER, saturday INTEGER,
      sunday INTEGER, start_date VARCHAR, end_date VARCHAR
    )
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS calendar_dates (
      row_id INTEGER, service_id VARCHAR, date VARCHAR, exception_type INTEGER
    )
  `);
};

export const fetchServiceRouteServicesData = async (conn: any, routeId: string) => {
  try { await ensureServiceTables(conn); } catch { /* tables may already exist */ }
  return executeQuery(
    conn,
    `
      WITH route_services AS (
        SELECT route_id, service_id, COUNT(DISTINCT trip_id) AS trip_count,
               COUNT(DISTINCT shape_id) AS shape_count,
               COUNT(DISTINCT block_id) AS block_count,
               COUNT(DISTINCT trip_headsign) AS headsign_count
        FROM TripsView
        WHERE route_id = '${escapeSql(routeId)}'
          AND service_id IS NOT NULL AND service_id != ''
        GROUP BY route_id, service_id
      ),
      all_services AS (
        SELECT rs.route_id, rs.service_id, rs.trip_count, rs.shape_count, rs.block_count, rs.headsign_count
        FROM route_services rs
        UNION ALL
        SELECT '${escapeSql(routeId)}' AS route_id, cv.service_id, 0 AS trip_count, 0 AS shape_count, 0 AS block_count, 0 AS headsign_count
        FROM CalendarView cv
        WHERE cv.status IN ('new', 'new edit')
          AND NOT EXISTS (SELECT 1 FROM route_services rs WHERE rs.service_id = cv.service_id)
      ),
      date_summary AS (
        SELECT service_id,
               SUM(CASE WHEN exception_type = 1 THEN 1 ELSE 0 END) AS added_dates,
               SUM(CASE WHEN exception_type = 2 THEN 1 ELSE 0 END) AS removed_dates,
               MIN(date) AS first_exception_date,
               MAX(date) AS last_exception_date,
               STRING_AGG(date, ',') FILTER (WHERE exception_type = 1) AS added_exception_dates,
               STRING_AGG(date, ',') FILTER (WHERE exception_type = 2) AS removed_exception_dates
        FROM calendar_dates
        GROUP BY service_id
      )
      SELECT rs.route_id, rs.service_id, rs.trip_count, rs.shape_count,
             rs.block_count, rs.headsign_count,
             COALESCE(c.monday, 0) AS monday,
             COALESCE(c.tuesday, 0) AS tuesday,
             COALESCE(c.wednesday, 0) AS wednesday,
             COALESCE(c.thursday, 0) AS thursday,
             COALESCE(c.friday, 0) AS friday,
             COALESCE(c.saturday, 0) AS saturday,
             COALESCE(c.sunday, 0) AS sunday,
             c.start_date, c.end_date,
             COALESCE(ds.added_dates, 0) AS added_dates,
             COALESCE(ds.removed_dates, 0) AS removed_dates,
             ds.first_exception_date,
             ds.last_exception_date,
             ds.added_exception_dates,
             ds.removed_exception_dates
      FROM all_services rs
      LEFT JOIN CalendarView c ON c.service_id = rs.service_id
      LEFT JOIN date_summary ds ON ds.service_id = rs.service_id
      ORDER BY rs.service_id
    `,
  );
};

export const fetchServiceRouteTripsForServiceData = async (
  conn: any,
  routeId: string,
  serviceId: string,
) => {
  return executeQuery(
    conn,
    `
      WITH parsed_stop_times AS (
        SELECT trip_id,
               NULLIF(arrival_time, '') AS arrival_time,
               NULLIF(departure_time, '') AS departure_time,
               CASE WHEN NULLIF(departure_time, '') IS NULL THEN NULL
                    ELSE COALESCE(TRY_CAST(SPLIT_PART(departure_time, ':', 1) AS INTEGER), 0) * 3600
                       + COALESCE(TRY_CAST(SPLIT_PART(departure_time, ':', 2) AS INTEGER), 0) * 60
                       + COALESCE(TRY_CAST(SPLIT_PART(departure_time, ':', 3) AS INTEGER), 0) END AS departure_seconds,
               CASE WHEN NULLIF(arrival_time, '') IS NULL THEN NULL
                    ELSE COALESCE(TRY_CAST(SPLIT_PART(arrival_time, ':', 1) AS INTEGER), 0) * 3600
                       + COALESCE(TRY_CAST(SPLIT_PART(arrival_time, ':', 2) AS INTEGER), 0) * 60
                       + COALESCE(TRY_CAST(SPLIT_PART(arrival_time, ':', 3) AS INTEGER), 0) END AS arrival_seconds
        FROM stop_times
        WHERE trip_id IS NOT NULL AND trip_id != ''
      ),
      trip_times AS (
        SELECT trip_id,
               MIN(departure_time) AS first_departure_time,
               MAX(arrival_time) AS last_arrival_time,
               MIN(departure_seconds) AS first_departure_seconds,
               MAX(arrival_seconds) AS last_arrival_seconds
        FROM parsed_stop_times
        GROUP BY trip_id
      )
      SELECT t.route_id, t.service_id, t.trip_id, t.trip_headsign, t.trip_short_name,
             t.direction_id, t.block_id, t.shape_id, t.wheelchair_accessible, t.bikes_allowed,
             tt.first_departure_time, tt.last_arrival_time,
             tt.first_departure_seconds, tt.last_arrival_seconds
      FROM TripsView t
      LEFT JOIN trip_times tt ON tt.trip_id = t.trip_id
      WHERE t.route_id = '${escapeSql(routeId)}'
        AND t.service_id = '${escapeSql(serviceId)}'
      ORDER BY COALESCE(tt.first_departure_seconds, 2147483647), t.trip_id
    `,
  );
};

export const fetchServiceTripStopTimesData = async (conn: any, tripId: string) => {
  const tid = escapeSql(tripId);
  const currentStops = await executeQuery(
    conn,
    `
      SELECT st.trip_id, st.stop_sequence, st.arrival_time, st.departure_time,
             st.stop_id, sv.stop_name, sv.location_type_name, sv.parent_station,
             COALESCE(station.stop_name, sv.stop_name) AS station_name,
             st.stop_headsign, st.pickup_type, st.drop_off_type, st.shape_dist_traveled,
             sv.stop_lat, sv.stop_lon, st.status
      FROM StopTimesView st
      LEFT JOIN StopsView sv ON sv.stop_id = st.stop_id
      LEFT JOIN StopsView station
        ON station.stop_id = COALESCE(NULLIF(sv.parent_station, ''), sv.stop_id)
       AND station.location_type_name = 'Station'
      WHERE st.trip_id = '${tid}'
      ORDER BY st.stop_sequence, st.arrival_time, st.departure_time, st.stop_id
    `,
  );
  if (!currentStops.some((stop) => stop.status === "new" || stop.status === "new edit" || stop.status === "edit")) {
    return currentStops;
  }
  const originalStops = await executeQuery(
    conn,
    `
      SELECT trip_id, stop_sequence, arrival_time, departure_time, stop_id,
             stop_headsign, pickup_type, drop_off_type, shape_dist_traveled
      FROM stop_times
      WHERE trip_id = '${tid}'
      ORDER BY stop_sequence, arrival_time, departure_time, stop_id
    `,
  );
  let stopsWithMetadata = currentStops;
  try {
    const [rerouteMetadata] = await executeQuery(
      conn,
      `SELECT edit_type, edit_from_stop_name, edit_to_stop_name
       FROM EditStopTimesTable
       WHERE trip_id = '${tid}' AND edit_type = 'reroute'
       LIMIT 1`,
    );
    if (rerouteMetadata) {
      stopsWithMetadata = currentStops.map((stop) => ({ ...stop, ...rerouteMetadata }));
    }
  } catch {
    stopsWithMetadata = currentStops;
  }
  return markPersistedStopTimeEdits(stopsWithMetadata, originalStops);
};

export const fetchAllTripsData = async (conn: any) => {
  return executeQuery(conn, "SELECT * FROM TripsTable");
};

export const saveCalendarEdit = async (conn: any, data: {
  service_id: string; monday: number; tuesday: number; wednesday: number; thursday: number;
  friday: number; saturday: number; sunday: number; start_date: string; end_date: string;
}, isNew: boolean) => {
  const id = data.service_id.replace(/'/g, "''");
  let status = "new";
  if (!isNew) {
    // Check if this was a previously added new service
    const existing = await executeQuery(conn, `SELECT status FROM EditCalendarTable WHERE service_id = '${id}'`);
    const prevStatus = existing.length > 0 ? String(existing[0].status) : null;
    status = prevStatus === "new" ? "new edit" : "edit";
    await conn.query(`DELETE FROM EditCalendarTable WHERE service_id = '${id}'`);
  }
  const mon = Number(data.monday) || 0;
  const tue = Number(data.tuesday) || 0;
  const wed = Number(data.wednesday) || 0;
  const thu = Number(data.thursday) || 0;
  const fri = Number(data.friday) || 0;
  const sat = Number(data.saturday) || 0;
  const sun = Number(data.sunday) || 0;
  await conn.query(`
    INSERT INTO EditCalendarTable (row_id, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, status)
    VALUES ('edit_${id}', '${id}', ${mon}, ${tue}, ${wed}, ${thu},
            ${fri}, ${sat}, ${sun}, '${(data.start_date || '').replace(/'/g, "''")}', '${(data.end_date || '').replace(/'/g, "''")}', '${status}')
  `);
  await refreshMaterializedTable(conn, "CalendarTable");
};

export const deleteCalendar = async (conn: any, serviceId: string) => {
  const id = serviceId.replace(/'/g, "''");
  await conn.query(`DELETE FROM EditCalendarTable WHERE service_id = '${id}'`);
  await conn.query(`INSERT INTO EditCalendarTable (row_id, service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date, status)
    VALUES ('del_${id}', '${id}', 0, 0, 0, 0, 0, 0, 0, '', '', 'deleted')`);
  await refreshMaterializedTable(conn, "CalendarTable");
};

export const saveTripEdit = async (conn: any, data: {
  trip_id: string; route_id: string; service_id: string; trip_headsign?: string;
  direction_id?: number; shape_id?: string;
}, isNew: boolean) => {
  const tid = data.trip_id.replace(/'/g, "''");
  let status = "new";
  if (!isNew) {
    const existing = await executeQuery(conn, `SELECT status FROM EditTripsTable WHERE trip_id = '${tid}'`);
    const prevStatus = existing.length > 0 ? String(existing[0].status) : null;
    status = prevStatus === "new" ? "new edit" : "edit";
    await conn.query(`DELETE FROM EditTripsTable WHERE trip_id = '${tid}'`);
  }
  await conn.query(`
    INSERT INTO EditTripsTable (row_id, route_id, service_id, trip_id, trip_headsign, trip_short_name, direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed, status)
    VALUES ('edit_${tid}', '${data.route_id.replace(/'/g, "''")}', '${data.service_id.replace(/'/g, "''")}', '${tid}',
            ${data.trip_headsign ? `'${data.trip_headsign.replace(/'/g, "''")}'` : 'NULL'},
            NULL, ${data.direction_id != null ? Number(data.direction_id) : 'NULL'}, NULL, ${data.shape_id ? `'${data.shape_id.replace(/'/g, "''")}'` : 'NULL'},
            NULL, NULL, '${status}')
  `);
  await refreshMaterializedTable(conn, "TripsTable");
};

export const deleteTrip = async (conn: any, tripId: string) => {
  const tid = tripId.replace(/'/g, "''");
  await conn.query(`DELETE FROM EditTripsTable WHERE trip_id = '${tid}'`);
  await conn.query(`INSERT INTO EditTripsTable (row_id, route_id, service_id, trip_id, status)
    VALUES ('del_${tid}', '', '', '${tid}', 'deleted')`);
  await refreshMaterializedTable(conn, "TripsTable");
};

export const fetchTripsTimeBounds = async (conn: any) => {
  const rows = await executeQuery(conn, "SELECT * FROM get_trips_time_bounds()");
  const row = rows[0];
  if (!row || row.min_time == null || row.max_time == null) return null;
  return { minTime: Number(row.min_time), maxTime: Number(row.max_time) };
};

export const saveStopTimesEdits = async (
  conn: any,
  tripId: string,
  stops: Array<{ stop_sequence: number; stop_id?: string; arrival_time?: string; departure_time?: string; stop_headsign?: string; pickup_type?: number; drop_off_type?: number; shape_dist_traveled?: number }>,
  rerouteMetadata?: {
    edit_source_trip_id: string;
    edit_from_stop_name: string;
    edit_to_stop_name: string;
  },
) => {
  const tid = escapeSql(tripId);
  let preservedRerouteMetadata: Record<string, any> | undefined;
  let hasOtherPendingEdits = false;
  if (rerouteMetadata) {
    const rows = await executeQuery(
      conn,
      `SELECT COUNT(*) AS count
       FROM EditStopTimesTable
       WHERE trip_id = '${tid}' AND (edit_type IS NULL OR edit_type <> 'reroute')`,
    );
    hasOtherPendingEdits = Number(rows[0]?.count ?? 0) > 0;
  } else {
    try {
      const rows = await executeQuery(
        conn,
        `SELECT edit_source_trip_id, edit_from_stop_name, edit_to_stop_name
         FROM EditStopTimesTable
         WHERE trip_id = '${tid}' AND edit_type = 'reroute'
         LIMIT 1`,
      );
      preservedRerouteMetadata = rows[0];
    } catch {
      preservedRerouteMetadata = undefined;
    }
  }
  // Clear previous edits for this trip
  await deleteEditRow({ conn, table: "EditStopTimesTable", column: "trip_id", formData: { trip_id: tripId } });

  // Get original stop times to compare
  const origRows = await executeQuery(conn, `SELECT row_id, stop_id, stop_sequence, arrival_time, departure_time FROM stop_times WHERE trip_id = '${escapeSql(tripId)}' ORDER BY stop_sequence`);

  // Check if anything actually changed
  let hasChanges = origRows.length !== stops.length;
  if (!hasChanges) {
    for (let i = 0; i < stops.length; i++) {
      const orig = origRows[i];
      const cur = stops[i];
      if (String(orig.stop_id || "") !== (cur.stop_id || "") ||
          String(orig.arrival_time || "") !== (cur.arrival_time || "") ||
          String(orig.departure_time || "") !== (cur.departure_time || "")) {
        hasChanges = true;
        break;
      }
    }
  }
  if (!hasChanges) return;

  // Determine per-stop status using multiset matching
  const origIdCounts = new Map<string, number>();
  for (const r of origRows) origIdCounts.set(String(r.stop_id || ""), (origIdCounts.get(String(r.stop_id || "")) || 0) + 1);
  const usedCounts = new Map<string, number>();

  for (const s of stops) {
    const id = s.stop_id || "";
    const used = usedCounts.get(id) || 0;
    const isNew = used >= (origIdCounts.get(id) || 0);
    usedCounts.set(id, used + 1);

    await insertTableRow({
      conn,
      table: "EditStopTimesTable",
      formData: {
        row_id: `edit_${tripId}_${s.stop_sequence}`,
        trip_id: tripId,
        stop_sequence: s.stop_sequence,
        stop_id: s.stop_id || "",
        arrival_time: s.arrival_time || "",
        departure_time: s.departure_time || "",
        stop_headsign: s.stop_headsign || null,
        pickup_type: s.pickup_type ?? null,
        drop_off_type: s.drop_off_type ?? null,
        shape_dist_traveled: s.shape_dist_traveled ?? null,
        status: isNew ? "new" : "new edit",
      },
    });
  }

  // Insert 'deleted' rows for removed original stops
  const newIdCounts = new Map<string, number>();
  for (const s of stops) newIdCounts.set(s.stop_id || "", (newIdCounts.get(s.stop_id || "") || 0) + 1);
  const toDelete = new Map<string, number>();
  for (const [id, origCount] of origIdCounts) {
    const diff = origCount - (newIdCounts.get(id) || 0);
    if (diff > 0) toDelete.set(id, diff);
  }
  for (const r of origRows) {
    const id = String(r.stop_id || "");
    const left = toDelete.get(id) || 0;
    if (left > 0) {
      toDelete.set(id, left - 1);
      await insertTableRow({
        conn,
        table: "EditStopTimesTable",
        formData: {
          row_id: String(r.row_id),
          trip_id: tripId,
          stop_sequence: Number(r.stop_sequence),
          stop_id: id,
          arrival_time: String(r.arrival_time || ""),
          departure_time: String(r.departure_time || ""),
          status: "deleted",
        },
      });
    }
  }

  const appliedRerouteMetadata = rerouteMetadata ?? preservedRerouteMetadata;
  if (appliedRerouteMetadata) {
    const metadataTarget = rerouteMetadata && !hasOtherPendingEdits
      ? `trip_id = '${tid}'`
      : `row_id = (
          SELECT row_id
          FROM EditStopTimesTable
          WHERE trip_id = '${tid}' AND status IN ('new', 'edit', 'new edit')
          ORDER BY stop_sequence
          LIMIT 1
        )`;
    await conn.query(`
      UPDATE EditStopTimesTable
      SET edit_type = 'reroute',
          edit_source_trip_id = '${escapeSql(String(appliedRerouteMetadata.edit_source_trip_id || ""))}',
          edit_from_stop_name = '${escapeSql(String(appliedRerouteMetadata.edit_from_stop_name || ""))}',
          edit_to_stop_name = '${escapeSql(String(appliedRerouteMetadata.edit_to_stop_name || ""))}'
      WHERE ${metadataTarget}
    `);
  }

  // Refresh materialized tables that depend on stop times
  await refreshMaterializedTable(conn, "TripsTable");
};

export const fetchServiceRouteStationsData = async (conn: any, routeId: string) => {
  return executeQuery(conn, `SELECT * FROM get_route_stations('${escapeSql(routeId)}')`);
};

export const fetchServiceRouteStopsData = async (conn: any, routeIds: string[]) => {
  if (routeIds.length === 0) return [];
  if (routeIds.length > 25) {
    return executeQuery(
      conn,
      "SELECT * FROM RouteStopsTable ORDER BY route_id, stop_sequence, stop_name, stop_id",
    );
  }
  return executeQuery(
    conn,
    `SELECT * FROM get_route_stops_for_routes(${routeIdListSql(routeIds)})`,
  );
};

export const fetchFitZoom = async (conn: any, minLon: number, maxLon: number, minLat: number, maxLat: number) => {
  const result = await conn.query(`SELECT fit_zoom(${minLon}, ${maxLon}, ${minLat}, ${maxLat}) AS zoom`);
  const row = result.toArray()[0];
  return Number(row?.zoom ?? row?.toJSON?.()?.zoom ?? 10);
};

const boundsRowToFit = (rawRow: any) => {
  const row = rawRow?.toJSON?.() ?? rawRow;
  if (!row || row.min_lon == null) return null;
  const minLon = Number(row.min_lon);
  const maxLon = Number(row.max_lon);
  const minLat = Number(row.min_lat);
  const maxLat = Number(row.max_lat);
  const centerLon = Number(row.center_lon);
  const centerLat = Number(row.center_lat);
  const zoom = Number(row.zoom);
  if (
    !Number.isFinite(minLon) || !Number.isFinite(maxLon) ||
    !Number.isFinite(minLat) || !Number.isFinite(maxLat) ||
    !Number.isFinite(centerLon) || !Number.isFinite(centerLat) ||
    !Number.isFinite(zoom)
  ) return null;
  return {
    boundBox: [[minLon, minLat], [maxLon, maxLat]] as [[number, number], [number, number]],
    viewState: {
      longitude: centerLon,
      latitude: centerLat,
      zoom,
      pitch: 0,
      bearing: 0,
      transitionDuration: 0,
    },
  };
};

export const fetchStationsMapBounds = async (conn: any) => {
  const rows = await executeQuery(conn, "SELECT * FROM get_stations_map_bounds()");
  return boundsRowToFit(rows[0]);
};

export const fetchStopsMapBounds = async (conn: any) => {
  const rows = await executeQuery(conn, "SELECT * FROM get_stops_map_bounds()");
  return boundsRowToFit(rows[0]);
};

export const fetchRouteMapBounds = async (conn: any, routeIds: string[]) => {
  if (routeIds.length === 0) return null;
  if (routeIds.length > 200) {
    const rows = await executeQuery(conn, "SELECT * FROM get_all_shapes_map_bounds()");
    return boundsRowToFit(rows[0]);
  }
  const rows = await executeQuery(
    conn,
    `SELECT * FROM get_route_map_bounds(${routeIdListSql(routeIds)})`,
  );
  return boundsRowToFit(rows[0]);
};

export const fetchServiceRouteShapesData = async (
  conn: any,
  routeIds: string[],
  options?: { routeTypes?: string[] },
) => {
  if (routeIds.length === 0) return [];

  const isLargeSet = routeIds.length > 200;
  const maxPointsPerShape = isLargeSet ? 30 : routeIds.length > 10 ? 80 : 240;

  // For large sets, skip route ID list and filter by route type in SQL
  let routeShapesCte: string;
  if (isLargeSet) {
    const typeFilter = options?.routeTypes && options.routeTypes.length > 0
      ? `AND r.route_type_name IN (${options.routeTypes.map((t) => `'${escapeSql(t)}'`).join(", ")})`
      : "";
    routeShapesCte = `
      all_route_shapes AS (
        SELECT t.route_id, t.shape_id, COUNT(*) as pt_count,
               ROW_NUMBER() OVER (PARTITION BY t.route_id ORDER BY COUNT(*) DESC) as rn
        FROM (
          SELECT DISTINCT tv.route_id, tv.shape_id
          FROM TripsView tv
          JOIN RoutesView r ON r.route_id = tv.route_id
          WHERE tv.shape_id IS NOT NULL AND tv.shape_id != '' ${typeFilter}
        ) t
        JOIN shapes s ON s.shape_id = t.shape_id
        GROUP BY t.route_id, t.shape_id
      ),
      route_shapes AS (
        SELECT route_id, shape_id FROM all_route_shapes WHERE rn = 1
      )`;
  } else {
    routeShapesCte = `
      requested_routes AS (
        SELECT unnest(${routeIdListSql(routeIds)}) AS route_id
      ),
      route_shapes AS (
        SELECT DISTINCT t.route_id, t.shape_id
        FROM TripsView t
        JOIN requested_routes rr ON rr.route_id = t.route_id
        WHERE t.shape_id IS NOT NULL AND t.shape_id != ''
      )`;
  }

  return executeQuery(
    conn,
    `
      WITH ${routeShapesCte},
      shape_points AS (
        SELECT rs.route_id, r.route_name, r.route_color_hex, r.route_text_color_hex,
               r.route_type_name, rs.shape_id, s.shape_pt_lat, s.shape_pt_lon,
               s.shape_pt_sequence, s.shape_dist_traveled,
               ROW_NUMBER() OVER (
                 PARTITION BY rs.route_id, rs.shape_id
                 ORDER BY s.shape_pt_sequence
               ) AS point_index,
               COUNT(*) OVER (PARTITION BY rs.route_id, rs.shape_id) AS point_count
        FROM route_shapes rs
        JOIN RoutesView r ON r.route_id = rs.route_id
        JOIN shapes s ON s.shape_id = rs.shape_id
        WHERE s.shape_pt_lat IS NOT NULL AND s.shape_pt_lon IS NOT NULL
      )
      SELECT route_id, route_name, route_color_hex, route_text_color_hex,
             route_type_name, shape_id, shape_pt_lat, shape_pt_lon,
             shape_pt_sequence, shape_dist_traveled
      FROM shape_points
      WHERE point_count <= ${maxPointsPerShape}
         OR point_index = 1
         OR point_index = point_count
         OR ((point_index - 1) % GREATEST(1, CAST(CEIL(point_count / ${maxPointsPerShape}.0) AS INTEGER))) = 0
      ORDER BY route_id, shape_id, shape_pt_sequence
    `,
  );
};

// ─── Edit status queries ──────────────────────────────────────────

export const fetchEditedTripStatuses = async (conn: any) => {
  const stRows = await executeQuery(conn, "SELECT trip_id, status FROM EditStopTimesTable");
  const tRows = await executeQuery(conn, "SELECT trip_id, status FROM EditTripsTable");
  const m = new Map<string, string>();
  const tripStatuses = new Map<string, Set<string>>();
  for (const r of stRows) {
    const id = String(r.trip_id);
    if (!tripStatuses.has(id)) tripStatuses.set(id, new Set());
    tripStatuses.get(id)!.add(String(r.status));
  }
  for (const [id, statuses] of tripStatuses) {
    if (statuses.has("new") && !statuses.has("new edit") && !statuses.has("edit")) m.set(id, "new");
    else m.set(id, "edit");
  }
  for (const r of tRows) m.set(String(r.trip_id), String(r.status));
  return m;
};

export const fetchEditedCalendarStatuses = async (conn: any) => {
  const rows = await executeQuery(conn, "SELECT service_id, status FROM EditCalendarTable");
  const m = new Map<string, string>();
  for (const r of rows) m.set(String(r.service_id), String(r.status));
  // A service with only exception-date (calendar_dates) edits still counts as edited.
  let dateRows: any[] = [];
  try {
    dateRows = await executeQuery(conn, "SELECT DISTINCT service_id FROM EditCalendarDatesTable");
  } catch {
    /* table may not exist on older datasets */
  }
  for (const r of dateRows) {
    if (!m.has(String(r.service_id))) m.set(String(r.service_id), "edit");
  }
  return m;
};

export const fetchEditedTripStatusesForRoute = async (conn: any) => {
  const rows = await executeQuery(conn, "SELECT trip_id, status FROM EditTripsTable");
  const stRows = await executeQuery(conn, "SELECT DISTINCT trip_id FROM EditStopTimesTable");
  const m = new Map<string, string>();
  for (const r of rows) m.set(String(r.trip_id), String(r.status));
  for (const r of stRows) { if (!m.has(String(r.trip_id))) m.set(String(r.trip_id), "edit"); }
  return m;
};

export const fetchStopsWithRouteFlag = async (conn: any, routeId: string) => {
  const escapedId = routeId.replace(/'/g, "''");
  return executeQuery(conn, `
    SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.location_type_name, s.parent_station,
           CASE WHEN rs.stop_id IS NOT NULL THEN true ELSE false END AS on_route
    FROM StopsView s
    LEFT JOIN RouteStopsTable rs ON rs.stop_id = s.stop_id AND rs.route_id = '${escapedId}'
  `);
};

export const fetchRouteStopsForShape = async (conn: any, routeId: string) => {
  const escapedId = routeId.replace(/'/g, "''");
  return executeQuery(conn, `
    SELECT DISTINCT s.stop_id, s.stop_name, CAST(s.stop_lat AS DOUBLE) AS stop_lat, CAST(s.stop_lon AS DOUBLE) AS stop_lon, s.location_type_name
    FROM RouteStopsView rs
    JOIN StopsView s ON s.stop_id = rs.stop_id
    WHERE rs.route_id = '${escapedId}' AND s.stop_lat IS NOT NULL AND s.stop_lon IS NOT NULL
  `);
};

export const fetchTripMapBounds = async (conn: any, tripId: string) => {
  const rows = await executeQuery(conn, `SELECT * FROM get_trip_map_bounds('${tripId.replace(/'/g, "''")}')`);
  return boundsRowToFit(rows[0]);
};

export const checkTripIdExists = async (conn: any, tripId: string) => {
  if (!tripId.trim()) return false;
  const rows = await executeQuery(conn, `SELECT 1 FROM TripsView WHERE trip_id = '${tripId.replace(/'/g, "''")}' LIMIT 1`);
  return rows.length > 0;
};

export const fetchTripsForService = async (conn: any, serviceId: string) => {
  const esc = serviceId.replace(/'/g, "''");
  return executeQuery(conn, `SELECT trip_id, route_id, service_id FROM TripsView WHERE service_id = '${esc}'`);
};

export const deleteServiceCascade = async (conn: any, serviceId: string, routeId: string) => {
  const esc = serviceId.replace(/'/g, "''");
  const tripsForService = await executeQuery(conn, `SELECT trip_id, route_id, service_id FROM TripsView WHERE service_id = '${esc}'`);
  for (const t of tripsForService) {
    const tid = String(t.trip_id).replace(/'/g, "''");
    const rid = String(t.route_id || routeId).replace(/'/g, "''");
    const sid = String(t.service_id || serviceId).replace(/'/g, "''");
    // Mark stop times as deleted
    await conn.query(`DELETE FROM EditStopTimesTable WHERE trip_id = '${tid}'`);
    try {
      await conn.query(`
        INSERT INTO EditStopTimesTable (row_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time, status)
        SELECT 'del_' || CAST(row_id AS VARCHAR), trip_id, stop_sequence, stop_id, arrival_time, departure_time, 'deleted'
        FROM stop_times WHERE trip_id = '${tid}'
      `);
    } catch { /* stop_times may not exist */ }
    // Mark trip as deleted
    await conn.query(`DELETE FROM EditTripsTable WHERE trip_id = '${tid}'`);
    await conn.query(`INSERT INTO EditTripsTable (row_id, route_id, service_id, trip_id, status) VALUES ('del_${tid}', '${rid}', '${sid}', '${tid}', 'deleted')`);
  }
  await deleteCalendar(conn, serviceId);
  await refreshMaterializedTable(conn, "TripsTable");
};

export const deleteTripCascade = async (conn: any, tripId: string) => {
  const tid = tripId.replace(/'/g, "''");
  // Remove any existing edit rows for this trip's stop times
  await conn.query(`DELETE FROM EditStopTimesTable WHERE trip_id = '${tid}'`);
  // Insert "deleted" markers for all original stop times
  try {
    await conn.query(`
      INSERT INTO EditStopTimesTable (row_id, trip_id, stop_sequence, stop_id, arrival_time, departure_time, status)
      SELECT 'del_' || CAST(row_id AS VARCHAR), trip_id, stop_sequence, stop_id, arrival_time, departure_time, 'deleted'
      FROM stop_times WHERE trip_id = '${tid}'
    `);
  } catch { /* stop_times table may not exist */ }
  await deleteTrip(conn, tripId);
};
