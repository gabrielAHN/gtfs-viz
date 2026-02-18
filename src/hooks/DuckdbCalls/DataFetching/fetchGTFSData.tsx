import {
  executeQuery,
  buildAndQuery,
  executeColumnQuery,
} from "@/hooks/DuckdbCalls/QueryHelper";

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
    console.error(`Error fetching data table`, error);
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
    console.error(`Error fetching data table`, error);
    return [];
  }
};

export const fetchPathwaysStatusData = async (
  props
): Promise<string[]> => {
  const { conn, table } = props;
  let baseQuery = `SELECT DISTINCT pathways_status FROM ${table}`;
  const conditions = addConditions(props);

  const query = buildAndQuery(baseQuery, conditions);

  return executeColumnQuery(conn, query, "pathways_status");
};

export const fetchStopsIdData = async (
  props
): Promise<string[]> => {
  const { conn, table } = props;
  let baseQuery = `SELECT DISTINCT stop_id FROM ${table}`;
  const conditions = addConditions(props);

  const query = buildAndQuery(baseQuery, conditions);
  return executeColumnQuery(conn, query, "stop_id");
};

export const fetchStopsNamesData = async (
  props
): Promise<string[]> => {
  const { conn, table } = props;
  let baseQuery = `SELECT DISTINCT stop_name FROM ${table}`;
  const conditions = addConditions(props);

  const query = buildAndQuery(baseQuery, conditions);

  return executeColumnQuery(conn, query, "stop_name");
};

export const fetchWheelchairStatusData = async (
  props
): Promise<string[]> => {
  const { conn, table } = props;
  let baseQuery = `SELECT DISTINCT wheelchair_status FROM ${table}`;
  const conditions = addConditions(props);

  const query = buildAndQuery(baseQuery, conditions);

  return executeColumnQuery(conn, query, "wheelchair_status");
};
