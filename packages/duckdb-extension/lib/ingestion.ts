/**
 * GTFS ingestion SQL generators.
 *
 * Generates SQL for importing and reformatting GTFS CSV files.
 * Used by both CLI (file paths) and web (registered file buffers).
 * Requires enum macros from GTFS_LOAD_SQL to be loaded first.
 */

import type { SqlExecutor } from "./installer.js";
import { installMacros, installInit } from "./installer.js";

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function getInitIndexesToSkip(opts: {
  routesPath?: string;
  tripsPath?: string;
  stopTimesPath?: string;
  shapesPath?: string;
  calendarPath?: string;
  calendarDatesPath?: string;
}): string[] {
  const indexes = new Set<string>();

  if (!opts.routesPath) {
    indexes.add("idx_routes_route_id");
    indexes.add("idx_edit_routes_route_id");
  }

  if (!opts.tripsPath) {
    indexes.add("idx_trips_route_id");
    indexes.add("idx_trips_service_id");
    indexes.add("idx_trips_trip_id");
    indexes.add("idx_trips_shape_id");
  }

  if (!opts.stopTimesPath) {
    indexes.add("idx_trips_trip_id");
    indexes.add("idx_stop_times_trip_id");
    indexes.add("idx_stop_times_stop_id");
  }

  if (!opts.shapesPath) {
    indexes.add("idx_trips_shape_id");
    indexes.add("idx_shapes_shape_id");
  }

  if (!opts.calendarPath && !opts.calendarDatesPath) {
    indexes.add("idx_trips_service_id");
    indexes.add("idx_calendar_service_id");
    indexes.add("idx_calendar_dates_service_id");
  }

  return Array.from(indexes);
}

/** SQL to drop existing GTFS tables/views before a fresh import. */
export function dropExistingSql(): string {
  return `
DROP TABLE IF EXISTS StopsTable;
DROP TABLE IF EXISTS StationsTable;
DROP TABLE IF EXISTS RoutesTable;
DROP TABLE IF EXISTS RouteStopsTable;
DROP VIEW IF EXISTS RouteShapesView;
DROP VIEW IF EXISTS RouteStopsView;
DROP VIEW IF EXISTS TripsView;
DROP VIEW IF EXISTS RoutesView;
DROP VIEW IF EXISTS pathway_network;
DROP VIEW IF EXISTS PathwaysView;
DROP VIEW IF EXISTS StopsView;
DROP TABLE IF EXISTS RouteShapeBandsTable;
DROP TABLE IF EXISTS RouteShapeLanesTable;
DROP TABLE IF EXISTS shapes;
DROP TABLE IF EXISTS stop_times;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS calendar_dates;
DROP TABLE IF EXISTS calendar;
DROP TABLE IF EXISTS stops;
DROP TABLE IF EXISTS pathways;
`;
}

/** SQL to import and reformat stops from a CSV source. */
export function importStopsSql(stopsPath: string): string {
  return `
CREATE OR REPLACE TEMP TABLE stops_raw AS SELECT * FROM read_csv_auto(${sqlString(stopsPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE stops_raw ADD COLUMN IF NOT EXISTS parent_station VARCHAR;
ALTER TABLE stops_raw ADD COLUMN IF NOT EXISTS level_id VARCHAR;
ALTER TABLE stops_raw ADD COLUMN IF NOT EXISTS location_type INTEGER DEFAULT 0;
ALTER TABLE stops_raw ADD COLUMN IF NOT EXISTS wheelchair_boarding INTEGER DEFAULT 0;
ALTER TABLE stops_raw ADD COLUMN IF NOT EXISTS row_id INTEGER;
ALTER TABLE stops_raw ADD COLUMN IF NOT EXISTS location_type_name VARCHAR;
ALTER TABLE stops_raw ADD COLUMN IF NOT EXISTS wheelchair_status VARCHAR;

CREATE TABLE stops AS
WITH stops_with_casts AS (
  SELECT
    *,
    TRY_CAST(stop_id AS VARCHAR) AS stop_id_casted,
    TRY_CAST(parent_station AS VARCHAR) AS parent_station_casted,
    TRY_CAST(stop_lat AS DOUBLE) AS stop_lat_casted,
    TRY_CAST(stop_lon AS DOUBLE) AS stop_lon_casted,
    COALESCE(TRY_CAST(location_type AS INTEGER), 0) AS location_type_coalesced,
    COALESCE(TRY_CAST(wheelchair_boarding AS INTEGER), 0) AS wheelchair_boarding_coalesced
  FROM stops_raw
)
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  COALESCE(stop_id_casted, CAST(stop_id AS VARCHAR)) AS stop_id,
  stop_name,
  stop_lat_casted AS stop_lat,
  stop_lon_casted AS stop_lon,
  COALESCE(parent_station_casted, TRY_CAST(parent_station AS VARCHAR)) AS parent_station,
  location_type_coalesced AS location_type,
  wheelchair_boarding_coalesced AS wheelchair_boarding,
  * EXCLUDE (
    row_id, stop_id, stop_name, stop_lat, stop_lon,
    parent_station, location_type, wheelchair_boarding,
    location_type_name, wheelchair_status,
    stop_id_casted, parent_station_casted, stop_lat_casted, stop_lon_casted,
    location_type_coalesced, wheelchair_boarding_coalesced
  ),
  location_type_to_name(location_type_coalesced, COALESCE(parent_station_casted, TRY_CAST(parent_station AS VARCHAR))) AS location_type_name,
  wheelchair_to_emoji(wheelchair_boarding_coalesced) AS wheelchair_status
FROM stops_with_casts;

DROP TABLE IF EXISTS stops_raw;
`;
}

