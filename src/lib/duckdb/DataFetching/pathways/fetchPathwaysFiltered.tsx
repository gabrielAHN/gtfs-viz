import { ColorsRanges } from "@/components/colorUtil";
import { executeQuery, executeColumnQuery, buildAndQuery } from "@/lib/duckdb/QueryHelper";
import { getDirectPathways } from "./pathfinding";

const ensureProceduresLoaded = async (conn: any) => {
  
  return Promise.resolve();
};

export const fetchPathwaysData = async (props) => {
  const { conn, table, StationView, ToStop, FromStop, EmptyArcs, TimeRange, DirectionTypes, PathwayTypes } = props;

  await ensureProceduresLoaded(conn);

  const StationInfoQuery = `
    SELECT * FROM get_station_stops_for_pathways('${StationView.stop_id}')
  `;

  let ConnectionQuery = `
  WITH pathways_with_direction AS (
    SELECT
        p.pathway_id,
        p.from_stop_id,
        p.to_stop_id,
        pn.from_lat,
        pn.from_lon,
        pn.to_lat,
        pn.to_lon,
        p.traversal_time,
        p.pathway_mode_name,
        p.direction_type,
        pn.from_location_type_name,
        pn.to_location_type_name,
        -- Assign direction based on stop IDs
        CASE
            WHEN p.from_stop_id = p.to_stop_id THEN 'loop'
            WHEN p.from_stop_id < p.to_stop_id THEN 'forward'
            ELSE 'backward'
        END AS direction,
        -- Unordered stop pair identifiers
        LEAST(p.from_stop_id, p.to_stop_id) AS stop_a,
        GREATEST(p.from_stop_id, p.to_stop_id) AS stop_b
    FROM pathways p
    JOIN pathway_network pn ON p.pathway_id = pn.pathway_id
    WHERE pn.from_parent_station = '${StationView.stop_id}'
      AND pn.to_parent_station = '${StationView.stop_id}'
      AND pn.from_lat IS NOT NULL
      AND pn.from_lon IS NOT NULL
      AND pn.to_lat IS NOT NULL
      AND pn.to_lon IS NOT NULL
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
      from_location_type_name,
      to_location_type_name,
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
    const nullCondition = EmptyArcs ? "AND traversal_time IS NOT NULL" : "OR traversal_time IS NULL";
    conditions.push(`(traversal_time >= ${minTime} AND traversal_time <= ${maxTime} ${nullCondition})`);
  }

  if (DirectionTypes) {
    conditions.push(`direction_type = '${DirectionTypes}'`);
  }

  if (PathwayTypes.length > 0) {
    conditions.push(`pathway_mode_name IN (${PathwayTypes.map(loc => `'${loc}'`).join(", ")})`);
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

  await ensureProceduresLoaded(conn);

  const fromStop = FromStop ? `'${FromStop}'` : 'NULL';
  const minTime = TimeRange.length > 0 ? TimeRange[0] : 'NULL';
  const maxTime = TimeRange.length > 0 ? TimeRange[1] : 'NULL';

  const ToStopsQuery = `
    SELECT to_stop_id FROM get_to_stops(
      '${StationView.stop_id}',
      ${fromStop},
      ${minTime},
      ${maxTime}
    )
  `;

  const ToStopsResults = executeColumnQuery(conn, ToStopsQuery, "to_stop_id");
  return ToStopsResults;
};

export const fetchfromStopsData = async (props) => {
  const { conn, StationView, ToStop, TimeRange } = props;

  await ensureProceduresLoaded(conn);

  const toStop = ToStop ? `'${ToStop}'` : 'NULL';
  const minTime = TimeRange.length > 0 ? TimeRange[0] : 'NULL';
  const maxTime = TimeRange.length > 0 ? TimeRange[1] : 'NULL';

  const fromStopsQuery = `
    SELECT from_stop_id FROM get_from_stops(
      '${StationView.stop_id}',
      ${toStop},
      ${minTime},
      ${maxTime}
    )
  `;

  const fromStopsResults = executeColumnQuery(conn, fromStopsQuery, "from_stop_id");
  return fromStopsResults;
};

export const fetchDirectionTypes = async (props) => {
  const { conn, StationView, ToStop, FromStop, EmptyArcs, TimeRange } = props;

  await ensureProceduresLoaded(conn);

  const toStop = ToStop ? `'${ToStop}'` : 'NULL';
  const fromStop = FromStop ? `'${FromStop}'` : 'NULL';
  const minTime = TimeRange.length > 0 ? TimeRange[0] : 'NULL';
  const maxTime = TimeRange.length > 0 ? TimeRange[1] : 'NULL';
  const includeNullTime = EmptyArcs ? 'FALSE' : 'TRUE';

  const DirectionQuery = `
    SELECT direction_type FROM get_direction_types(
      '${StationView.stop_id}',
      ${toStop},
      ${fromStop},
      ${minTime},
      ${maxTime},
      ${includeNullTime}
    )
  `;

  const DirectionResults = executeColumnQuery(conn, DirectionQuery, "direction_type");
  return DirectionResults;
};

export const fetchtimeIntervalRanges = async (props) => {
  const { conn, StationView, ToStop, FromStop } = props;

  await ensureProceduresLoaded(conn);

  const toStop = ToStop ? `'${ToStop}'` : 'NULL';
  const fromStop = FromStop ? `'${FromStop}'` : 'NULL';

  const timeIntervalQuery = `
    SELECT * FROM get_time_interval_ranges(
      '${StationView.stop_id}',
      ${toStop},
      ${fromStop}
    )
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
  const { conn, StationView, ToStop, FromStop } = props;

  await ensureProceduresLoaded(conn);

  const toStop = ToStop ? `'${ToStop}'` : 'NULL';
  const fromStop = FromStop ? `'${FromStop}'` : 'NULL';

  const PathwayTypeQuery = `
    SELECT pathway_mode_name FROM get_pathway_types(
      '${StationView.stop_id}',
      ${toStop},
      ${fromStop}
    )
  `;

  const PathwayTypeResults = executeColumnQuery(conn, PathwayTypeQuery, "pathway_mode_name");
  return PathwayTypeResults;
};

