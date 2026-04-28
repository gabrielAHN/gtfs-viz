import {
    formFormat,
    executeQuery,
    buildUpdateClause,
    formatSqlValue
} from '../QueryHelper';
import { logger } from "@/lib/logger";

export const editTableRow = async (props) => {
    const { conn, table, formData } = props;
    const { columns, values } = formFormat({ formData });

    const query = `
      INSERT INTO ${table} 
          (${columns})
      VALUES (
          ${values}
      )`
    
    try {
        const result = await executeQuery(conn, query);
        return result;
    } catch (error) {
        logger.error('Error inserting or updating row:', error);
        throw error;
    }
};

export const editNewTableRow = async (props) => {
    const { conn, table, formData, column, old_stop } = props;

    const updateClause = buildUpdateClause(formData);
  
    const query = `
      UPDATE ${table}
      SET ${updateClause}
      WHERE ${column} = '${old_stop}';
    `;
  
    try {
      const result = await executeQuery(conn, query);
      return result;
    } catch (error) {
      logger.error('Error updating row:', error);
      throw error;
    }
  };

export const insertTableRow = async (props) => {
    const { conn, table, formData } = props;

    const { columns, values } = formFormat({ formData });

    const query = `
      INSERT INTO ${table} 
          (${columns})
      VALUES (
          ${values}
      );`;

    try {
        const result = await executeQuery(conn, query);
        return result;
    } catch (error) {
        logger.error('Error inserting row:', error);
        throw error;
    }
};

export const deleteEditRow = async (props) => {
    const { conn, table, formData, column } = props;

    const lookupColumn = column || Object.keys(formData || {})[0];
    const lookupValue = lookupColumn ? formData?.[lookupColumn] : undefined;

    if (!lookupColumn) {
        throw new Error('deleteEditRow requires at least one lookup field');
    }

    const query = `
    DELETE FROM ${table} 
    WHERE ${lookupColumn} = ${formatSqlValue(lookupValue)}`;

    try {
        const result = await executeQuery(conn, query);
        return result;
    } catch (error) {
        logger.error('Error deleting row:', error);
        throw error;
    }
}
export const truncateTable = async (props) => {
    const { conn, table } = props;

    const query = `TRUNCATE TABLE ${table}`;

    try {
        const result = await executeQuery(conn, query);
        return result;
    } catch (error) {
        logger.error('Error deleting row:', error);
        throw error;
    }
}
