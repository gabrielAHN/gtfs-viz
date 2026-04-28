

CREATE OR REPLACE MACRO reformat_pathways_table() AS TABLE (
  SELECT
    ROW_NUMBER() OVER () AS row_id,
    p.*,
    from_stops.parent_station AS from_parent_station,
    from_stops.stop_lat AS from_lat,
    from_stops.stop_lon AS from_lon,
    from_stops.location_type_name AS from_location_type_name,
    to_stops.stop_lat AS to_lat,
    to_stops.stop_lon AS to_lon,
    to_stops.parent_station AS to_parent_station,
    to_stops.location_type_name AS to_location_type_name,
    p.pathway_mode,
    pathway_mode_to_name(p.pathway_mode) AS pathway_mode_name,
    p.is_bidirectional,
    bidirectional_to_direction(p.is_bidirectional) AS direction_type
  FROM pathways p
  JOIN stops from_stops
    ON p.from_stop_id = from_stops.stop_id
  JOIN stops to_stops
    ON p.to_stop_id = to_stops.stop_id
);
