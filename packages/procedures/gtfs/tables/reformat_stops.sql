

CREATE OR REPLACE MACRO reformat_stops_table() AS TABLE (
  SELECT
    ROW_NUMBER() OVER () AS row_id,
    *,
    location_type_to_name(location_type, parent_station) AS location_type_name,
    wheelchair_to_emoji(wheelchair_boarding) AS wheelchair_status
  FROM stops
);
