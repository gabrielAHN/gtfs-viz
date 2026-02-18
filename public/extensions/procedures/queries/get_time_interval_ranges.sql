

CREATE OR REPLACE MACRO get_time_interval_ranges(station_id, to_stop, from_stop) AS TABLE (
  WITH valid_traversals AS (
    SELECT traversal_time
    FROM pathway_network
    WHERE from_parent_station = station_id
      AND to_parent_station = station_id
      AND (to_stop IS NULL OR to_stop_id = to_stop)
      AND (from_stop IS NULL OR from_stop_id = from_stop)
      AND traversal_time IS NOT NULL
      AND traversal_time > 0
  ),
  time_stats AS (
    SELECT
      MIN(traversal_time) AS min_time,
      MAX(traversal_time) AS max_time
    FROM valid_traversals
  ),
  bins AS (
    SELECT
      ts.min_time,
      ts.max_time,
      LN(ts.min_time) AS log_min_time,
      LN(ts.max_time) AS log_max_time,
      CASE
        WHEN LN(ts.max_time) = LN(ts.min_time) THEN NULL
        ELSE (LN(ts.max_time) - LN(ts.min_time)) / 5.0
      END AS interval_size
    FROM time_stats ts
  ),
  ranges AS (
    SELECT
      b.log_min_time + b.interval_size * generate_series AS range_start_log,
      b.log_min_time + b.interval_size * (generate_series + 1) AS range_end_log
    FROM bins b,
    generate_series(0, 4)
    WHERE b.interval_size IS NOT NULL
  ),
  final_ranges AS (
    SELECT
      EXP(r.range_start_log) AS min_value,
      EXP(r.range_end_log) AS max_value
    FROM ranges r
  )
  SELECT DISTINCT
    CASE
      WHEN min_value % 1 = 0 THEN CAST(min_value AS INT)
      ELSE ROUND(min_value, 2)
    END AS min_value,
    CASE
      WHEN max_value % 1 = 0 THEN CAST(max_value AS INT)
      ELSE ROUND(max_value, 2)
    END AS max_value
  FROM final_ranges
  ORDER BY min_value
);