/** SQL to import and reformat pathways from a CSV source. */
export function importPathwaysSql(pathwaysPath: string): string {
  return `
CREATE OR REPLACE TEMP TABLE pathways_raw AS SELECT * FROM read_csv_auto(${sqlString(pathwaysPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS pathway_mode INTEGER DEFAULT 1;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS is_bidirectional INTEGER DEFAULT 1;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS length DOUBLE;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS traversal_time INTEGER;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS stair_count INTEGER;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS max_slope DOUBLE;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS min_width DOUBLE;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS signposted_as VARCHAR;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS reversed_signposted_as VARCHAR;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS row_id INTEGER;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS pathway_mode_name VARCHAR;
ALTER TABLE pathways_raw ADD COLUMN IF NOT EXISTS direction_type VARCHAR;

CREATE TABLE pathways AS
WITH pathways_with_casts AS (
  SELECT
    *,
    TRY_CAST(pathway_id AS VARCHAR) AS pathway_id_casted,
    TRY_CAST(from_stop_id AS VARCHAR) AS from_stop_id_casted,
    TRY_CAST(to_stop_id AS VARCHAR) AS to_stop_id_casted,
    COALESCE(TRY_CAST(pathway_mode AS INTEGER), 1) AS pathway_mode_coalesced,
    COALESCE(TRY_CAST(is_bidirectional AS INTEGER), 1) AS is_bidirectional_coalesced,
    TRY_CAST(length AS DOUBLE) AS length_casted,
    TRY_CAST(traversal_time AS INTEGER) AS traversal_time_casted,
    TRY_CAST(stair_count AS INTEGER) AS stair_count_casted,
    TRY_CAST(max_slope AS DOUBLE) AS max_slope_casted,
    TRY_CAST(min_width AS DOUBLE) AS min_width_casted
  FROM pathways_raw
)
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  COALESCE(pathway_id_casted, CAST(pathway_id AS VARCHAR)) AS pathway_id,
  COALESCE(from_stop_id_casted, CAST(from_stop_id AS VARCHAR)) AS from_stop_id,
  COALESCE(to_stop_id_casted, CAST(to_stop_id AS VARCHAR)) AS to_stop_id,
  pathway_mode_coalesced AS pathway_mode,
  is_bidirectional_coalesced AS is_bidirectional,
  length_casted AS length,
  traversal_time_casted AS traversal_time,
  stair_count_casted AS stair_count,
  max_slope_casted AS max_slope,
  min_width_casted AS min_width,
  * EXCLUDE (
    row_id, pathway_id, from_stop_id, to_stop_id,
    pathway_mode, is_bidirectional, length, traversal_time, stair_count,
    max_slope, min_width, pathway_mode_name, direction_type,
    pathway_id_casted, from_stop_id_casted, to_stop_id_casted,
    pathway_mode_coalesced, is_bidirectional_coalesced, length_casted,
    traversal_time_casted, stair_count_casted, max_slope_casted,
    min_width_casted
  ),
  pathway_mode_to_name(pathway_mode_coalesced) AS pathway_mode_name,
  bidirectional_to_direction(is_bidirectional_coalesced) AS direction_type
FROM pathways_with_casts;

DROP TABLE IF EXISTS pathways_raw;
`;
}

