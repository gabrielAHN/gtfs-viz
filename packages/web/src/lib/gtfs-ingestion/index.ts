import { logger } from "@/lib/logger"
import { InitializeHybridPathfinding } from "@/lib/duckdb/DataFetching/pathways"
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"

import {
  ingestGTFS,
  downloadGTFSZip,
  validateGTFSZip,
  validateGTFSUrl,
  ingestValidatedGTFS,
  loadIngestionProcedures,
  registerGTFSFiles,
  runIngestion,
  analyzeGTFSZipForWebImport,
  createGTFSWebImportPlan,
  getDuckDBWasmImportLimitBytes,
  getGTFSImportDependents,
  getWebGTFSImportBudgetBytes,
  isLikelyDuckDBMemoryError,
  normalizeGTFSImportSelection,
  prepareGTFSZipForWebImport,
  updateGTFSImportSelection,
  USED_FILES,
  type GTFSFile,
  type GTFSImportFileName,
  type GTFSImportFilePlan,
  type GTFSImportSelection,
  type GTFSWebImportAnalysis,
  type GTFSWebImportPlan,
  type ValidationResult,
  type IngestionProgress,
  type ProgressCallback,
} from "./client"

import { validateZipContents, readZipFiles } from "./validation"
import {
  clearGTFSAvailabilityStorage,
  fetchGTFSDataAvailability,
  writeGTFSAvailabilityToStorage,
  type GTFSDataAvailability,
} from "./availability"
import {
  requiredFiles,
  keepColumnsFromCSV,
  mapArrowTypeToSQL,
  generateCreateTableQuery,
} from "./schema"

export {
  ingestGTFS,
  downloadGTFSZip,
  validateGTFSZip,
  validateGTFSUrl,
  ingestValidatedGTFS,
  loadIngestionProcedures,
  registerGTFSFiles,
  runIngestion,
  analyzeGTFSZipForWebImport,
  createGTFSWebImportPlan,
  getDuckDBWasmImportLimitBytes,
  getGTFSImportDependents,
  getWebGTFSImportBudgetBytes,
  isLikelyDuckDBMemoryError,
  normalizeGTFSImportSelection,
  prepareGTFSZipForWebImport,
  updateGTFSImportSelection,
  USED_FILES,
  type GTFSFile,
  type GTFSImportFileName,
  type GTFSImportFilePlan,
  type GTFSImportSelection,
  type GTFSWebImportAnalysis,
  type GTFSWebImportPlan,
  type ValidationResult,
  type IngestionProgress,
  type ProgressCallback,
}

export {
  validateZipContents,
  readZipFiles,
  clearGTFSAvailabilityStorage,
  fetchGTFSDataAvailability,
  writeGTFSAvailabilityToStorage,
  type GTFSDataAvailability,
  requiredFiles,
  keepColumnsFromCSV,
  mapArrowTypeToSQL,
  generateCreateTableQuery,
}

export async function importGTFSFromZip(
  conn: AsyncDuckDBConnection,
  file: File,
  db: AsyncDuckDB,
  options: {
    selectedFiles?: GTFSImportSelection
    validation?: ValidationResult
    onProgress?: ProgressCallback
  } = {},
): Promise<{
  hasStations: boolean
  hasStops: boolean
  hasRoutes: boolean
  skipReformat?: boolean
}> {
  if (options.validation) {
    return await ingestValidatedGTFS(db, conn, options.validation, {
      skipReformat: false,
      selectedFiles: options.selectedFiles,
      onProgress: options.onProgress,
    })
  }

  return await ingestGTFS(db, conn, file, {
    skipReformat: false,
    selectedFiles: options.selectedFiles,
    onProgress: options.onProgress,
  })
}

export async function importGTFSFromURL(
  conn: AsyncDuckDBConnection,
  url: string,
  db: AsyncDuckDB,
  options: { selectedFiles?: GTFSImportSelection } = {},
): Promise<{
  hasStations: boolean
  hasStops: boolean
  hasRoutes: boolean
  skipReformat?: boolean
}> {
  return await ingestGTFS(db, conn, url, {
    skipReformat: false,
    selectedFiles: options.selectedFiles,
  })
}

async function checkTablesExist(conn: any, tableNames: string[]): Promise<boolean> {
  try {
    const result = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name IN (${tableNames.map((t) => `'${t}'`).join(",")})
    `)
    const count = result.toArray()[0]?.count || 0
    return Number(count) === tableNames.length
  } catch (error) {
    logger.error(`Error checking tables: ${tableNames.join(", ")}`, error)
    return false
  }
}

async function verifyGTFSData(conn: any): Promise<void> {
  logger.log("Verifying GTFS data formatting...")

  const columnsCheck = await conn.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'stops'
    ORDER BY ordinal_position
  `)
  const columns = columnsCheck.toArray().map((c: any) => c.column_name)

  if (
    !columns.includes("row_id") ||
    !columns.includes("location_type_name") ||
    !columns.includes("wheelchair_status")
  ) {
    throw new Error(
      "Stops table not properly formatted. Expected columns: row_id, location_type_name, wheelchair_status",
    )
  }

  logger.log("  Stops table formatted correctly")

  const hasPathways = await checkTablesExist(conn, ["pathways"])
  if (hasPathways) {
    logger.log("  Pathways table detected")
  }
}

/**
 * Set up pathway-specific features after extension is already installed.
 * importGtfs() already ran macros + CSV import + installInit(),
 * so we only need to initialize pathfinding here.
 */
async function initializePathfinding(conn: any): Promise<void> {
  const hasPathwaysAndStops = await checkTablesExist(conn, ["pathways", "stops"])

  let hasPathwaysData = false
  if (hasPathwaysAndStops) {
    const pathwaysDataCheck = await conn.query("SELECT COUNT(*) as count FROM pathways")
    hasPathwaysData = pathwaysDataCheck.toArray()[0]?.count > 0
  }

  if (hasPathwaysData) {
    logger.log("Initializing pathfinding...")
    const pathfindingResult = await InitializeHybridPathfinding(conn)
    if (pathfindingResult.success) {
      logger.log(`  Pathfinding initialized (${pathfindingResult.method})`)
    } else {
      logger.warn(`  Pathfinding initialization had issues: ${pathfindingResult.description}`)
    }
  } else {
    logger.log("  No pathways data found - skipping pathfinding")
  }
}

export default async function setupGTFSData(
  conn: any,
  onProgress?: (percent: number, message: string) => void,
): Promise<string> {
  try {
    onProgress?.(0, "Verifying imported tables...")
    await verifyGTFSData(conn)
    onProgress?.(40, "Preparing station pathfinding...")
    await initializePathfinding(conn)
    onProgress?.(100, "Processing complete! Loading dashboard...")
    logger.log("GTFS setup complete")
    return "Success"
  } catch (error: any) {
    logger.error("GTFS setup failed:", error)
    logger.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
    })
    throw error
  }
}
