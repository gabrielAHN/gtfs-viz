import { logger } from "@/lib/logger";

export const buildAndQuery = (baseQuery: string, conditions: string[]): string => {
  return conditions.length > 0 ? `${baseQuery} WHERE ${conditions.join(" AND ")}` : baseQuery;
};

const convertBigIntsToNumbers = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(convertBigIntsToNumbers);
  }

  if (typeof obj === "object") {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertBigIntsToNumbers(obj[key]);
    }
    return converted;
  }

  return obj;
};

export const executeQuery = async (conn: any, query: string): Promise<any[]> => {
  try {
    const result = await conn.query(query);

    return result.toArray().map((row: any) => convertBigIntsToNumbers(row.toJSON()));
  } catch (error) {
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes("does not exist")) {
      const criticalTables = ["stops", "pathways", "StationsTable", "StopsTable", "StopsView"];
      const isCriticalTable = criticalTables.some(
        (table) => errorMsg.includes(`Table with name ${table}`) || errorMsg.includes(`"${table}"`),
      );

      if (isCriticalTable) {
        logger.log(`⚠️ Critical table missing - resetting app state`);

        localStorage.removeItem("gtfs_data_initialized");
        localStorage.removeItem("gtfs_has_stations");
        localStorage.removeItem("gtfs_has_stops");
        localStorage.removeItem("gtfs_has_routes");

        if (typeof window !== "undefined") {
          window.location.href = "/";
        }

        return [];
      }
    } else {
      logger.error(`[QueryHelper] Error executing query:`, error);
      logger.error(`[QueryHelper] Query was:`, query);
      logger.error(`[QueryHelper] Error details:`, {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
    }
    throw error;
  }
};

export const executeColumnQuery = async (
  conn: any,
  query: string,
  columnName: string,
): Promise<{ label: string; value: string }[]> => {
  try {
    const result = await conn.query(query);
    return result.toArray().map((row) => {
      const value = row[columnName];
      const convertedValue = typeof value === "bigint" ? Number(value) : value;
      return { label: String(convertedValue), value: String(convertedValue) };
    });
  } catch (error) {
    logger.error(`Error fetching data from column ${columnName}:`, error);
    return [];
  }
};

export const formFormat = ({ formData }) => {
  if (!formData || typeof formData !== "object") {
    throw new Error("Invalid formData: must be a non-null object");
  }

  const columns = Object.keys(formData).join(", ");

  const values = Object.values(formData)
    .map((value) => formatSqlValue(value))
    .join(", ");
  return { columns, values };
};

export const formatSqlValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return value;
};

export const buildUpdateClause = (formData) => {
  return Object.entries(formData)
    .map(([key, value]) => `${key} = ${formatSqlValue(value)}`)
    .join(", ");
};

export const generateDynamicSelectQuery = async (
  conn: any,
  table: string,
  removeList: string[] = [],
): Promise<string[]> => {
  const result = await conn.query(`
    SELECT "column_name"
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = '${table}';
  `);

  const columnList = result.toArray().map((row) => {
    const colName = row.column_name;
    return typeof colName === "bigint" ? String(colName) : colName;
  });

  const filterList = columnList.filter((column) => !removeList.includes(column));
  return filterList;
};

/** Escape a string for safe SQL interpolation */
export const escapeSql = (value: string) => value.replace(/'/g, "''");

/** Format a value for SQL: strings are quoted+escaped, null/undefined/empty → NULL */
export const toSqlString = (value?: string | null) => {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${escapeSql(value)}'`;
};

/** Format a number for SQL: null/undefined → NULL */
export const toSqlNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "NULL";
  return String(value);
};

/** Format a string array for SQL list: ['a','b'] */
export const toSqlStringList = (values?: string[] | null) => {
  if (!values || values.length === 0) return "NULL";
  return `[${values.map((v) => toSqlString(v)).join(", ")}]`;
};

/** Check if required tables exist in DuckDB */
export const checkTablesExist = async (conn: any, tables: string[]): Promise<boolean> => {
  try {
    const placeholders = tables.map((t) => `'${escapeSql(t)}'`).join(", ");
    const result = await conn.query(`
      SELECT COUNT(*) AS cnt
      FROM information_schema.tables
      WHERE table_name IN (${placeholders})
    `);
    const count = Number(result.toArray()[0]?.cnt ?? 0);
    return count >= tables.length;
  } catch {
    return false;
  }
};

/** Fetch distinct values from a column with optional conditions */
export const fetchDistinctColumnValues = async (
  conn: any,
  table: string,
  column: string,
  conditions: string[] = [],
): Promise<{ label: string; value: string }[]> => {
  const baseQuery = `SELECT DISTINCT ${column} FROM ${table}`;
  const query = buildAndQuery(baseQuery, conditions);
  return executeColumnQuery(conn, query, column);
};

export const EditMergeQuery = (
  columns: string[],
  mappedColumns: string[],
  tableName: string,
  editTable: string,
  merge_id: string,
) => `
  SELECT ${columns.join(", ")}
  FROM (
    SELECT
      edt.row_id,
      ${mappedColumns.join(", ")}
    FROM ${editTable} edt
    WHERE edt.status IN ('new', 'edit', 'new edit')
    UNION ALL
    SELECT
      st.row_id,
      ${columns.join(", ")}
    FROM ${tableName} st
    WHERE NOT EXISTS (
      SELECT 1
      FROM ${editTable} edt
      WHERE edt.row_id = st.row_id
        AND edt.status = 'deleted'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM ${editTable} edt
      WHERE edt.row_id = st.row_id
        AND edt.status = 'edit'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM ${editTable} edt
      WHERE edt.${merge_id} = st.${merge_id}
        AND edt.status = 'new edit'
    )
  ) combined
`;
