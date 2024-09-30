import { FetchProps } from "@/types/objectTypes";
import {
  buildAndQuery,
  executeColumnQuery,
} from "@/hooks/DuckdbCalls/QueryHelper";

const addConditions = (
  props: FetchProps,
  include: Partial<Record<keyof FetchProps, boolean>>
): string[] => {
  const {
    SearchText,
    StopIdDropdown,
    StopNameDropDown,
    PathwaysStatusDropDown,
    WheelChairStatusDropDown,
  } = props;

  const conditions: string[] = [];

  if (include.SearchText && SearchText) {
    conditions.push(`LOWER(stop_name) LIKE '%${SearchText.toLowerCase()}%'`);
  }
  if (include.StopIdDropdown && StopIdDropdown) {
    conditions.push(`LOWER(stop_id) = LOWER('${StopIdDropdown}')`);
  }
  if (include.StopNameDropDown && StopNameDropDown) {
    conditions.push(`LOWER(stop_name) = LOWER('${StopNameDropDown}')`);
  }
  if (
    include.PathwaysStatusDropDown &&
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
    include.WheelChairStatusDropDown &&
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

export const fetchStationsData = async (
  props: FetchProps
): Promise<string[]> => {
  const { conn } = props;
  let baseQuery = `SELECT * FROM StationsTable`;
  const conditions = addConditions(props, {
    SearchText: true,
    StopIdDropdown: true,
    StopNameDropDown: true,
    PathwaysStatusDropDown: true,
    WheelChairStatusDropDown: true,
  });

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
  props: FetchProps
): Promise<string[]> => {
  const { conn } = props;
  let baseQuery = `SELECT DISTINCT pathways_status FROM StationsTable`;
  const conditions = addConditions(props, {
    SearchText: true,
    StopIdDropdown: true,
    StopNameDropDown: true,
    WheelChairStatusDropDown: true,
  });

  const query = buildAndQuery(baseQuery, conditions);

  return executeColumnQuery(conn, query, "pathways_status");
};

export const fetchStopsIdData = async (
  props: FetchProps
): Promise<string[]> => {
  const { conn } = props;
  let baseQuery = `SELECT DISTINCT stop_id FROM StationsTable`;
  const conditions = addConditions(props, {
    SearchText: true,
    StopNameDropDown: true,
    PathwaysStatusDropDown: true,
    WheelChairStatusDropDown: true,
  });

  const query = buildAndQuery(baseQuery, conditions);

  return executeColumnQuery(conn, query, "stop_id");
};

export const fetchStopsNamesData = async (
  props: FetchProps
): Promise<string[]> => {
  const { conn } = props;
  let baseQuery = `SELECT DISTINCT stop_name FROM StationsTable`;
  const conditions = addConditions(props, {
    SearchText: true,
    StopIdDropdown: true,
    PathwaysStatusDropDown: true,
    WheelChairStatusDropDown: true,
  });

  const query = buildAndQuery(baseQuery, conditions);

  return executeColumnQuery(conn, query, "stop_name");
};

export const fetchWheelchairStatusData = async (
  props: FetchProps
): Promise<string[]> => {
  const { conn } = props;
  let baseQuery = `SELECT DISTINCT wheelchair_status FROM StationsTable`;
  const conditions = addConditions(props, {
    SearchText: true,
    StopIdDropdown: true,
    StopNameDropDown: true,
    PathwaysStatusDropDown: true,
  });

  const query = buildAndQuery(baseQuery, conditions);

  return executeColumnQuery(conn, query, "wheelchair_status");
};
