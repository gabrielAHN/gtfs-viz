import { executeQuery } from '../QueryHelper'
import { logger } from "@/lib/logger";

export const validateTableData = async (props) => {
    const { conn, table, column, value } = props;

    try {

        const query = `
        SELECT stop_id FROM (
            -- Check EditStopTable for non-deleted entries
            SELECT stop_id
            FROM EditStopTable
            WHERE stop_id = '${value}'
              AND status != 'deleted'

            UNION ALL

            -- Check stops table, excluding those that are in EditStopTable
            SELECT stop_id
            FROM stops
            WHERE stop_id = '${value}'
              AND NOT EXISTS (
                SELECT 1 FROM EditStopTable
                WHERE EditStopTable.row_id = stops.row_id
                  AND EditStopTable.status = 'deleted'
              )
              AND NOT EXISTS (
                SELECT 1 FROM EditStopTable
                WHERE EditStopTable.row_id = stops.row_id
                  AND EditStopTable.status IN ('edit', 'new edit')
              )
        ) combined
        LIMIT 1`;

        const result = await executeQuery(conn, query);
        
        return result.length === 0 || `Stop ID "${value}" already exists`;
    } catch (error) {
        logger.error('Error validating stop ID:', error);
        
        try {
            const fallbackQuery = `
            SELECT ${column}
             FROM ${table}
            WHERE stop_id = '${value}'`;
            const fallbackResult = await executeQuery(conn, fallbackQuery);
            return fallbackResult.length === 0 || `Stop ID "${value}" already exists`;
        } catch (fallbackError) {
            logger.error('Error with fallback validation:', fallbackError);
            throw fallbackError;
        }
    }
}
