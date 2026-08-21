# GTFS Extension — SQL Procedures Reference

## Scalar Macros

Utility macros for data conversion, available in any SQL query.

### gtfs_time_to_seconds(time_str)

Convert GTFS time string (HH:MM:SS, supports >24h for overnight trips) to total seconds.

```sql
SELECT gtfs_time_to_seconds('08:30:00');  -- Returns 30600
SELECT gtfs_time_to_seconds('25:15:00');  -- Returns 90900 (next day)
```

### location_type_to_name(location_type, parent_station)

Convert GTFS location_type integer to name: Stop, Station, Platform, Exit/Entrance, Pathway Node, Boarding Area.

### pathway_mode_to_name(mode)

Convert pathway_mode integer to name: Walkway(1), Stairs(2), Moving sidewalk(3), Escalator(4), Elevator(5), Fare gate(6), Exit gate(7).

### wheelchair_to_emoji(wheelchair_boarding)

Convert wheelchair_boarding integer to emoji: 🔵(0), 🟢(1), 🔴(2), 🟡(other).

### bidirectional_to_direction(is_bidirectional)

Convert is_bidirectional to text: directional(0), bidirectional(1).

## Query Macros

These macros are available after the GTFS extension is installed. Call them with `SELECT * FROM macro_name(args)`.

### get_station_info(station_id)

Station summary with exit count and pathway connectivity status.

```sql
SELECT * FROM get_station_info('place-pktrm');
```

Returns: `row_id`, `stop_id`, `stop_name`, `stop_lat`, `stop_lon`, `status`, `exit_count`, `location_type_name`, `parent_station`, `wheelchair_status`, `pathway_count`, `pathways_status`

### get_station_stops(station_id)

All stops/nodes belonging to a station (platforms, exits, nodes).

```sql
SELECT * FROM get_station_stops('place-pktrm');
```

Returns: `row_id`, `stop_id`, `stop_name`, `stop_lat`, `stop_lon`, `location_type_name`, `parent_station`, `level_id`, `wheelchair_status`, `status`

### get_station_pathways(station_id)

All pathway connections within a station, with coordinates and angles.

```sql
SELECT * FROM get_station_pathways('place-pktrm');
```

Returns: `row_id`, `pathway_id`, `from_stop_id`, `to_stop_id`, `from_lat`, `from_lon`, `to_lat`, `to_lon`, `traversal_time`, `length`, `stair_count`, `max_slope`, `min_width`, `signposted_as`, `reversed_signposted_as`, `pathway_mode_name`, `pathway_mode`, `direction_type`, `is_bidirectional`, `status`, `from_location_type_name`, `to_location_type_name`, `from_parent_station`, `to_parent_station`, `angle`

### get_station_connections(station_id)

Directed connection graph with time periods. Used by the radial flow dashboard.

```sql
SELECT * FROM get_station_connections('place-pktrm');
```

Returns: `pathway_id`, `from_stop_id`, `from_stop_name`, `from_location_type_name`, `to_stop_id`, `to_stop_name`, `to_location_type_name`, `traversal_time_seconds`, `time_period`, `length`, `pathway_mode_name`, `direction_type`, `is_bidirectional`, `edge_direction`, `angle`

### get_station_routes(station_id)

Shortest-path routes between all node pairs using Dijkstra traversal.

```sql
SELECT * FROM get_station_routes('place-sstat');
```

Returns: `start_stop`, `end_stop`, `shortest_time`, `from_location_type_name`, `to_location_type_name`

### get_pathway_aggregates(station_id)

Pathway data for map visualization.

```sql
SELECT * FROM get_pathway_aggregates('place-pktrm');
```

Returns: `pathway_id`, `from_lat`, `from_lon`, `to_lat`, `to_lon`, `from_stop_id`, `to_stop_id`, `traversal_time`, `pathway_mode_name`, `direction_type`, `angle`

### get_pathways_filtered(station_id, to_stop, from_stop, min_time, max_time, include_null_time, direction_type, pathway_types)

Filtered pathways with multiple optional filters.

```sql
SELECT * FROM get_pathways_filtered('place-pktrm', NULL, NULL, 0, 120, TRUE, NULL, NULL);
```

### get_time_interval_ranges(station_id, to_stop, from_stop)

Logarithmic time bins for slider UI.

```sql
SELECT * FROM get_time_interval_ranges('place-pktrm', NULL, NULL);
```

Returns: `min_value`, `max_value`

### get_route_map_bounds(route_ids)