/** SQL to create an empty pathways table (when no pathways.txt exists). */
export function emptyPathwaysSql(): string {
  return `
CREATE TABLE IF NOT EXISTS pathways (
  row_id INTEGER, pathway_id VARCHAR,
  from_stop_id VARCHAR, to_stop_id VARCHAR,
  pathway_mode INTEGER, is_bidirectional INTEGER,
  length DOUBLE, traversal_time INTEGER, stair_count INTEGER,
  max_slope DOUBLE, min_width DOUBLE,
  signposted_as VARCHAR, reversed_signposted_as VARCHAR,
  pathway_mode_name VARCHAR, direction_type VARCHAR
);
`;
}

export function importRoutesSql(routesPath: string): string {
  return `
CREATE OR REPLACE TEMP TABLE routes_raw AS SELECT * FROM read_csv_auto(${sqlString(routesPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_id VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS agency_id VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_short_name VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_long_name VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_desc VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_type INTEGER;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_url VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_color VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_text_color VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_sort_order INTEGER;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS row_id INTEGER;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_name VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_type_name VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_color_hex VARCHAR;
ALTER TABLE routes_raw ADD COLUMN IF NOT EXISTS route_text_color_hex VARCHAR;

CREATE TABLE routes AS
WITH routes_with_casts AS (
  SELECT
    *,
    TRY_CAST(route_id AS VARCHAR) AS route_id_casted,
    TRY_CAST(agency_id AS VARCHAR) AS agency_id_casted,
    TRY_CAST(route_short_name AS VARCHAR) AS route_short_name_casted,
    TRY_CAST(route_long_name AS VARCHAR) AS route_long_name_casted,
    TRY_CAST(route_desc AS VARCHAR) AS route_desc_casted,
    COALESCE(TRY_CAST(route_type AS INTEGER), 3) AS route_type_coalesced,
    TRY_CAST(route_url AS VARCHAR) AS route_url_casted,
    TRY_CAST(route_color AS VARCHAR) AS route_color_casted,
    TRY_CAST(route_text_color AS VARCHAR) AS route_text_color_casted,
    TRY_CAST(route_sort_order AS INTEGER) AS route_sort_order_casted
  FROM routes_raw
)
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  COALESCE(route_id_casted, CAST(route_id AS VARCHAR)) AS route_id,
  agency_id_casted AS agency_id,
  route_short_name_casted AS route_short_name,
  route_long_name_casted AS route_long_name,
  route_desc_casted AS route_desc,
  route_type_coalesced AS route_type,
  route_url_casted AS route_url,
  route_color_casted AS route_color,
  route_text_color_casted AS route_text_color,
  route_sort_order_casted AS route_sort_order,
  * EXCLUDE (
    row_id, route_id, agency_id, route_short_name, route_long_name, route_desc,
    route_type, route_url, route_color, route_text_color, route_sort_order,
    route_name, route_type_name, route_color_hex, route_text_color_hex,
    route_id_casted, agency_id_casted, route_short_name_casted,
    route_long_name_casted, route_desc_casted, route_type_coalesced,
    route_url_casted, route_color_casted, route_text_color_casted,
    route_sort_order_casted
  ),
  COALESCE(NULLIF(route_short_name_casted, ''), NULLIF(route_long_name_casted, ''), COALESCE(route_id_casted, CAST(route_id AS VARCHAR))) AS route_name,
  route_type_to_name(route_type_coalesced) AS route_type_name,
  gtfs_color_to_hex(route_color_casted, '#4f46e5') AS route_color_hex,
  gtfs_color_to_hex(route_text_color_casted, '#ffffff') AS route_text_color_hex
FROM routes_with_casts;

DROP TABLE IF EXISTS routes_raw;
`;
}

export function emptyRoutesSql(): string {
  return `
CREATE TABLE IF NOT EXISTS routes (
  row_id INTEGER, route_id VARCHAR, agency_id VARCHAR,
  route_short_name VARCHAR, route_long_name VARCHAR, route_desc VARCHAR,
  route_type INTEGER, route_url VARCHAR, route_color VARCHAR,
  route_text_color VARCHAR, route_sort_order INTEGER,
  route_name VARCHAR, route_type_name VARCHAR,
  route_color_hex VARCHAR, route_text_color_hex VARCHAR
);
`;
}

