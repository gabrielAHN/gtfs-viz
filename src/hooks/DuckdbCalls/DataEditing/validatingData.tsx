import { executeQuery } from '../QueryHelper'

export const validateTableData = async (props) => {
    const { conn, table, column, value } = props;

    const query = `
    SELECT ${column}
     FROM ${table} 
    WHERE stop_id == '${value}'`;

    try {
        const result = await executeQuery(conn, query);
        return result.length === 0;
    } catch (error) {
        console.error('Error deleting row:', error);
        throw error;
    }
}