Bounding box, center, and zoom for a set of routes (uses spatial extension).

```sql
SELECT * FROM get_route_map_bounds(['ROUTE_1', 'ROUTE_2']);
```

Returns: `min_lon`, `max_lon`, `min_lat`, `max_lat`, `center_lon`, `center_lat`, `zoom`

### get_stations_map_bounds()

Bounding box for all stations (uses spatial `ST_Extent` on `geom` column).

```sql
SELECT * FROM get_stations_map_bounds();
```

Returns: `min_lon`, `max_lon`, `min_lat`, `max_lat`, `center_lon`, `center_lat`, `zoom`

### get_stops_map_bounds()

Bounding box for all stops (uses spatial `ST_Extent` on `geom` column).

```sql
SELECT * FROM get_stops_map_bounds();
```

Returns: `min_lon`, `max_lon`, `min_lat`, `max_lat`, `center_lon`, `center_lat`, `zoom`

### get_station_service_routes(station_id)

Routes serving a station.

```sql
SELECT * FROM get_station_service_routes('place-pktrm');
```

Returns: all `RoutesTable` columns for routes serving the station.

### get_stop_service_routes(stop_id)

Routes serving a stop.

```sql
SELECT * FROM get_stop_service_routes('10011');
```

Returns: all `RoutesTable` columns for routes serving the stop.

### fit_zoom(min_lon, max_lon, min_lat, max_lat)

Scalar macro that computes web mercator zoom level from bounding box.

```sql
SELECT fit_zoom(-74.0, -73.9, 40.7, 40.8);
```

Returns: zoom level (INTEGER, 4-17)

### get_trip_reroute_routes(trip_id)

Routes with an alternate stop section between at least two ordered stations shared with the selected
trip. Donor clock time and cross-route `direction_id` are not eligibility conditions.

```sql
SELECT * FROM get_trip_reroute_routes('AFFECTED_TRIP');
```

Returns: `route_id`, `route_name`, `route_short_name`, `route_type_name`, `route_color_hex`,
`donor_trip_id`, `shared_station_count`

### get_trip_reroute_boundary_pairs(trip_id, donor_trip_id)

Ordered shared station pairs whose intermediate stop sequences differ.

```sql
SELECT * FROM get_trip_reroute_boundary_pairs('AFFECTED_TRIP', 'DONOR_TRIP');
```

Returns: `from_station`, `to_station`, `affected_from_sequence`, `affected_to_sequence`,
`donor_from_sequence`, `donor_to_sequence`

### get_reroute_stop_times(trip_id, donor_trip_id, from_station, to_station)

The selected trip with its bounded section replaced by donor stops. Donor timing is scaled into the
selected trip's boundary window.

```sql
SELECT *
FROM get_reroute_stop_times('AFFECTED_TRIP', 'DONOR_TRIP', 'FROM STATION', 'TO STATION');
```

Returns: `stop_sequence`, `stop_id`, `arrival_time`, `departure_time`

## Pathfinding Macros

### find_shortest_path(p_station_id, start_stop, end_stop, max_hops)

Shortest path between two station nodes.

```sql
SELECT * FROM find_shortest_path('place-pktrm', 'door-pktrm-1', 'node-pktrm-platform', 10);
```

Returns: `current_stop`, `destination`, `total_time`, `hop_count`, `path_ids`, `visited_stops`, `path_description`

### find_reachable_stops(p_station_id, start_stop, max_time, max_hops)

All stops reachable from a starting point within time/hop limits.

```sql
SELECT * FROM find_reachable_stops('place-pktrm', 'door-pktrm-1', 120, 5);
```

Returns: `reachable_stop`, `min_time`, `min_hops`

### find_all_paths(p_station_id, start_stop, end_stop, max_hops)

All possible paths between two nodes (not just shortest).

```sql
SELECT * FROM find_all_paths('place-pktrm', 'door-pktrm-1', 'node-pktrm-platform', 5);
```

Returns: `total_time`, `hop_count`, `path_ids`, `route`

### get_direct_pathways(p_station_id, from_stop, to_stop, direction_filter, pathway_types)

Direct (single-hop) pathways with optional filters.

```sql
SELECT * FROM get_direct_pathways('place-pktrm', NULL, NULL, NULL, NULL);
```

Returns: `pathway_id`, `from_stop_id`, `to_stop_id`, `from_lat`, `from_lon`, `to_lat`, `to_lon`, `traversal_time`, `pathway_mode_name`, `pathway_mode`, `direction_type`, `is_bidirectional`

