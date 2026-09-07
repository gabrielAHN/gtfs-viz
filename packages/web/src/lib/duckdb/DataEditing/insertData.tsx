import { formFormat, executeQuery, buildUpdateClause, formatSqlValue } from "../QueryHelper"
import { logger } from "@/lib/logger"

export const editTableRow = async (props) => {
  const { conn, table, formData } = props
  const { columns, values } = formFormat({ formData })

  const query = `
      INSERT INTO ${table} 
          (${columns})
      VALUES (
          ${values}
      )`

  try {
    const result = await executeQuery(conn, query)
    return result
  } catch (error) {
    logger.error("Error inserting or updating row:", error)
    throw error
  }
}

export const editNewTableRow = async (props) => {
  const { conn, table, formData, column, old_stop } = props

  const updateClause = buildUpdateClause(formData)

  const query = `
      UPDATE ${table}
      SET ${updateClause}
      WHERE ${column} = ${formatSqlValue(old_stop)};
    `

  try {
    const result = await executeQuery(conn, query)
    return result
  } catch (error) {
    logger.error("Error updating row:", error)
    throw error
  }
}

export const insertTableRow = async (props) => {
  const { conn, table, formData } = props

  const { columns, values } = formFormat({ formData })

  const query = `
      INSERT INTO ${table} 
          (${columns})
      VALUES (
          ${values}
      );`

  try {
    const result = await executeQuery(conn, query)
    return result
  } catch (error) {
    logger.error("Error inserting row:", error)
    throw error
  }
}

export const deleteEditRow = async (props) => {
  const { conn, table, formData, column } = props

  const lookupColumn = column || Object.keys(formData || {})[0]
  const lookupValue = lookupColumn ? formData?.[lookupColumn] : undefined

  if (!lookupColumn) {
    throw new Error("deleteEditRow requires at least one lookup field")
  }

  const query = `
    DELETE FROM ${table} 
    WHERE ${lookupColumn} = ${formatSqlValue(lookupValue)}`

  try {
    const result = await executeQuery(conn, query)
    return result
  } catch (error) {
    logger.error("Error deleting row:", error)
    throw error
  }
}
export const truncateTable = async (props) => {
  const { conn, table } = props

  const query = `TRUNCATE TABLE ${table}`

  try {
    const result = await executeQuery(conn, query)
    return result
  } catch (error) {
    logger.error("Error deleting row:", error)
    throw error
  }
}

/**
 * Refresh a materialized table by re-running its source macro.
 * Call after edits to keep materialized tables in sync with views.
 */
export const refreshMaterializedTable = async (conn, tableName) => {
  const macroMap: Record<string, string> = {
    TripsTable: "get_trips_table_data",
    CalendarTable: "get_calendar_table_data",
    StopsTable: "get_stops_table_data",
    StationsTable: "get_stations_table_data",
    RoutesTable: "get_routes_table_data",
  }
  const macro = macroMap[tableName]
  if (!macro) return
  try {
    await executeQuery(conn, `CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM ${macro}()`)
  } catch (error) {
    logger.error(`Error refreshing ${tableName}:`, error)
  }
}