export function importTripsSql(tripsPath: string): string {
  return `
CREATE OR REPLACE TEMP TABLE trips_raw AS SELECT * FROM read_csv_auto(${sqlString(tripsPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS route_id VARCHAR;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS service_id VARCHAR;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS trip_id VARCHAR;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS trip_headsign VARCHAR;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS trip_short_name VARCHAR;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS direction_id INTEGER;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS block_id VARCHAR;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS shape_id VARCHAR;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS wheelchair_accessible INTEGER;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS bikes_allowed INTEGER;
ALTER TABLE trips_raw ADD COLUMN IF NOT EXISTS row_id INTEGER;

CREATE TABLE trips AS
WITH trips_with_casts AS (
  SELECT
    *,
    TRY_CAST(route_id AS VARCHAR) AS route_id_casted,
    TRY_CAST(service_id AS VARCHAR) AS service_id_casted,
    TRY_CAST(trip_id AS VARCHAR) AS trip_id_casted,
    TRY_CAST(trip_headsign AS VARCHAR) AS trip_headsign_casted,
    TRY_CAST(trip_short_name AS VARCHAR) AS trip_short_name_casted,
    TRY_CAST(direction_id AS INTEGER) AS direction_id_casted,
    TRY_CAST(block_id AS VARCHAR) AS block_id_casted,
    TRY_CAST(shape_id AS VARCHAR) AS shape_id_casted,
    TRY_CAST(wheelchair_accessible AS INTEGER) AS wheelchair_accessible_casted,
    TRY_CAST(bikes_allowed AS INTEGER) AS bikes_allowed_casted
  FROM trips_raw
)
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  COALESCE(route_id_casted, CAST(route_id AS VARCHAR)) AS route_id,
  service_id_casted AS service_id,
  COALESCE(trip_id_casted, CAST(trip_id AS VARCHAR)) AS trip_id,
  trip_headsign_casted AS trip_headsign,
  trip_short_name_casted AS trip_short_name,
  direction_id_casted AS direction_id,
  block_id_casted AS block_id,
  shape_id_casted AS shape_id,
  wheelchair_accessible_casted AS wheelchair_accessible,
  bikes_allowed_casted AS bikes_allowed,
  * EXCLUDE (
    row_id, route_id, service_id, trip_id, trip_headsign, trip_short_name,
    direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed,
    route_id_casted, service_id_casted, trip_id_casted, trip_headsign_casted,
    trip_short_name_casted, direction_id_casted, block_id_casted,
    shape_id_casted, wheelchair_accessible_casted, bikes_allowed_casted
  )
FROM trips_with_casts;

DROP TABLE IF EXISTS trips_raw;
`;
}

export function emptyTripsSql(): string {
  return `
CREATE TABLE IF NOT EXISTS trips (
  row_id INTEGER, route_id VARCHAR, service_id VARCHAR, trip_id VARCHAR,
  trip_headsign VARCHAR, trip_short_name VARCHAR, direction_id INTEGER,
  block_id VARCHAR, shape_id VARCHAR, wheelchair_accessible INTEGER,
  bikes_allowed INTEGER
);
`;
}