## Network Analysis Macros (Onager)

### get_station_network_stats(p_station_id)

Network statistics for a station.

```sql
SELECT * FROM get_station_network_stats('place-pktrm');
```

Returns: `station_id`, `total_nodes`, `total_edges`, `avg_traversal_time`, `min_traversal_time`, `max_traversal_time`, `most_important_stop`, `max_importance`

### find_station_hubs_direct(p_station_id, top_n)

Most important nodes by connectivity.

```sql
SELECT * FROM find_station_hubs_direct('place-pktrm', 10);
```

Returns: `stop_id`, `importance_score`, `stop_name`, `location_type_name`

## Missing Station-Part Connections

Use only station-part and network macros for internal station connectivity audits:

1. `get_station_stops(station_id)` identifies the station parts to audit.
2. `get_station_pathways(station_id)` identifies direct pathway edges between those parts.
3. `get_station_routes(station_id)` identifies reachable station-part pairs.
4. `find_shortest_path(station_id, start_stop, end_stop, max_hops)` inspects one suspected gap.
5. `find_reachable_stops(station_id, start_stop, max_time, max_hops)` checks the reachable subgraph from a station part.

Do not use `StopsTable` for this task. It contains standalone stops, not the station parts that make up a station's internal pathway graph.

Find station parts with no direct pathway edge:

```sql
WITH parts AS (
  SELECT stop_id, stop_name, location_type_name
  FROM get_station_stops('place-pktrm')
  WHERE location_type_name IN ('Platform', 'Exit/Entrance', 'Pathway Node', 'Boarding Area')
),
edges AS (
  SELECT from_stop_id AS stop_id FROM get_station_pathways('place-pktrm')
  UNION
  SELECT to_stop_id AS stop_id FROM get_station_pathways('place-pktrm')
)
SELECT p.stop_id, p.stop_name, p.location_type_name
FROM parts p
LEFT JOIN edges e USING (stop_id)
WHERE e.stop_id IS NULL
ORDER BY p.location_type_name, p.stop_name, p.stop_id;
```

Find platforms or boarding areas that cannot reach an entrance:

```sql
WITH routes AS (
  SELECT *
  FROM get_station_routes('place-pktrm')
  WHERE shortest_time IS NOT NULL
),
targets AS (
  SELECT stop_id, stop_name, location_type_name
  FROM get_station_stops('place-pktrm')
  WHERE location_type_name IN ('Platform', 'Boarding Area')
),
reachable_exits AS (
  SELECT start_stop AS stop_id
  FROM routes
  WHERE from_location_type_name IN ('Platform', 'Boarding Area')
    AND to_location_type_name = 'Exit/Entrance'
  UNION
  SELECT end_stop AS stop_id
  FROM routes
  WHERE to_location_type_name IN ('Platform', 'Boarding Area')
    AND from_location_type_name = 'Exit/Entrance'
)
SELECT t.stop_id, t.stop_name, t.location_type_name
FROM targets t
LEFT JOIN reachable_exits r USING (stop_id)
WHERE r.stop_id IS NULL
ORDER BY t.location_type_name, t.stop_name, t.stop_id;
```

## Named Queries

Use with `gtfs-viz query --name <name>`. Add `--data` to print rows.

| Name                  | SQL                                               | Args           |
| --------------------- | ------------------------------------------------- | -------------- |
| `stations`            | `SELECT * FROM StationsTable`                     | none           |
| `stops`               | `SELECT * FROM StopsTable`                        | none           |
| `station-info`        | `SELECT * FROM get_station_info(stationId)`       | `stationId`    |
| `station-stops`       | `SELECT * FROM get_station_stops(stationId)`      | `stationId`    |
| `station-pathways`    | `SELECT * FROM get_station_pathways(stationId)`   | `stationId`    |
| `station-connections` | `SELECT * FROM get_station_connections(stationId)` | `stationId`   |
| `pathway-aggregates`  | `SELECT * FROM get_pathway_aggregates(stationId)` | `stationId`    |
| `station-routes`      | `SELECT * FROM get_station_routes(stationId)`     | `stationId`    |
| `edit-pathways`       | `SELECT * FROM EditPathwayTable`                  | none           |
| `edit-stops`          | `SELECT * FROM EditStopTable`                     | none           |

```bash
gtfs-viz query --name station-info --args-json '{"stationId":"place-pktrm"}' --data
gtfs-viz query --name stations --data
```
