import {
  executeQuery,
  buildAndQuery,
  executeColumnQuery,
  fetchDistinctColumnValues,
} from "@/lib/duckdb/QueryHelper";
import { logger } from "@/lib/logger";

const addConditions = (
  props
): string[] => {
  const {
    SearchText,
    StopIdDropdown,
    StopNameDropDown,
    PathwaysStatusDropDown,
    WheelChairStatusDropDown,
  } = props;

  const conditions: string[] = [];

  if (SearchText) {
    conditions.push(`LOWER(stop_name) LIKE '%${SearchText.toLowerCase()}%'`);
  }
  if (StopIdDropdown) {
    conditions.push(`LOWER(stop_id) = LOWER('${StopIdDropdown}')`);
  }
  if (StopNameDropDown) {
    conditions.push(`LOWER(stop_name) = LOWER('${StopNameDropDown}')`);
  }

  if (
    PathwaysStatusDropDown &&
    PathwaysStatusDropDown.length > 0
  ) {
    conditions.push(
      `pathways_status IN (${PathwaysStatusDropDown.map(
        (status) => `'${status}'`
      ).join(", ")})`
    );
  }

  if (
    WheelChairStatusDropDown &&
    WheelChairStatusDropDown.length > 0
  ) {
    conditions.push(
      `wheelchair_status IN (${WheelChairStatusDropDown.map(
        (status) => `'${status}'`
      ).join(", ")})`
    );
  }
  return conditions;
};

export const fetchTableData = async (
  props
): Promise<string[]> => {
  const { conn, table } = props;
  let baseQuery = `SELECT * FROM ${table}`;

  try {
    const result = await executeQuery(conn, baseQuery);
    return result;
  } catch (error) {
    logger.error(`Error fetching data table`, error);
    return [];
  }
};

export const fetchStationsData = async (
  props
): Promise<string[]> => {
  const { conn, table } = props;
  let baseQuery = `SELECT * FROM ${table}`;
  const conditions = addConditions(props);

  const query = buildAndQuery(baseQuery, conditions);

  try {
    const result = await conn.query(query);
    return result.toArray();
  } catch (error) {
    
    if (!error.message?.includes('does not exist')) {
      logger.error(`Error fetching data table`, error);
    }
    return [];
  }
};

// Generic distinct column fetcher — all 4 variants below use this
const fetchDistinctWithFilters = async (props: any, column: string) => {
  const { conn, table } = props;
  return fetchDistinctColumnValues(conn, table, column, addConditions(props));
};

export const fetchPathwaysStatusData = (props: any) => fetchDistinctWithFilters(props, "pathways_status");
export const fetchStopsIdData = (props: any) => fetchDistinctWithFilters(props, "stop_id");
export const fetchStopsNamesData = (props: any) => fetchDistinctWithFilters(props, "stop_name");
export const fetchWheelchairStatusData = (props: any) => fetchDistinctWithFilters(props, "wheelchair_status");