export function importStopTimesSql(stopTimesPath: string): string {
  return `
CREATE TABLE stop_times AS SELECT * FROM read_csv_auto(${sqlString(stopTimesPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS trip_id VARCHAR;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS arrival_time VARCHAR;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS departure_time VARCHAR;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS stop_id VARCHAR;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS stop_sequence INTEGER;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS stop_headsign VARCHAR;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS pickup_type INTEGER;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS drop_off_type INTEGER;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS shape_dist_traveled DOUBLE;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS timepoint INTEGER;
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS row_id INTEGER;

CREATE TEMP TABLE stop_times_temp AS SELECT * FROM stop_times;
DROP TABLE stop_times;

CREATE TABLE stop_times AS
WITH stop_times_with_casts AS (
  SELECT
    *,
    TRY_CAST(trip_id AS VARCHAR) AS trip_id_casted,
    TRY_CAST(arrival_time AS VARCHAR) AS arrival_time_casted,
    TRY_CAST(departure_time AS VARCHAR) AS departure_time_casted,
    TRY_CAST(stop_id AS VARCHAR) AS stop_id_casted,
    TRY_CAST(stop_sequence AS INTEGER) AS stop_sequence_casted,
    TRY_CAST(stop_headsign AS VARCHAR) AS stop_headsign_casted,
    TRY_CAST(pickup_type AS INTEGER) AS pickup_type_casted,
    TRY_CAST(drop_off_type AS INTEGER) AS drop_off_type_casted,
    TRY_CAST(shape_dist_traveled AS DOUBLE) AS shape_dist_traveled_casted,
    TRY_CAST(timepoint AS INTEGER) AS timepoint_casted
  FROM stop_times_temp
)
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  COALESCE(trip_id_casted, CAST(trip_id AS VARCHAR)) AS trip_id,
  arrival_time_casted AS arrival_time,
  departure_time_casted AS departure_time,
  COALESCE(stop_id_casted, CAST(stop_id AS VARCHAR)) AS stop_id,
  COALESCE(stop_sequence_casted, 0) AS stop_sequence,
  stop_headsign_casted AS stop_headsign,
  pickup_type_casted AS pickup_type,
  drop_off_type_casted AS drop_off_type,
  shape_dist_traveled_casted AS shape_dist_traveled,
  timepoint_casted AS timepoint,
  * EXCLUDE (
    row_id, trip_id, arrival_time, departure_time, stop_id, stop_sequence,
    stop_headsign, pickup_type, drop_off_type, shape_dist_traveled, timepoint,
    trip_id_casted, arrival_time_casted, departure_time_casted,
    stop_id_casted, stop_sequence_casted, stop_headsign_casted,
    pickup_type_casted, drop_off_type_casted, shape_dist_traveled_casted,
    timepoint_casted
  )
FROM stop_times_with_casts;

DROP TABLE IF EXISTS stop_times_temp;
`;
}

export function emptyStopTimesSql(): string {
  return `
CREATE TABLE IF NOT EXISTS stop_times (
  row_id INTEGER, trip_id VARCHAR, arrival_time VARCHAR, departure_time VARCHAR,
  stop_id VARCHAR, stop_sequence INTEGER, stop_headsign VARCHAR,
  pickup_type INTEGER, drop_off_type INTEGER, shape_dist_traveled DOUBLE,
  timepoint INTEGER
);
`;
}

export function importShapesSql(shapesPath: string): string {
  return `
CREATE TABLE shapes AS SELECT * FROM read_csv_auto(${sqlString(shapesPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE shapes ADD COLUMN IF NOT EXISTS shape_id VARCHAR;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS shape_pt_lat DOUBLE;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS shape_pt_lon DOUBLE;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS shape_pt_sequence INTEGER;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS shape_dist_traveled DOUBLE;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS row_id INTEGER;

CREATE TEMP TABLE shapes_temp AS SELECT * FROM shapes;
DROP TABLE shapes;

CREATE TABLE shapes AS
WITH shapes_with_casts AS (
  SELECT
    *,
    TRY_CAST(shape_id AS VARCHAR) AS shape_id_casted,
    TRY_CAST(shape_pt_lat AS DOUBLE) AS shape_pt_lat_casted,
    TRY_CAST(shape_pt_lon AS DOUBLE) AS shape_pt_lon_casted,
    TRY_CAST(shape_pt_sequence AS INTEGER) AS shape_pt_sequence_casted,
    TRY_CAST(shape_dist_traveled AS DOUBLE) AS shape_dist_traveled_casted
  FROM shapes_temp
)
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  COALESCE(shape_id_casted, CAST(shape_id AS VARCHAR)) AS shape_id,
  shape_pt_lat_casted AS shape_pt_lat,
  shape_pt_lon_casted AS shape_pt_lon,
  COALESCE(shape_pt_sequence_casted, 0) AS shape_pt_sequence,
  shape_dist_traveled_casted AS shape_dist_traveled,
  * EXCLUDE (
    row_id, shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence,
    shape_dist_traveled, shape_id_casted, shape_pt_lat_casted,
    shape_pt_lon_casted, shape_pt_sequence_casted, shape_dist_traveled_casted
  )
FROM shapes_with_casts;

DROP TABLE IF EXISTS shapes_temp;
`;
}

