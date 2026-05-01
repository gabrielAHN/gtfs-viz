# GTFS Schedule Reference

Official source: https://gtfs.org/documentation/schedule/reference/#field-definitions

Use the official reference for exact field requirements. For GTFS Viz, focus on `stops.txt`, `pathways.txt`, and `levels.txt` when analyzing stations, station parts, entrances, platforms, boarding areas, and internal station connectivity.

## Station Part Fields

GTFS station parts are represented in `stops.txt`.

Relevant `location_type` values:

| Value | GTFS meaning | GTFS Viz label |
| ----- | ------------ | -------------- |
| `0` or empty | Stop or platform | `Stop` or `Platform` |
| `1` | Station | `Station` |
| `2` | Entrance or exit | `Exit/Entrance` |
| `3` | Generic node inside a station | `Pathway Node` |
| `4` | Boarding area on a platform | `Boarding Area` |

Use `parent_station` to determine station hierarchy:

| Station part | Expected parent |
| ------------ | --------------- |
| Station | No parent |
| Platform | Station, when defined inside a station |
| Entrance/exit | Station |
| Generic node | Station |
| Boarding area | Platform |

Important fields for station-part review:

| Field | Use in GTFS Viz |
| ----- | --------------- |
| `stop_id` | Stable node ID for station parts and pathway endpoints |
| `stop_name` | Rider-facing station-part label when present |
| `stop_lat`, `stop_lon` | Map position for stations, platforms, entrances, nodes, and boarding areas |
| `location_type` | Determines whether a record is a station, platform, entrance, pathway node, or boarding area |
| `parent_station` | Determines which station or platform owns the part |
| `wheelchair_boarding` | Helps identify accessible entrances and platforms |
| `level_id` | Links station parts to `levels.txt` for vertical station layout |
| `platform_code` | Platform display label, when provided |

## Pathway Fields

GTFS internal station networks are represented in `pathways.txt`. GTFS Viz treats pathway records as graph edges between station-part nodes from `stops.txt`.

Relevant pathway fields:

| Field | Use in GTFS Viz |
| ----- | --------------- |
| `pathway_id` | Stable edge ID |
| `from_stop_id` | Source station-part node |
| `to_stop_id` | Target station-part node |
| `pathway_mode` | Edge type: walkway, stairs, escalator, elevator, fare gate, exit gate, etc. |
| `is_bidirectional` | Whether travel is allowed both ways |
| `length` | Horizontal distance in meters |
| `traversal_time` | Travel time in seconds |
| `stair_count` | Stairs up or down, useful for vertical movement checks |
| `max_slope` | Slope for walkways and moving sidewalks |
| `min_width` | Narrow pathway check |
| `signposted_as`, `reversed_signposted_as` | Rider-facing sign text |

Do not use station IDs (`location_type=1`) as pathway endpoints. Pathways should connect station parts such as platforms, entrances, generic nodes, and boarding areas.

## Missing Connection Audit

When checking for missing pieces, base the investigation on station parts and network functions. Do not infer gaps from raw standalone stops or unrelated feed tables.

Use this workflow:

1. Pick one station.

```bash
gtfs-viz station "Station Name" --data
```

2. List station parts.

```bash
gtfs-viz query --name station-stops --args-json '{"stationId":"STATION_ID"}' --data
```

3. List pathway edges for those station parts.

```bash
gtfs-viz query --name station-pathways --args-json '{"stationId":"STATION_ID"}' --data
```

4. Check network routes between station parts.

```bash
gtfs-viz station_routes STATION_ID --data
```

5. Use network functions to find disconnected or unreachable station parts.

```sql
WITH parts AS (
  SELECT stop_id, stop_name, location_type_name
  FROM get_station_stops('STATION_ID')
  WHERE location_type_name IN ('Platform', 'Exit/Entrance', 'Pathway Node', 'Boarding Area')
),
edges AS (
  SELECT from_stop_id AS stop_id FROM get_station_pathways('STATION_ID')
  UNION
  SELECT to_stop_id AS stop_id FROM get_station_pathways('STATION_ID')
)
SELECT p.stop_id, p.stop_name, p.location_type_name
FROM parts p
LEFT JOIN edges e USING (stop_id)
WHERE e.stop_id IS NULL
ORDER BY p.location_type_name, p.stop_name, p.stop_id;
```

6. Check whether platforms or boarding areas can reach at least one entrance.

```sql
WITH routes AS (
  SELECT *
  FROM get_station_routes('STATION_ID')
  WHERE shortest_time IS NOT NULL
),
targets AS (
  SELECT stop_id, stop_name, location_type_name
  FROM get_station_stops('STATION_ID')
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

7. Inspect direct connections for a suspicious node.

```bash
gtfs-viz station_pathways STATION_ID --node-id NODE_ID --data
```

If a missing connection is confirmed, add or update a pathway edge with `add_connection` or `update_connection`. Use `pathway_mode`, `is_bidirectional`, and `traversal_time` consistently with the physical station layout.

## What To Avoid

- Do not use `StopsTable` to audit station-internal connectivity. It contains standalone stops, not station parts.
- Do not mark a station as connected just because it has pathways; verify routes between entrances and platforms or boarding areas.
- Do not create pathway endpoints on the parent station record.
- Do not rely only on row counts. Use `get_station_stops`, `get_station_pathways`, `get_station_routes`, `find_shortest_path`, and `find_reachable_stops`.
