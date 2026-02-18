

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

CREATE OR REPLACE MACRO bidirectional_to_direction(is_bidirectional) AS (
  CASE is_bidirectional
    WHEN 0 THEN 'directional'
    WHEN 1 THEN 'bidirectional'
    ELSE 'unknown'
  END
);

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

CREATE OR REPLACE MACRO wheelchair_to_emoji(wheelchair_boarding) AS (
  CASE wheelchair_boarding
    WHEN 0 THEN '🔵'
    WHEN 1 THEN '🟢'
    WHEN 2 THEN '🔴'
    ELSE '🟡'
  END
);