export function emptyShapesSql(): string {
  return `
CREATE TABLE IF NOT EXISTS shapes (
  row_id INTEGER, shape_id VARCHAR, shape_pt_lat DOUBLE,
  shape_pt_lon DOUBLE, shape_pt_sequence INTEGER, shape_dist_traveled DOUBLE
);
`;
}

/** Add GEOMETRY columns to stops and shapes tables. Requires spatial extension. */
export function addGeomColumnsSql(): string {
  return `
ALTER TABLE stops ADD COLUMN IF NOT EXISTS geom GEOMETRY;
UPDATE stops SET geom = ST_Point(stop_lon, stop_lat) WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL AND geom IS NULL;
ALTER TABLE shapes ADD COLUMN IF NOT EXISTS geom GEOMETRY;
UPDATE shapes SET geom = ST_Point(shape_pt_lon, shape_pt_lat) WHERE shape_pt_lat IS NOT NULL AND shape_pt_lon IS NOT NULL AND geom IS NULL;
`;
}

export function importCalendarSql(calendarPath: string): string {
  return `
CREATE TABLE calendar AS SELECT * FROM read_csv_auto(${sqlString(calendarPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE calendar ADD COLUMN IF NOT EXISTS service_id VARCHAR;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS monday INTEGER;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS tuesday INTEGER;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS wednesday INTEGER;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS thursday INTEGER;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS friday INTEGER;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS saturday INTEGER;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS sunday INTEGER;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS start_date VARCHAR;
ALTER TABLE calendar ADD COLUMN IF NOT EXISTS end_date VARCHAR;

CREATE TEMP TABLE calendar_temp AS SELECT * FROM calendar;
DROP TABLE calendar;

CREATE TABLE calendar AS
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  TRY_CAST(service_id AS VARCHAR) AS service_id,
  COALESCE(TRY_CAST(monday AS INTEGER), 0) AS monday,
  COALESCE(TRY_CAST(tuesday AS INTEGER), 0) AS tuesday,
  COALESCE(TRY_CAST(wednesday AS INTEGER), 0) AS wednesday,
  COALESCE(TRY_CAST(thursday AS INTEGER), 0) AS thursday,
  COALESCE(TRY_CAST(friday AS INTEGER), 0) AS friday,
  COALESCE(TRY_CAST(saturday AS INTEGER), 0) AS saturday,
  COALESCE(TRY_CAST(sunday AS INTEGER), 0) AS sunday,
  TRY_CAST(start_date AS VARCHAR) AS start_date,
  TRY_CAST(end_date AS VARCHAR) AS end_date
FROM calendar_temp;

DROP TABLE IF EXISTS calendar_temp;
`;
}

export function emptyCalendarSql(): string {
  return `
CREATE TABLE IF NOT EXISTS calendar (
  row_id INTEGER, service_id VARCHAR, monday INTEGER, tuesday INTEGER,
  wednesday INTEGER, thursday INTEGER, friday INTEGER, saturday INTEGER,
  sunday INTEGER, start_date VARCHAR, end_date VARCHAR
);
`;
}

export function importCalendarDatesSql(calendarDatesPath: string): string {
  return `
CREATE TABLE calendar_dates AS SELECT * FROM read_csv_auto(${sqlString(calendarDatesPath)}, all_varchar=true, null_padding=true, quote='"', ignore_errors=true);

ALTER TABLE calendar_dates ADD COLUMN IF NOT EXISTS service_id VARCHAR;
ALTER TABLE calendar_dates ADD COLUMN IF NOT EXISTS date VARCHAR;
ALTER TABLE calendar_dates ADD COLUMN IF NOT EXISTS exception_type INTEGER;

CREATE TEMP TABLE calendar_dates_temp AS SELECT * FROM calendar_dates;
DROP TABLE calendar_dates;

CREATE TABLE calendar_dates AS
SELECT
  CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
  TRY_CAST(service_id AS VARCHAR) AS service_id,
  TRY_CAST(date AS VARCHAR) AS date,
  TRY_CAST(exception_type AS INTEGER) AS exception_type
FROM calendar_dates_temp;

DROP TABLE IF EXISTS calendar_dates_temp;
`;
}

export function emptyCalendarDatesSql(): string {
  return `
CREATE TABLE IF NOT EXISTS calendar_dates (
  row_id INTEGER, service_id VARCHAR, date VARCHAR, exception_type INTEGER
);
`;
}

