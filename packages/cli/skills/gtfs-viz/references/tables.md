# GTFS Extension — Table & View Reference

## Base Tables (after GTFS import)

### stops

| Column              | Type    | Description                                  |
| ------------------- | ------- | -------------------------------------------- |
| row_id              | INTEGER | Auto-generated row number                    |
| stop_id             | VARCHAR | Unique stop identifier from GTFS             |
| stop_name           | VARCHAR | Stop display name                            |
| stop_lat            | DOUBLE  | Latitude                                     |
| stop_lon            | DOUBLE  | Longitude                                    |
| parent_station      | VARCHAR | Parent station stop_id (NULL for standalone)  |
| location_type       | INTEGER | GTFS location type (0-4)                     |
| wheelchair_boarding | INTEGER | Wheelchair accessibility (0-2)               |
| location_type_name  | VARCHAR | Human name: Station, Stop, Exit/Entrance, etc. |
| wheelchair_status   | VARCHAR | Emoji indicator                              |
| level_id            | VARCHAR | Level identifier                             |
| geom                | GEOMETRY | Point geometry (ST_Point(lon, lat))          |

### routes

| Column              | Type    | Description                                  |
| ------------------- | ------- | -------------------------------------------- |
| row_id              | INTEGER | Auto-generated row number                    |
| route_id            | VARCHAR | Unique route identifier from GTFS            |
| agency_id           | VARCHAR | Agency identifier                            |
| route_short_name    | VARCHAR | Short route name (e.g. "M1")                 |
| route_long_name     | VARCHAR | Full route name                              |
| route_desc          | VARCHAR | Route description                            |
| route_type          | INTEGER | GTFS route type (0-12)                       |
| route_url           | VARCHAR | Route URL                                    |
| route_color         | VARCHAR | Route color hex (no #)                       |
| route_text_color    | VARCHAR | Route text color hex (no #)                  |
| route_sort_order    | INTEGER | Sort order                                   |

### shapes

| Column              | Type    | Description                                  |
| ------------------- | ------- | -------------------------------------------- |
| row_id              | INTEGER | Auto-generated row number                    |
| shape_id            | VARCHAR | Shape identifier                             |
| shape_pt_lat        | DOUBLE  | Point latitude                               |
| shape_pt_lon        | DOUBLE  | Point longitude                              |
| shape_pt_sequence   | INTEGER | Point sequence number                        |
| shape_dist_traveled | DOUBLE  | Distance traveled                            |
| geom                | GEOMETRY | Point geometry (ST_Point(lon, lat))          |

### pathways

| Column                  | Type    | Description                          |
| ----------------------- | ------- | ------------------------------------ |
| row_id                  | INTEGER | Auto-generated row number            |
| pathway_id              | VARCHAR | Unique pathway identifier            |
| from_stop_id            | VARCHAR | Source stop/node ID                  |
| to_stop_id              | VARCHAR | Target stop/node ID                  |
| pathway_mode            | INTEGER | Mode (1-7)                           |
| is_bidirectional        | INTEGER | 0=directional, 1=bidirectional       |
| length                  | DOUBLE  | Length in meters                     |
| traversal_time          | INTEGER | Time in seconds                      |
| stair_count             | INTEGER | Number of stairs                     |
| max_slope               | DOUBLE  | Maximum slope ratio                  |
| min_width               | DOUBLE  | Minimum width in meters              |
| signposted_as           | VARCHAR | Signposted name                     |
| reversed_signposted_as  | VARCHAR | Reversed signposted name             |
| pathway_mode_name       | VARCHAR | Human name: Walkway, Stairs, etc.    |
| direction_type          | VARCHAR | bidirectional or directional         |

## Views

### StopsView

Combines `stops` with edits from `EditStopTable`. Edited/new rows override originals; deleted rows are excluded.

| Column             | Type    |
| ------------------ | ------- |
| row_id             | TEXT    |
| stop_id            | TEXT    |
| stop_name          | TEXT    |
| stop_lat           | DOUBLE  |
| stop_lon           | DOUBLE  |
| location_type_name | TEXT    |
| parent_station     | TEXT    |
| level_id           | TEXT    |
| wheelchair_status  | TEXT    |
| status             | TEXT    |

### RoutesView

Combines `routes` with edits from `EditRouteTable`. Edited/new routes override originals; deleted routes are excluded.

| Column              | Type    |
| ------------------- | ------- |
| row_id              | TEXT    |
| route_id            | TEXT    |
| route_short_name    | TEXT    |
| route_long_name     | TEXT    |
| route_type          | INTEGER |
| route_name          | TEXT    |
| route_type_name     | TEXT    |
| route_color_hex     | TEXT    |
| route_text_color_hex| TEXT    |
| shape_points_json   | TEXT    |
| status              | TEXT    |

### RoutesTable

Materialized table with route stop/trip counts.

| Column              | Type    |
| ------------------- | ------- |
| *(all RoutesView)*  |         |
| stop_count          | INTEGER |
| station_count       | INTEGER |
| shape_count         | INTEGER |
| trip_count          | INTEGER |

### TripsView

Trips filtered to exclude deleted routes.

### PathwaysView

Combines `pathways` with edits from `EditPathwayTable`.

| Column                 | Type    |
| ---------------------- | ------- |
| row_id                 | INTEGER |
| pathway_id             | TEXT    |
| from_stop_id           | TEXT    |
| to_stop_id             | TEXT    |
| pathway_mode           | INTEGER |
| is_bidirectional       | INTEGER |
| length                 | DOUBLE  |
| traversal_time         | INTEGER |
| stair_count            | INTEGER |
| max_slope              | DOUBLE  |
| min_width              | DOUBLE  |
| signposted_as          | TEXT    |
| reversed_signposted_as | TEXT    |
| pathway_mode_name      | TEXT    |
| direction_type         | TEXT    |
| status                 | TEXT    |

### pathway_network

Enriched pathway view with stop coordinates and bearing angles. Joins `pathways` with `stops` on both endpoints.

| Column                 | Type    |
| ---------------------- | ------- |
| *(all pathways cols)*  |         |
| from_parent_station    | VARCHAR |
| from_lat               | DOUBLE  |
| from_lon               | DOUBLE  |
| from_location_type_name| VARCHAR |
| to_parent_station      | VARCHAR |
| to_lat                 | DOUBLE  |
| to_lon                 | DOUBLE  |
| to_location_type_name  | VARCHAR |
| angle                  | DOUBLE  |

## Materialized Tables

### StationsTable

Stations only (location_type = Station), with aggregated metadata.

| Column             | Type    | Description                              |
| ------------------ | ------- | ---------------------------------------- |
| row_id             | TEXT    |                                          |
| stop_id            | TEXT    | Station ID                               |
| stop_name          | TEXT    | Station name                             |
| stop_lat           | DOUBLE  |                                          |
| stop_lon           | DOUBLE  |                                          |
| status             | TEXT    |                                          |
| exit_count         | INTEGER | Number of Exit/Entrance children         |
| location_type_name | TEXT    | Always "Station"                         |
| parent_station     | TEXT    |                                          |
| wheelchair_status  | TEXT    |                                          |
| pathways_status    | VARCHAR | Connectivity emoji (see below)           |

`pathways_status` values: `✅` all exits connected, `🟡` partially connected, `❌` no pathways.

### StopsTable

Standalone stops only (non-Station, no parent_station).

| Column             | Type   |
| ------------------ | ------ |
| row_id             | TEXT   |
| stop_id            | TEXT   |
| stop_name          | TEXT   |
| stop_lat           | DOUBLE |
| stop_lon           | DOUBLE |
| status             | TEXT   |
| location_type_name | TEXT   |
| parent_station     | TEXT   |
| level_id           | TEXT   |
| wheelchair_status  | TEXT   |

## Edit Tables

### EditStopTable

Tracks stop/node edits. Status: `new`, `edit`, `new edit`, `deleted`.

| Column             | Type             |
| ------------------ | ---------------- |
| row_id             | TEXT             |
| stop_id            | TEXT             |
| stop_name          | TEXT             |
| stop_lat           | DOUBLE PRECISION |
| stop_lon           | DOUBLE PRECISION |
| location_type_name | TEXT             |
| parent_station     | TEXT             |
| level_id           | TEXT             |
| wheelchair_status  | TEXT             |
| status             | TEXT             |

### EditPathwayTable

Tracks pathway/connection edits. Status: `new`, `edit`, `new edit`, `deleted`.

| Column                 | Type    |
| ---------------------- | ------- |
| row_id                 | INTEGER |
| pathway_id             | TEXT    |
| from_stop_id           | TEXT    |
| to_stop_id             | TEXT    |
| pathway_mode           | INTEGER |
| is_bidirectional       | INTEGER |
| length                 | DOUBLE  |
| traversal_time         | INTEGER |
| stair_count            | INTEGER |
| max_slope              | DOUBLE  |
| min_width              | DOUBLE  |
| signposted_as          | TEXT    |
| reversed_signposted_as | TEXT    |
| status                 | TEXT    |

### EditStopTimesTable

Tracks stop time edits for trips. Status: `new`, `edit`, `new edit`, `deleted`.

| Column         | Type    |
| -------------- | ------- |
| trip_id        | TEXT    |
| stop_sequence  | INTEGER |
| stop_id        | TEXT    |
| arrival_time   | TEXT    |
| departure_time | TEXT    |
| stop_headsign  | TEXT    |
| pickup_type    | INTEGER |
| drop_off_type  | INTEGER |
| status         | TEXT    |

### EditCalendarTable

Tracks calendar/service edits. Status: `new`, `edit`, `new edit`, `deleted`.

| Column     | Type    |
| ---------- | ------- |
| service_id | TEXT    |
| monday     | INTEGER |
| tuesday    | INTEGER |
| wednesday  | INTEGER |
| thursday   | INTEGER |
| friday     | INTEGER |
| saturday   | INTEGER |
| sunday     | INTEGER |
| start_date | TEXT    |
| end_date   | TEXT    |
| status     | TEXT    |

### EditTripsTable

Tracks trip edits. Status: `new`, `edit`, `new edit`, `deleted`.

| Column       | Type    |
| ------------ | ------- |
| trip_id      | TEXT    |
| route_id     | TEXT    |
| service_id   | TEXT    |
| trip_headsign| TEXT    |
| direction_id | INTEGER |
| shape_id     | TEXT    |
| status       | TEXT    |

## Enum Values

### location_type_to_name(location_type, parent_station)

| location_type | parent_station | Result         |
| ------------- | -------------- | -------------- |
| 0             | non-empty      | Platform       |
| 0             | empty/NULL     | Stop           |
| 1             | any            | Station        |
| 2             | any            | Exit/Entrance  |
| 3             | any            | Pathway Node   |
| 4             | any            | Boarding Area  |

### pathway_mode_to_name(mode)

| mode | Result                       |
| ---- | ---------------------------- |
| 1    | Walkway                      |
| 2    | Stairs                       |
| 3    | Moving sidewalk/travelator   |
| 4    | Escalator                    |
| 5    | Elevator                     |
| 6    | Fare gate                    |
| 7    | Exit gate                    |

### wheelchair_to_emoji(wheelchair_boarding)

| Value | Result | Meaning         |
| ----- | ------ | --------------- |
| 0     | 🔵     | No information  |
| 1     | 🟢     | Accessible      |
| 2     | 🔴     | Not accessible  |
