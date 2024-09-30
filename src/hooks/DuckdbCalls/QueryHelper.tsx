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
  ): Promise<string[]> => {
    try {
      const result = await conn.query(query);
      return result.toArray().map((row: any) => row[columnName]);
    } catch (error) {
      console.error(`Error fetching data from column ${columnName}:`, error);
      return [];
    }
  };
  