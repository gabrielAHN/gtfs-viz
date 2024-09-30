import { ColorsRanges } from "@/util/colorUtil";
import { executeQuery, buildAndQuery } from "@/hooks/DuckdbCalls/QueryHelper";


export const fetchPathwaysData = async (props) => {
  const { conn, StationView, ToStop, FromStop, EmptyArcs, TimeRange, DirectionTypes, PathwayTypes } = props;

  let StationInfoQuery = `
      SELECT
        *
      FROM stops
      WHERE 
        parent_station = '${StationView.stopId}'
    `;

  let ConnectionQuery = `
  WITH pathways_with_direction AS (
    SELECT
        pathway_id,
        from_stop_id,
        to_stop_id,
        from_lat,
        from_lon,
        to_lat,
        to_lon,
        traversal_time,
        pathway_mode_name,
        direction_type,
        -- Assign direction based on stop IDs
        CASE
            WHEN from_stop_id = to_stop_id THEN 'loop'
            WHEN from_stop_id < to_stop_id THEN 'forward'
            ELSE 'backward'
        END AS direction,
        -- Unordered stop pair identifiers
        LEAST(from_stop_id, to_stop_id) AS stop_a,
        GREATEST(from_stop_id, to_stop_id) AS stop_b
    FROM pathways
    WHERE from_parent_station = '${StationView.stopId}'
      AND to_parent_station = '${StationView.stopId}'
      AND from_lat IS NOT NULL
      AND from_lon IS NOT NULL
      AND to_lat IS NOT NULL
      AND to_lon IS NOT NULL
  ),
  pathways_with_counts AS (
      SELECT
          p.*,
          -- Total pathways in each direction between stop_a and stop_b
          COUNT(*) FILTER (WHERE direction = 'forward') OVER (PARTITION BY stop_a, stop_b) AS total_pathways_forward,
          COUNT(*) FILTER (WHERE direction = 'backward') OVER (PARTITION BY stop_a, stop_b) AS total_pathways_backward,
          -- Assign a unique index to each pathway within its direction
          ROW_NUMBER() OVER (PARTITION BY stop_a, stop_b, direction ORDER BY pathway_id) AS pathway_index
      FROM pathways_with_direction p
  )
  SELECT
      pathway_id,
      from_lat,
      from_lon,
      to_lat,
      to_lon,
      from_stop_id,
      to_stop_id,
      traversal_time,
      pathway_mode_name,
      direction_type,
      -- Assign angles based on the specified logic
      CASE
          WHEN direction = 'loop' THEN 0
          WHEN total_pathways_forward >= 1 AND total_pathways_backward >= 1 THEN
              -- Pathways exist in both directions
              CASE
                  WHEN direction = 'forward' THEN
                      CASE
                          WHEN pathway_index = 1 THEN 0
                          ELSE 20 * (pathway_index - 1)
                      END
                  WHEN direction = 'backward' THEN
                      -20 * pathway_index
              END
          WHEN total_pathways_forward >= 1 AND total_pathways_backward = 0 THEN
              -- Only forward pathways
              20 * (pathway_index - 1)
          WHEN total_pathways_forward = 0 AND total_pathways_backward >= 1 THEN
              -- Only backward pathways
              -20 * (pathway_index - 1)
          ELSE
              0 -- Default case
      END AS angle
    FROM pathways_with_counts
  `;

  const conditions: string[] = [];

  if (ToStop) {
    conditions.push(`to_stop_id = '${ToStop}'`);
  }

  if (FromStop) {
    conditions.push(`from_stop_id = '${FromStop}'`);
  }

  if (TimeRange.length > 0) {
    const [minTime, maxTime] = TimeRange;
    const nullCondition = EmptyArcs ? "AND traversal_time IS NOT NULL" : "OR traversal_time IS NULL" ;

    conditions.push(`(traversal_time >= ${minTime} AND traversal_time <= ${maxTime} ${nullCondition})`);
  }

  if (DirectionTypes){
    conditions.push(`direction_type = '${DirectionTypes}'`);
  }
  
  if (PathwayTypes.length > 0) {
    const PathwayTypeCondition = PathwayTypes.map((type) => `pathway_mode_name = '${type.pathway_mode_name}'`).join(" OR ");
    conditions.push(`(${PathwayTypeCondition})`);
  }

  const ConditionsQuery = buildAndQuery(ConnectionQuery, conditions);
  const StopsResults = await executeQuery(conn, StationInfoQuery);
  const ConnectionResults = await executeQuery(conn, ConditionsQuery);

  return {
    stops: StopsResults,
    connections: ConnectionResults,
  };
};

export const fetchToStopsData = async (props) => {
  const { conn, StationView, FromStop, TimeRange } = props;

  let ToStopsQuery = `
    SELECT
      DISTINCT
      to_stop_id
    FROM pathways
    WHERE to_parent_station = '${StationView.stopId}'
    AND to_lat IS NOT NULL
    AND to_lon IS NOT NULL
    AND from_lat IS NOT NULL
    AND from_lon IS NOT NULL
    AND to_stop_id != from_stop_id
    AND from_stop_id != to_stop_id
  `;

  if (FromStop) {
    ToStopsQuery += ` AND from_stop_id = '${FromStop}'`;
  }

  if (TimeRange.length > 0) {
    const [minTime, maxTime] = TimeRange;
    ToStopsQuery += ` AND traversal_time >= ${minTime} AND traversal_time <= ${maxTime}`;
  }

  const ToStopsResults = await executeQuery(conn, ToStopsQuery);
  return ToStopsResults.map((row: any) => row["to_stop_id"]);
};

