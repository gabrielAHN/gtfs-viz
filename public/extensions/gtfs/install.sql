-- ============================================================================
-- GTFS Extension for DuckDB v1.0.0
-- ============================================================================
--
-- Complete extension for GTFS data formatting and visualization
--
-- Usage:
--   .read gtfs/install.sql
--
-- This extension provides:
--   - GTFS enum macros (location types, wheelchair status, pathway modes)
--   - Data reformatting (adds row_id, human-readable columns)
--   - Table and view creation for data editing and visualization
--   - Pathway network initialization (if pathways exist)
--
-- ============================================================================


-- ============================================================================
-- STEP 1: GTFS Enum Macros
-- ============================================================================

-- location_type_to_name: Convert GTFS location_type integer to human-readable name
CREATE OR REPLACE MACRO location_type_to_name(location_type, parent_station) AS (
  CASE
    WHEN location_type = 0 AND COALESCE(parent_station, '') != '' THEN 'Platform'
    WHEN location_type = 0 THEN 'Stop'
    WHEN location_type = 1 THEN 'Station'
    WHEN location_type = 2 THEN 'Exit/Entrance'
    WHEN location_type = 3 THEN 'Pathway Node'
    WHEN location_type = 4 THEN 'Boarding Area'
    ELSE 'Unknown'
  END
);

-- wheelchair_to_emoji: Convert wheelchair_boarding integer to emoji status
CREATE OR REPLACE MACRO wheelchair_to_emoji(wheelchair_boarding) AS (
  CASE wheelchair_boarding
    WHEN 0 THEN '🔵'
    WHEN 1 THEN '🟢'
    WHEN 2 THEN '🔴'
    ELSE '🟡'
  END
);

-- pathway_mode_to_name: Convert pathway_mode integer to human-readable name
CREATE OR REPLACE MACRO pathway_mode_to_name(mode) AS (
  CASE mode
    WHEN 1 THEN 'Walkway'
    WHEN 2 THEN 'Stairs'
    WHEN 3 THEN 'Moving sidewalk/travelator'
    WHEN 4 THEN 'Escalator'
    WHEN 5 THEN 'Elevator'
    WHEN 6 THEN 'Fare gate'
    WHEN 7 THEN 'Exit gate'
    ELSE '❓'
  END
);

-- bidirectional_to_direction: Convert is_bidirectional integer to direction type
CREATE OR REPLACE MACRO bidirectional_to_direction(is_bidirectional) AS (
  CASE is_bidirectional
    WHEN 0 THEN 'directional'
    WHEN 1 THEN 'bidirectional'
    ELSE 'unknown'
  END
);


-- ============================================================================
-- STEP 2: Reformat Stops Table
-- ============================================================================

DROP TABLE IF EXISTS stops_temp;

ALTER TABLE stops ADD COLUMN IF NOT EXISTS parent_station VARCHAR;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS location_type INTEGER DEFAULT 0;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS wheelchair_boarding INTEGER DEFAULT 0;

CREATE TEMP TABLE stops_temp AS SELECT * FROM stops;
DROP TABLE stops;

CREATE TABLE stops AS
WITH stops_with_casts AS (
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
FROM stops_with_casts;

DROP TABLE stops_temp;

SELECT 'GTFS Extension: Stops table reformatted' as status;
