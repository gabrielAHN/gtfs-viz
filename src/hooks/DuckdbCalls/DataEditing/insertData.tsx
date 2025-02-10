import {
    formFormat,
    executeQuery,
    buildUpdateClause
} from '../QueryHelper';

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
        console.error('Error inserting or updating row:', error);
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
      console.error('Error updating row:', error);
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
        console.error('Error inserting row:', error);
        throw error;
    }
};

export const deleteEditRow = async (props) => {
    const { conn, table, formData } = props;

    const query = `
    DELETE FROM ${table} 
    WHERE stop_id == '${formData.stop_id}'`;

    try {
        const result = await executeQuery(conn, query);
        return result;
    } catch (error) {
        console.error('Error deleting row:', error);
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
        console.error('Error deleting row:', error);
        throw error;
    }
}