export const fetchfromStopsData = async (props) => {
  const { conn, StationView, ToStop, TimeRange } = props;

  let fromStopsQuery = `
    SELECT
      DISTINCT
      from_stop_id
    FROM pathways
    WHERE from_parent_station = '${StationView.stopId}'
    AND to_lat IS NOT NULL
    AND to_lon IS NOT NULL
    AND from_lat IS NOT NULL
    AND from_lon IS NOT NULL
    AND to_stop_id != from_stop_id
    AND from_stop_id != to_stop_id
  `;

  if (ToStop) {
    fromStopsQuery += ` AND to_stop_id = '${ToStop}'`;
  }

  if (TimeRange.length > 0) {
    const [minTime, maxTime] = TimeRange;
    fromStopsQuery += ` AND traversal_time >= ${minTime} AND traversal_time <= ${maxTime}`;
  }

  const fromStopsResults = await executeQuery(conn, fromStopsQuery);
  return fromStopsResults.map((row: any) => row["from_stop_id"]);
};

export const fetchDirectionTypes = async (props) => {
  const { conn, StationView, ToStop, FromStop, EmptyArcs, TimeRange } = props;

  let DirectionQuery = `
    SELECT
      DISTINCT
      direction_type
    FROM pathways
    WHERE from_parent_station = '${StationView.stopId}'
    AND to_parent_station = '${StationView.stopId}'
    AND to_lat IS NOT NULL
    AND to_lon IS NOT NULL
    AND from_lat IS NOT NULL
    AND from_lon IS NOT NULL
    AND to_stop_id != from_stop_id
    AND from_stop_id != to_stop_id
  `;

  if (ToStop) {
    DirectionQuery += ` AND to_stop_id = '${ToStop}'`;
  }
  if (FromStop) {
    DirectionQuery += ` AND from_stop_id = '${FromStop}'`;
  }

  if (TimeRange.length > 0) {
    const [minTime, maxTime] = TimeRange;
    const nullCondition = EmptyArcs ? "AND traversal_time IS NOT NULL" : "OR traversal_time IS NULL" ;

    DirectionQuery += `AND (traversal_time >= ${minTime} AND traversal_time <= ${maxTime} ${nullCondition})`;
  }
  const DirectionResults = await executeQuery(conn, DirectionQuery);
  return DirectionResults.map((row: any) => row["direction_type"]);
};

export const fetchtimeIntervalRanges = async (props) => {
  const { conn, StationView, ToStop, FromStop } = props;

  let validTraversalsQuery = `
    SELECT
      traversal_time
    FROM pathways
    WHERE from_parent_station = '${StationView.stopId}'
      AND to_parent_station = '${StationView.stopId}'
      AND from_lat IS NOT NULL
      AND from_lon IS NOT NULL
      AND to_lat IS NOT NULL
      AND to_lon IS NOT NULL
  `;

  const conditions = [];

  if (ToStop) {
    conditions.push(`to_stop_id = '${ToStop}'`);
  }

  if (FromStop) {
    conditions.push(`from_stop_id = '${FromStop}'`);
  }

  conditions.push(`traversal_time IS NOT NULL`);
  conditions.push(`traversal_time > 0`);

  if (conditions.length > 0) {
    validTraversalsQuery += " AND " + conditions.join(" AND ");
  }

  let timeIntervalQuery = `
    WITH valid_traversals AS (
      ${validTraversalsQuery}
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
    ORDER BY min_value;
  `;

  const rangesResults = await executeQuery(conn, timeIntervalQuery);

  if (rangesResults.length > 0) {
    const numRanges = rangesResults.length;
    const adjustedColors = ColorsRanges.slice(0, numRanges);

    const rangesWithColors = rangesResults.map((result, index) => {
      return {
        min: result.min_value,
        max: result.max_value,
        color: adjustedColors[index],
      };
    });
    return rangesWithColors;
  } else {
    return [];
  }
};

export const fetchPathwayType = async (props) => {
  const { conn, StationView, ToStop, FromStop  } = props;

  let PathwayTypeQuery = `
    SELECT
      DISTINCT
      pathway_mode_name
    FROM pathways
    WHERE from_parent_station = '${StationView.stopId}'
    AND to_parent_station = '${StationView.stopId}'
    AND to_lat IS NOT NULL
    AND to_lon IS NOT NULL
    AND from_lat IS NOT NULL
    AND from_lon IS NOT NULL
    AND to_stop_id != from_stop_id
    AND from_stop_id != to_stop_id
  `;

  if (ToStop) {
    PathwayTypeQuery += ` AND to_stop_id = '${ToStop}'`;
  }
  if (FromStop) {
    PathwayTypeQuery += ` AND from_stop_id = '${FromStop}'`;
  }

  const PathwayTypeResults = await executeQuery(conn, PathwayTypeQuery);
  return PathwayTypeResults
};