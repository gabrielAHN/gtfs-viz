export const buildAndQuery = (baseQuery: string, conditions: string[]): string => {
  return conditions.length > 0
    ? `${baseQuery} WHERE ${conditions.join(" AND ")}`
    : baseQuery;
};

export const executeQuery = async (
  conn: any,
  query: string
): Promise<any[]> => {
  try {
    const result = await conn.query(query);
    return result.toArray();
  } catch (error) {
    console.error(`Error executing query:`, error);
    return [];
  }
};

export const executeColumnQuery = async (
  conn: any,
  query: string,
  columnName: string
): Promise<{ label: string; value: string }[]> => {

  try {
    const result = await conn.query(query);
    return result
      .toArray()
      .map((row) => ({ label: row[columnName], value: row[columnName] }));
  } catch (error) {
    console.error(`Error fetching data from column ${columnName}:`, error);
    return [];
  }
};

export const formFormat = ({ formData }) => {
  if (!formData || typeof formData !== 'object') {
    throw new Error('Invalid formData: must be a non-null object');
  }

  const columns = Object.keys(formData).join(', ');

  const values = Object.values(formData)
    .map((value) => {
      if (value === null || value === '') return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      return value;
    })
    .join(', ');
  return { columns, values };
};

export const buildUpdateClause = (formData) => {
  return Object.entries(formData)
    .map(([key, value]) => {
      if (value === null) {
        return `${key} = NULL`;
      }
      return `${key} = '${value}'`;
    })
    .join(', ');
}

export const generateDynamicSelectQuery = async (
  conn: any,
  table: string,
  removeList: string[] = []
): Promise<string[]> => {
  const result = await conn.query(`
    SELECT "column_name"
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE table_name = '${table}';
  `);

  const columnList = result
    .toArray()
    .map((row) => row.column_name)

  const filterList =  columnList.filter((column) => !removeList.includes(column));
  return filterList;
};