/**
 * Build the full import SQL: macros → drop → CSV import → extension init.
 * Used by CLI to pipe to DuckDB as a single SQL file.
 */
export function buildImportSql(opts: {
  stopsPath: string;
  pathwaysPath?: string;
  routesPath?: string;
  tripsPath?: string;
  stopTimesPath?: string;
  shapesPath?: string;
  calendarPath?: string;
  calendarDatesPath?: string;
}): string {
  return [
    importStopsSql(opts.stopsPath),
    opts.pathwaysPath ? importPathwaysSql(opts.pathwaysPath) : emptyPathwaysSql(),
    opts.routesPath ? importRoutesSql(opts.routesPath) : emptyRoutesSql(),
    opts.tripsPath ? importTripsSql(opts.tripsPath) : emptyTripsSql(),
    opts.stopTimesPath ? importStopTimesSql(opts.stopTimesPath) : emptyStopTimesSql(),
    opts.shapesPath ? importShapesSql(opts.shapesPath) : emptyShapesSql(),
    opts.calendarPath ? importCalendarSql(opts.calendarPath) : emptyCalendarSql(),
    opts.calendarDatesPath
      ? importCalendarDatesSql(opts.calendarDatesPath)
      : emptyCalendarDatesSql(),
  ].join("\n");
}

/**
 * Run full GTFS import via executor: macros → drop → import → init.
 * Used by web to run through DuckDB WASM connection.
 */
export async function importGtfs(
  executor: SqlExecutor,
  opts: {
    stopsPath: string;
    pathwaysPath?: string;
    routesPath?: string;
    tripsPath?: string;
    stopTimesPath?: string;
    shapesPath?: string;
    calendarPath?: string;
    calendarDatesPath?: string;
    skipDrop?: boolean;
    onCsvImported?: () => Promise<void>;
    onProgress?: (progress: ImportProgress) => void;
  },
): Promise<void> {
  const report = (phase: ImportProgress["phase"], done: number, total: number, detail?: string) =>
    opts.onProgress?.({ phase, done, total, detail });

  // 1. Install enum macros + edit tables
  report("macros", 0, 1);
  await installMacros(executor);
  report("macros", 1, 1);

  // 2. Drop existing views/tables
  if (!opts.skipDrop) {
    const dropStmts = dropExistingSql()
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (let i = 0; i < dropStmts.length; i++) {
      await executor(dropStmts[i]);
      report("drop", i + 1, dropStmts.length);
    }
  }

  // 3. Import and reformat CSV data
  const importSql = buildImportSql(opts);
  const stmts = importSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || s.length === 0) return false;
      const lines = s.split("\n").filter((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith("--");
      });
      return lines.length > 0;
    });
  for (let i = 0; i < stmts.length; i++) {
    report("import", i, stmts.length, importStatementDetail(stmts[i]));
    await executor(stmts[i]);
  }
  report("import", stmts.length, stmts.length);

  if (opts.onCsvImported) {
    await opts.onCsvImported();
  }

  await installInit(executor, {
    skipIndexes: getInitIndexesToSkip(opts),
    onProgress: (done, total, stmt) => report("init", done, total, initStatementDetail(stmt)),
  });
}

export type ImportProgress = {
  phase: "macros" | "drop" | "import" | "init";
  done: number;
  total: number;
  detail?: string;
};

function importStatementDetail(stmt: string): string | undefined {
  const csv = stmt.match(/read_csv_auto\('([^']+)'/i);
  if (csv) return csv[1].split("/").pop();
  const table = stmt.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
  if (table) return table[1].replace(/_(raw|temp)$/, "") + ".txt";
  const alter = stmt.match(/ALTER\s+TABLE\s+(\w+)/i);
  if (alter) return alter[1] + ".txt";
  return undefined;
}

function initStatementDetail(stmt: string): string | undefined {
  const first = stmt
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("--")) ?? "";
  const m = first.match(
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?(VIEW|MACRO|TABLE|INDEX|UNIQUE\s+INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i,
  );
  if (m) return `${m[1].toLowerCase()} ${m[2]}`;
  const ins = first.match(/INSERT\s+INTO\s+(\w+)/i);
  if (ins) return `table ${ins[1]}`;
  return undefined;
}
