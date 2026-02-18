

-- Note: Requires gtfs_enums macros to be loaded first

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

DROP TABLE IF EXISTS pathways_temp;

ALTER TABLE pathways ADD COLUMN IF NOT EXISTS pathway_mode INTEGER DEFAULT 1;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS is_bidirectional INTEGER DEFAULT 1;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS length DOUBLE;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS traversal_time INTEGER;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS stair_count INTEGER;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS max_slope DOUBLE;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS min_width DOUBLE;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS signposted_as VARCHAR;
ALTER TABLE pathways ADD COLUMN IF NOT EXISTS reversed_signposted_as VARCHAR;

CREATE TEMP TABLE pathways_temp AS SELECT * FROM pathways;
DROP TABLE pathways;

CREATE TABLE pathways AS
WITH pathways_with_casts AS (
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
FROM pathways_with_casts;

DROP TABLE pathways_temp;
