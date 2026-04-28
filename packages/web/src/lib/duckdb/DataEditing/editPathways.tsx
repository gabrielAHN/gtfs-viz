import { insertTableRow, editTableRow, editNewTableRow, deleteEditRow } from './insertData';
import { executeQuery } from '../QueryHelper';
import { logger } from "@/lib/logger";

/**
 * Insert a new pathway connection
 * Uses EditPathwayTable to track new pathways
 */
export const insertPathway = async (props: {
  conn: any;
  pathway_id: string;
  from_stop_id: string;
  to_stop_id: string;
  pathway_mode: number;
  is_bidirectional: number;
  traversal_time?: number | null;
  length?: number | null;
  stair_count?: number | null;
  max_slope?: number | null;
  min_width?: number | null;
  signposted_as?: string | null;
  reversed_signposted_as?: string | null;
}) => {
  const {
    conn,
    pathway_id,
    from_stop_id,
    to_stop_id,
    pathway_mode,
    is_bidirectional,
    traversal_time,
    length,
    stair_count,
    max_slope,
    min_width,
    signposted_as,
    reversed_signposted_as,
  } = props;

  try {
    // Generate a unique row_id for the edit table
    const row_id_result = await executeQuery(
      conn,
      `
        SELECT COALESCE(MAX(row_id), 0) + 1 AS next_id
        FROM (
          SELECT row_id FROM pathways
          UNION ALL
          SELECT row_id FROM EditPathwayTable
        ) combined
      `
    );
    const row_id = row_id_result[0]?.next_id || 1;

    // Insert into EditPathwayTable as a new pathway
    await insertTableRow({
      conn,
      table: 'EditPathwayTable',
      formData: {
        row_id: row_id,
        pathway_id: pathway_id,
        from_stop_id: from_stop_id,
        to_stop_id: to_stop_id,
        pathway_mode: pathway_mode,
        is_bidirectional: is_bidirectional,
        length: length || null,
        traversal_time: traversal_time || null,
        stair_count: stair_count || null,
        max_slope: max_slope || null,
        min_width: min_width || null,
        signposted_as: signposted_as || null,
        reversed_signposted_as: reversed_signposted_as || null,
        status: 'new',
      },
    });

    logger.log('Pathway inserted successfully:', pathway_id);
    return { pathway_id, row_id };
  } catch (error) {
    logger.error('Error inserting pathway:', error);
    throw error;
  }
};

/**
 * Update an existing pathway connection
 * Uses EditPathwayTable to track edits
 */
export const updatePathway = async (props: {
  conn: any;
  SelectPathway: any;
  formData: {
    from_stop_id?: string | null;
    to_stop_id?: string | null;
    pathway_mode?: number;
    is_bidirectional?: number;
    traversal_time?: number | null;
    length?: number | null;
    stair_count?: number | null;
    max_slope?: number | null;
    min_width?: number | null;
    signposted_as?: string | null;
    reversed_signposted_as?: string | null;
  };
}) => {
  const { conn, SelectPathway, formData } = props;

  try {
    // If pathway has no status (original from pathways table), create edit entry
    if (SelectPathway.status === '') {
      await editTableRow({
        conn,
        table: 'EditPathwayTable',
        column: 'row_id',
        formData: {
          row_id: SelectPathway.row_id,
          pathway_id: SelectPathway.pathway_id,
          from_stop_id: formData.from_stop_id ?? SelectPathway.from_stop_id,
          to_stop_id: formData.to_stop_id ?? SelectPathway.to_stop_id,
          pathway_mode: formData.pathway_mode ?? SelectPathway.pathway_mode,
          is_bidirectional: formData.is_bidirectional ?? SelectPathway.is_bidirectional,
          length: formData.length ?? SelectPathway.length,
          traversal_time: formData.traversal_time ?? SelectPathway.traversal_time,
          stair_count: formData.stair_count ?? SelectPathway.stair_count,
          max_slope: formData.max_slope ?? SelectPathway.max_slope,
          min_width: formData.min_width ?? SelectPathway.min_width,
          signposted_as: formData.signposted_as ?? SelectPathway.signposted_as,
          reversed_signposted_as: formData.reversed_signposted_as ?? SelectPathway.reversed_signposted_as,
          status: 'edit',
        },
      });
    }
    // If pathway is already new or edited, update the edit entry
    else if (SelectPathway.status === 'new' || SelectPathway.status === 'new edit') {
      await editNewTableRow({
        conn,
        table: 'EditPathwayTable',
        column: 'row_id',
        old_stop: SelectPathway.row_id,
        formData: {
          row_id: SelectPathway.row_id,
          pathway_id: SelectPathway.pathway_id,
          from_stop_id: formData.from_stop_id ?? SelectPathway.from_stop_id,
          to_stop_id: formData.to_stop_id ?? SelectPathway.to_stop_id,
          pathway_mode: formData.pathway_mode ?? SelectPathway.pathway_mode,
          is_bidirectional: formData.is_bidirectional ?? SelectPathway.is_bidirectional,
          length: formData.length ?? SelectPathway.length,
          traversal_time: formData.traversal_time ?? SelectPathway.traversal_time,
          stair_count: formData.stair_count ?? SelectPathway.stair_count,
          max_slope: formData.max_slope ?? SelectPathway.max_slope,
          min_width: formData.min_width ?? SelectPathway.min_width,
          signposted_as: formData.signposted_as ?? SelectPathway.signposted_as,
          reversed_signposted_as: formData.reversed_signposted_as ?? SelectPathway.reversed_signposted_as,
          status: 'new edit',
        },
      });
    }
    // If pathway is already in edit status, update it
    else if (SelectPathway.status === 'edit') {
      await editNewTableRow({
        conn,
        table: 'EditPathwayTable',
        column: 'pathway_id',
        old_stop: SelectPathway.pathway_id,
        formData: {
          row_id: SelectPathway.row_id,
          pathway_id: SelectPathway.pathway_id,
          from_stop_id: formData.from_stop_id ?? SelectPathway.from_stop_id,
          to_stop_id: formData.to_stop_id ?? SelectPathway.to_stop_id,
          pathway_mode: formData.pathway_mode ?? SelectPathway.pathway_mode,
          is_bidirectional: formData.is_bidirectional ?? SelectPathway.is_bidirectional,
          length: formData.length ?? SelectPathway.length,
          traversal_time: formData.traversal_time ?? SelectPathway.traversal_time,
          stair_count: formData.stair_count ?? SelectPathway.stair_count,
          max_slope: formData.max_slope ?? SelectPathway.max_slope,
          min_width: formData.min_width ?? SelectPathway.min_width,
          signposted_as: formData.signposted_as ?? SelectPathway.signposted_as,
          reversed_signposted_as: formData.reversed_signposted_as ?? SelectPathway.reversed_signposted_as,
          status: 'edit',
        },
      });
    }

    logger.log('Pathway updated successfully:', SelectPathway.pathway_id);
  } catch (error) {
    logger.error('Error updating pathway:', error);
    throw error;
  }
};

