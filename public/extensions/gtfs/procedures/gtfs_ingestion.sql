-- ============================================================================
-- GTFS Ingestion Macros
-- ============================================================================
--
-- Macros for importing and reformatting GTFS data
-- Used by the app's ingestion workflow
--
-- ============================================================================

-- Import stops from registered file
CREATE OR REPLACE MACRO gtfs_import_stops() AS (
  CREATE TABLE IF NOT EXISTS stops AS
  SELECT * FROM read_csv_auto('stops.txt')
);

-- Import pathways from registered file (optional)
CREATE OR REPLACE MACRO gtfs_import_pathways() AS (
  CREATE TABLE IF NOT EXISTS pathways AS
  SELECT * FROM read_csv_auto('pathways.txt')
);

-- Reformat stops table (add row_id, location_type_name, wheelchair_status)
CREATE OR REPLACE MACRO gtfs_reformat_stops() AS TABLE (
  WITH stops_temp AS (SELECT * FROM stops),
  stops_with_casts AS (
    SELECT
      *,
      TRY_CAST(stop_id AS VARCHAR) AS stop_id_casted,
      TRY_CAST(parent_station AS VARCHAR) AS parent_station_casted,
      COALESCE(TRY_CAST(location_type AS INTEGER), 0) AS location_type_coalesced,
      COALESCE(TRY_CAST(wheelchair_boarding AS INTEGER), 0) AS wheelchair_boarding_coalesced
    FROM stops_temp
  )
  SELECT
    CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
    COALESCE(stop_id_casted, CAST(stop_id AS VARCHAR)) AS stop_id,
    stop_name,
    stop_lat,
    stop_lon,
    COALESCE(parent_station_casted, TRY_CAST(parent_station AS VARCHAR)) AS parent_station,
    location_type_coalesced AS location_type,
    wheelchair_boarding_coalesced AS wheelchair_boarding,
    * EXCLUDE (stop_id, parent_station, location_type, wheelchair_boarding,
               stop_id_casted, parent_station_casted, location_type_coalesced, wheelchair_boarding_coalesced),
    location_type_to_name(location_type_coalesced, COALESCE(parent_station_casted, TRY_CAST(parent_station AS VARCHAR))) AS location_type_name,
    wheelchair_to_emoji(wheelchair_boarding_coalesced) AS wheelchair_status
  FROM stops_with_casts
);

-- Reformat pathways table (add row_id, pathway_mode_name, direction_type)
CREATE OR REPLACE MACRO gtfs_reformat_pathways() AS TABLE (
  WITH pathways_temp AS (SELECT * FROM pathways),
  pathways_with_casts AS (
    SELECT
      *,
      TRY_CAST(pathway_id AS VARCHAR) AS pathway_id_casted,
      TRY_CAST(from_stop_id AS VARCHAR) AS from_stop_id_casted,
      TRY_CAST(to_stop_id AS VARCHAR) AS to_stop_id_casted,
      COALESCE(TRY_CAST(pathway_mode AS INTEGER), 1) AS pathway_mode_coalesced,
      COALESCE(TRY_CAST(is_bidirectional AS INTEGER), 1) AS is_bidirectional_coalesced
    FROM pathways_temp
  )
  SELECT
    CAST(ROW_NUMBER() OVER () AS INTEGER) AS row_id,
    COALESCE(pathway_id_casted, CAST(pathway_id AS VARCHAR)) AS pathway_id,
    COALESCE(from_stop_id_casted, CAST(from_stop_id AS VARCHAR)) AS from_stop_id,
    COALESCE(to_stop_id_casted, CAST(to_stop_id AS VARCHAR)) AS to_stop_id,
    pathway_mode_coalesced AS pathway_mode,
    is_bidirectional_coalesced AS is_bidirectional,
    * EXCLUDE (pathway_id, from_stop_id, to_stop_id, pathway_mode, is_bidirectional,
               pathway_id_casted, from_stop_id_casted, to_stop_id_casted,
               pathway_mode_coalesced, is_bidirectional_coalesced),
    pathway_mode_to_name(pathway_mode_coalesced) AS pathway_mode_name,
    bidirectional_to_direction(is_bidirectional_coalesced) AS direction_type
  FROM pathways_with_casts
);

-- Create edit tables (placeholder for EditStopTable)
CREATE OR REPLACE MACRO gtfs_create_edit_tables() AS (
  CREATE TABLE IF NOT EXISTS EditStopTable (
    stop_id VARCHAR PRIMARY KEY,
    edit_type VARCHAR,
    original_stop_name VARCHAR,
    new_stop_name VARCHAR,
    original_location_type INTEGER,
    new_location_type INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
);

-- Create StopsView (combines stops with edits)
CREATE OR REPLACE MACRO gtfs_create_stops_view() AS (
  CREATE OR REPLACE VIEW StopsView AS
  SELECT
    s.*,
    e.new_stop_name,
    e.new_location_type
  FROM stops s
  LEFT JOIN EditStopTable e ON s.stop_id = e.stop_id
);

-- Validate imported data
CREATE OR REPLACE MACRO gtfs_validate_data() AS TABLE (
  SELECT
    'stops' AS table_name,
    COUNT(*) AS row_count,
    COUNT(DISTINCT stop_id) AS unique_ids,
    SUM(CASE WHEN location_type = 0 THEN 1 ELSE 0 END) AS stops_count,
    SUM(CASE WHEN location_type = 1 THEN 1 ELSE 0 END) AS stations_count
  FROM stops
);

SELECT 'GTFS Ingestion macros loaded' AS status;