/**
 * Delete a pathway connection
 * Uses EditPathwayTable to track deletions
 */
export const deletePathway = async (props: {
  conn: any;
  SelectPathway: any;
}) => {
  const { conn, SelectPathway } = props;

  try {
    // If pathway is new or new edit, just remove from EditPathwayTable
    if (SelectPathway?.status === 'new edit' || SelectPathway?.status === 'new') {
      await deleteEditRow({
        conn,
        table: 'EditPathwayTable',
        formData: {
          pathway_id: SelectPathway.pathway_id,
        },
      });
    }
    // If pathway is already edited, remove the edit entry
    else if (SelectPathway?.status === 'edit') {
      await deleteEditRow({
        conn,
        table: 'EditPathwayTable',
        formData: {
          pathway_id: SelectPathway.pathway_id,
        },
      });

      // Check if pathway exists in original pathways table
      const originalQuery = `
        SELECT * FROM pathways
        WHERE pathway_id = '${SelectPathway.pathway_id}'
      `;
      const originalResult = await conn.query(originalQuery).then((result: any) =>
        result.toArray().map((row: any) => row.toJSON())
      );

      if (originalResult.length > 0) {
        // Mark as deleted in EditPathwayTable
        const original = originalResult[0];
        await insertTableRow({
          conn,
          table: 'EditPathwayTable',
          formData: {
            row_id: SelectPathway.row_id,
            pathway_id: original.pathway_id,
            from_stop_id: original.from_stop_id,
            to_stop_id: original.to_stop_id,
            pathway_mode: original.pathway_mode,
            is_bidirectional: original.is_bidirectional,
            length: original.length,
            traversal_time: original.traversal_time,
            stair_count: original.stair_count,
            max_slope: original.max_slope,
            min_width: original.min_width,
            signposted_as: original.signposted_as,
            reversed_signposted_as: original.reversed_signposted_as,
            status: 'deleted',
          },
        });
      }
    }
    // If pathway has no edit status (original), mark as deleted
    else if (SelectPathway.status === '') {
      await insertTableRow({
        conn,
        table: 'EditPathwayTable',
        formData: {
          row_id: SelectPathway.row_id,
          pathway_id: SelectPathway.pathway_id,
          from_stop_id: SelectPathway.from_stop_id,
          to_stop_id: SelectPathway.to_stop_id,
          pathway_mode: SelectPathway.pathway_mode,
          is_bidirectional: SelectPathway.is_bidirectional,
          length: SelectPathway.length,
          traversal_time: SelectPathway.traversal_time,
          stair_count: SelectPathway.stair_count,
          max_slope: SelectPathway.max_slope,
          min_width: SelectPathway.min_width,
          signposted_as: SelectPathway.signposted_as,
          reversed_signposted_as: SelectPathway.reversed_signposted_as,
          status: 'deleted',
        },
      });
    }

    logger.log('Pathway deleted successfully:', SelectPathway.pathway_id);
  } catch (error) {
    logger.error('Error deleting pathway:', error);
    throw error;
  }
};

/**
 * Generate a unique pathway ID
 */
export const generatePathwayId = async (props: {
  conn: any;
  prefix?: string;
}) => {
  const { conn, prefix = 'pathway' } = props;

  const query = `
    SELECT COALESCE(MAX(CAST(REPLACE(pathway_id, '${prefix}_', '') AS INTEGER)), 0) + 1 AS next_id
    FROM (
      SELECT pathway_id FROM pathways WHERE pathway_id LIKE '${prefix}_%'
      UNION ALL
      SELECT pathway_id FROM EditPathwayTable WHERE pathway_id LIKE '${prefix}_%'
    ) combined;
  `;

  try {
    const result = await executeQuery(conn, query);
    const nextId = result[0]?.next_id || 1;
    return `${prefix}_${nextId}`;
  } catch (error) {
    logger.error('Error generating pathway ID:', error);
    // Fallback to timestamp-based ID
    return `${prefix}_${Date.now()}`;
  }
};
