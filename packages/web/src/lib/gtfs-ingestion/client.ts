import JSZip from "jszip"
import pako from "pako"
import { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"
import { logger } from "@/lib/logger"
import { importGtfs } from "@gtfs-viz/duckdb-extension"
import type { SqlExecutor } from "@gtfs-viz/duckdb-extension"
import { fetchGTFSDataAvailability } from "./availability"

export interface GTFSFile {
  name: string
  content: string
  required: boolean
  sizeBytes?: number
  compressedSizeBytes?: number
  uncompressedSizeBytes?: number
}

export interface GTFSZipFileEntry {
  name: string
  compressedSizeBytes: number
  uncompressedSizeBytes: number
}

export interface GTFSZipSource {
  entries: GTFSZipFileEntry[]
  getFileBuffer(fileName: string): Promise<ArrayBuffer>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  files: GTFSFile[]
  zip?: JSZip
  zipSource?: GTFSZipSource
}

export interface GTFSWebImportAnalysis {
  plan: GTFSWebImportPlan
  validation: ValidationResult
}

export interface IngestionProgress {
  percent: number
  message: string
  step: "download" | "extract" | "validate" | "register" | "import" | "reformat" | "complete"
}

export type ProgressCallback = (progress: IngestionProgress) => void

const REQUIRED_FILES = ["stops.txt"] as const

export const USED_FILES = [
  "stops.txt",
  "pathways.txt",
  "routes.txt",
  "trips.txt",
  "stop_times.txt",
  "shapes.txt",
  "calendar.txt",
  "calendar_dates.txt",
] as const

export type GTFSImportFileName = (typeof USED_FILES)[number]

export type GTFSImportSelection = Partial<Record<GTFSImportFileName, boolean>>

export type NormalizedGTFSImportSelection = Record<GTFSImportFileName, boolean>

export interface GTFSImportFilePlan {
  name: GTFSImportFileName
  label: string
  available: boolean
  required: boolean
  selected: boolean
  recommended: boolean
  sizeBytes: number
  estimatedBytes: number
  dependencies: GTFSImportFileName[]
  dependents: GTFSImportFileName[]
}

export interface GTFSWebImportPlan {
  files: GTFSImportFilePlan[]
  selection: NormalizedGTFSImportSelection
  recommendedSelection: NormalizedGTFSImportSelection
  shouldLimit: boolean
  sourceSizeBytes: number
  selectedSizeBytes: number
  selectedEstimatedBytes: number
  recommendedEstimatedBytes: number
  duckdbWasmLimitBytes: number
}

export const GTFS_IMPORT_FILE_LABELS: Record<GTFSImportFileName, string> = {
  "stops.txt": "Stations and stops",
  "pathways.txt": "Pathways",
  "routes.txt": "Routes",
  "trips.txt": "Trips",
  "stop_times.txt": "Stop times",
  "shapes.txt": "Shapes",
  "calendar.txt": "Service calendar",
  "calendar_dates.txt": "Service exceptions",
}

export const GTFS_IMPORT_DEPENDENCIES: Record<GTFSImportFileName, GTFSImportFileName[]> = {
  "stops.txt": [],
  "pathways.txt": ["stops.txt"],
  "routes.txt": ["stops.txt"],
  "trips.txt": ["stops.txt", "routes.txt"],
  "stop_times.txt": ["stops.txt", "routes.txt", "trips.txt"],
  "shapes.txt": ["routes.txt", "trips.txt"],
  "calendar.txt": ["routes.txt", "trips.txt"],
  "calendar_dates.txt": ["routes.txt", "trips.txt"],
}

const FILE_IMPORT_MULTIPLIERS: Record<GTFSImportFileName, number> = {
  "stops.txt": 4,
  "pathways.txt": 3,
  "routes.txt": 3,
  "trips.txt": 4,
  "stop_times.txt": 5,
  "shapes.txt": 4,
  "calendar.txt": 3,
  "calendar_dates.txt": 3,
}

export const DUCKDB_WASM_IMPORT_LIMIT_BYTES = 4 * 1024 ** 3

const JSZIP_VALIDATION_FALLBACK_BYTES = 256 * 1024 ** 2

const zipEntryName = (name: string) => name.split("/").pop() || name

const isUsedFile = (name: string): name is GTFSImportFileName =>
  USED_FILES.includes(name as GTFSImportFileName)

const emptyImportSelection = (): NormalizedGTFSImportSelection =>
  Object.fromEntries(USED_FILES.map((name) => [name, false])) as NormalizedGTFSImportSelection

export const getGTFSImportDependents = (fileName: GTFSImportFileName): GTFSImportFileName[] =>
  USED_FILES.filter((name) => GTFS_IMPORT_DEPENDENCIES[name].includes(fileName))

export const normalizeGTFSImportSelection = (
  selection?: GTFSImportSelection,
  availableFiles: string[] = [...USED_FILES],
): NormalizedGTFSImportSelection => {
  const available = new Set(availableFiles.filter(isUsedFile))
  const normalized = emptyImportSelection()

  for (const fileName of USED_FILES) {
    normalized[fileName] = available.has(fileName) && selection?.[fileName] !== false
  }

  let changed = true
  while (changed) {
    changed = false
    for (const fileName of USED_FILES) {
      if (!normalized[fileName]) {
        continue
      }
      const dependenciesMet = GTFS_IMPORT_DEPENDENCIES[fileName].every(
        (dependency) => normalized[dependency],
      )
      if (!dependenciesMet) {
        normalized[fileName] = false
        changed = true
      }
    }
  }

  return normalized
}

export const updateGTFSImportSelection = (
  selection: GTFSImportSelection,
  fileName: GTFSImportFileName,
  checked: boolean,
  availableFiles: string[] = [...USED_FILES],
): NormalizedGTFSImportSelection => {
  const available = new Set(availableFiles.filter(isUsedFile))
  const next = normalizeGTFSImportSelection(selection, availableFiles)

  if (checked) {
    const enableWithDependencies = (name: GTFSImportFileName) => {
      if (!available.has(name)) {
        return
      }
      for (const dependency of GTFS_IMPORT_DEPENDENCIES[name]) {
        enableWithDependencies(dependency)
      }
      next[name] = true
    }
    enableWithDependencies(fileName)
  } else {
    const disableWithDependents = (name: GTFSImportFileName) => {
      next[name] = false
      for (const dependent of getGTFSImportDependents(name)) {
        disableWithDependents(dependent)
      }
    }
    disableWithDependents(fileName)
  }

  return normalizeGTFSImportSelection(next, availableFiles)
}

const getZipEntrySize = (entry: JSZip.JSZipObject) => {
  const data = (
    entry as JSZip.JSZipObject & {
      _data?: { compressedSize?: number; uncompressedSize?: number }
    }
  )._data

  return {
    compressedSizeBytes: data?.compressedSize || 0,
    uncompressedSizeBytes: data?.uncompressedSize || 0,
  }
}

type BrowserZipEntry = GTFSZipFileEntry & {
  compressionMethod: number
  flags: number
  localHeaderOffset: number
}

const readBlobSlice = async (blob: Blob, start: number, end: number): Promise<ArrayBuffer> =>
  await blob.slice(start, end).arrayBuffer()

const findEndOfCentralDirectory = async (file: Blob) => {
  const maxCommentLength = 65535
  const eocdLength = 22
  const readLength = Math.min(file.size, maxCommentLength + eocdLength)
  const start = file.size - readLength
  const buffer = await readBlobSlice(file, start, file.size)
  const view = new DataView(buffer)

  for (let offset = view.byteLength - eocdLength; offset >= 0; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return {
        centralDirectorySize: view.getUint32(offset + 12, true),
        centralDirectoryOffset: view.getUint32(offset + 16, true),
      }
    }
  }

  throw new Error("Could not find ZIP central directory")
}

const parseCentralDirectory = async (file: Blob): Promise<BrowserZipEntry[]> => {
  const { centralDirectorySize, centralDirectoryOffset } = await findEndOfCentralDirectory(file)
  if (centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported by the browser importer")
  }

  const buffer = await readBlobSlice(
    file,
    centralDirectoryOffset,
    centralDirectoryOffset + centralDirectorySize,
  )
  const view = new DataView(buffer)
  const decoder = new TextDecoder()
  const entries: BrowserZipEntry[] = []
  let offset = 0

  while (offset + 46 <= view.byteLength) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      break
    }

    const flags = view.getUint16(offset + 8, true)
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSizeBytes = view.getUint32(offset + 20, true)
    const uncompressedSizeBytes = view.getUint32(offset + 24, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraFieldLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nameStart = offset + 46
    const nameEnd = nameStart + fileNameLength
    const name = decoder.decode(new Uint8Array(buffer, nameStart, fileNameLength))

    if (
      !name.endsWith("/") &&
      compressedSizeBytes !== 0xffffffff &&
      uncompressedSizeBytes !== 0xffffffff &&
      localHeaderOffset !== 0xffffffff
    ) {
      entries.push({
        name,
        compressedSizeBytes,
        uncompressedSizeBytes,
        compressionMethod,
        flags,
        localHeaderOffset,
      })
    }

    offset = nameEnd + extraFieldLength + commentLength
  }

  return entries
}

const inflateRawBuffer = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  const inflated = pako.inflateRaw(new Uint8Array(buffer))
  return inflated.buffer.slice(inflated.byteOffset, inflated.byteOffset + inflated.byteLength)
}

class BrowserGTFSZipSource implements GTFSZipSource {
  entries: GTFSZipFileEntry[]
  private file: Blob
  private entriesByName: Map<string, BrowserZipEntry>

  private constructor(file: Blob, entries: BrowserZipEntry[]) {
    this.file = file
    this.entries = entries
    this.entriesByName = new Map(entries.map((entry) => [zipEntryName(entry.name), entry]))
  }

  static async create(file: Blob): Promise<BrowserGTFSZipSource> {
    return new BrowserGTFSZipSource(file, await parseCentralDirectory(file))
  }

  async getFileBuffer(fileName: string): Promise<ArrayBuffer> {
    const entry = this.entriesByName.get(fileName)
    if (!entry) {
      throw new Error(`${fileName} not found in ZIP`)
    }
    if ((entry.flags & 1) === 1) {
      throw new Error(`${fileName} is encrypted and cannot be imported in the browser`)
    }

    const headerBuffer = await readBlobSlice(
      this.file,
      entry.localHeaderOffset,
      entry.localHeaderOffset + 30,
    )
    const headerView = new DataView(headerBuffer)
    if (headerView.getUint32(0, true) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${fileName}`)
    }

    const fileNameLength = headerView.getUint16(26, true)
    const extraFieldLength = headerView.getUint16(28, true)
    const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength
    const compressedBuffer = await readBlobSlice(
      this.file,
      dataOffset,
      dataOffset + entry.compressedSizeBytes,
    )

    if (entry.compressionMethod === 0) {
      return compressedBuffer
    }
    if (entry.compressionMethod === 8) {
      return await inflateRawBuffer(compressedBuffer)
    }

    throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${fileName}`)
  }
}

export const getDuckDBWasmImportLimitBytes = (): number => DUCKDB_WASM_IMPORT_LIMIT_BYTES

export const getWebGTFSImportBudgetBytes = getDuckDBWasmImportLimitBytes

const getEstimatedFileImportBytes = (file: GTFSFile): number => {
  if (!isUsedFile(file.name)) {
    return 0
  }
  const sizeBytes = file.uncompressedSizeBytes || file.sizeBytes || 0
  return sizeBytes * FILE_IMPORT_MULTIPLIERS[file.name]
}

const getSelectedSizes = (
  files: GTFSFile[],
  selection: NormalizedGTFSImportSelection,
  sourceSizeBytes: number,
) => {
  return files.reduce(
    (totals, file) => {
      if (!isUsedFile(file.name) || !selection[file.name]) {
        return totals
      }

      return {
        selectedSizeBytes:
          totals.selectedSizeBytes + (file.uncompressedSizeBytes || file.sizeBytes || 0),
        selectedEstimatedBytes: totals.selectedEstimatedBytes + getEstimatedFileImportBytes(file),
      }
    },
    {
      selectedSizeBytes: sourceSizeBytes,
      selectedEstimatedBytes: sourceSizeBytes,
    },
  )
}

// Removal order: drop least-feature-activating files first.
// stop_times is usually the largest and adds stop-level detail only;
// calendar variants add service info; shapes add map lines; trips is a
// dependency gateway; pathways/routes each unlock major views; stops is required.
const REMOVAL_ORDER: GTFSImportFileName[] = [
  "stop_times.txt",
  "calendar_dates.txt",
  "calendar.txt",
  "shapes.txt",
  "trips.txt",
  "pathways.txt",
  "routes.txt",
  // stops.txt is never removed
]

export const createGTFSWebImportPlan = (
  validation: ValidationResult,
  sourceSizeBytes: number = 0,
): GTFSWebImportPlan => {
  const availableFiles = validation.files.map((file) => file.name)
  const selection = normalizeGTFSImportSelection(undefined, availableFiles)
  const duckdbWasmLimitBytes = getDuckDBWasmImportLimitBytes()
  const filesByName = new Map(validation.files.map((file) => [file.name, file]))

  // Start with everything available selected, then drop files until under budget
  let normalizedRecommended = normalizeGTFSImportSelection(undefined, availableFiles)
  let recommendedSizes = getSelectedSizes(validation.files, normalizedRecommended, sourceSizeBytes)

  if (recommendedSizes.selectedEstimatedBytes > duckdbWasmLimitBytes) {
    const dropped: Partial<Record<GTFSImportFileName, boolean>> = {}

    for (const fileName of REMOVAL_ORDER) {
      if (!normalizedRecommended[fileName]) continue

      dropped[fileName] = false
      normalizedRecommended = normalizeGTFSImportSelection(
        { ...normalizedRecommended, ...dropped },
        availableFiles,
      )
      recommendedSizes = getSelectedSizes(validation.files, normalizedRecommended, sourceSizeBytes)

      if (recommendedSizes.selectedEstimatedBytes <= duckdbWasmLimitBytes) {
        break
      }
    }
  }

  const selectedSizes = getSelectedSizes(validation.files, selection, sourceSizeBytes)

  const files = USED_FILES.map((name) => {
    const file = filesByName.get(name)
    const sizeBytes = file?.uncompressedSizeBytes || file?.sizeBytes || 0
    return {
      name,
      label: GTFS_IMPORT_FILE_LABELS[name],
      available: Boolean(file),
      required: name === "stops.txt",
      selected: selection[name],
      recommended: normalizedRecommended[name],
      sizeBytes,
      estimatedBytes: file ? getEstimatedFileImportBytes(file) : 0,
      dependencies: GTFS_IMPORT_DEPENDENCIES[name],
      dependents: getGTFSImportDependents(name),
    }
  })

  return {
    files,
    selection,
    recommendedSelection: normalizedRecommended,
    shouldLimit: selectedSizes.selectedEstimatedBytes > duckdbWasmLimitBytes,
    sourceSizeBytes,
    selectedSizeBytes: selectedSizes.selectedSizeBytes,
    selectedEstimatedBytes: selectedSizes.selectedEstimatedBytes,
    recommendedEstimatedBytes: recommendedSizes.selectedEstimatedBytes,
    duckdbWasmLimitBytes,
  }
}

export const analyzeGTFSZipForWebImport = async (
  file: File,
  onProgress?: ProgressCallback,
): Promise<GTFSWebImportPlan> => {
  const analysis = await prepareGTFSZipForWebImport(file, onProgress)
  return analysis.plan
}

export const prepareGTFSZipForWebImport = async (
  file: File,
  onProgress?: ProgressCallback,
): Promise<GTFSWebImportAnalysis> => {
  const validation = await validateGTFSZip(file, onProgress)
  if (!validation.valid) {
    throw new Error(`Validation failed:\n${validation.errors.join("\n")}`)
  }
  return {
    plan: createGTFSWebImportPlan(validation, file.size),
    validation,
  }
}

export const isLikelyDuckDBMemoryError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /out of memory|memory access out of bounds|allocation failed|cannot enlarge memory|wasm memory|array buffer allocation|maximum call stack|worker.*terminated/i.test(
    message,
  )
}

export async function validateGTFSZip(
  file: File,
  onProgress?: ProgressCallback,
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const files: GTFSFile[] = []

  try {
    onProgress?.({ percent: 0, message: "Loading ZIP file...", step: "validate" })

    let zipSource: GTFSZipSource | undefined
    let zip: JSZip | undefined
    let zipEntriesByName: Map<string, GTFSZipFileEntry | JSZip.JSZipObject>

    try {
      zipSource = await BrowserGTFSZipSource.create(file)
      zipEntriesByName = new Map(
        zipSource.entries.map((entry) => [zipEntryName(entry.name), entry]),
      )
    } catch (zipReaderError) {
      if (file.size > JSZIP_VALIDATION_FALLBACK_BYTES) {
        throw zipReaderError
      }
      zip = await JSZip.loadAsync(file)
      const zipEntries = Object.values(zip.files).filter((entry) => !entry.dir)
      zipEntriesByName = new Map(zipEntries.map((entry) => [zipEntryName(entry.name), entry]))
    }

    onProgress?.({ percent: 30, message: "Checking required files...", step: "validate" })

    for (const requiredFile of REQUIRED_FILES) {
      const found = zipEntriesByName.has(requiredFile)
      if (!found) {
        errors.push(`Missing required file: ${requiredFile}`)
      }
    }

    onProgress?.({ percent: 60, message: "Validating file structure...", step: "validate" })

    for (const fileName of USED_FILES) {
      const zipEntry = zipEntriesByName.get(fileName)

      if (zipEntry && !("dir" in zipEntry && zipEntry.dir)) {
        const size =
          "compressedSizeBytes" in zipEntry
            ? {
                compressedSizeBytes: zipEntry.compressedSizeBytes,
                uncompressedSizeBytes: zipEntry.uncompressedSizeBytes,
              }
            : getZipEntrySize(zipEntry)
        files.push({
          name: fileName,
          content: "",
          required: REQUIRED_FILES.includes(fileName as any),
          sizeBytes: size.uncompressedSizeBytes || size.compressedSizeBytes,
          compressedSizeBytes: size.compressedSizeBytes,
          uncompressedSizeBytes: size.uncompressedSizeBytes,
        })

        logger.log(`  Found ${fileName}`)
      }
    }

    onProgress?.({ percent: 100, message: "Validation complete", step: "validate" })

    return { valid: errors.length === 0, errors, warnings, files, zip, zipSource }
  } catch (error) {
    errors.push(
      `Failed to read ZIP file: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
    return { valid: false, errors, warnings, files }
  }
}

export async function validateGTFSUrl(
  url: string,
  onProgress?: ProgressCallback,
): Promise<ValidationResult> {
  try {
    onProgress?.({ percent: 0, message: "Downloading GTFS feed...", step: "download" })

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    onProgress?.({ percent: 50, message: "Download complete, validating...", step: "extract" })

    const blob = await response.blob()
    const file = new File([blob], "gtfs.zip", { type: "application/zip" })

    return validateGTFSZip(file, onProgress)
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Failed to download URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      warnings: [],
      files: [],
    }
  }
}

export async function downloadGTFSZip(
  url: string,
  signal?: AbortSignal,
  onBytes?: (loaded: number, total: number | null) => void,
): Promise<File> {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/zip, application/octet-stream",
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const fileName = url.split("/").pop()?.split("?")[0] || "example.zip"
  if (onBytes && response.body) {
    const lengthHeader = Number(response.headers.get("content-length"))
    const total = Number.isFinite(lengthHeader) && lengthHeader > 0 ? lengthHeader : null
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0
    onBytes(0, total)
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        loaded += value.byteLength
        onBytes(loaded, total)
      }
    }
    return new File(chunks as BlobPart[], fileName, { type: "application/zip" })
  }

  const blob = await response.blob()
  return new File([blob], fileName, { type: "application/zip" })
}

export async function loadIngestionProcedures(_conn: AsyncDuckDBConnection): Promise<void> {}

export async function registerGTFSFiles(
  db: AsyncDuckDB,
  zip: JSZip | GTFSZipSource,
  fileNames: string[],
  onProgress?: ProgressCallback,
  selectedFiles?: GTFSImportSelection,
): Promise<void> {
  try {
    onProgress?.({ percent: 0, message: "Registering files with DuckDB...", step: "register" })

    const selection = normalizeGTFSImportSelection(selectedFiles, fileNames)
    const filesToRegister = fileNames.filter(
      (name): name is GTFSImportFileName => isUsedFile(name) && selection[name],
    )

    logger.log(
      `Registering ${filesToRegister.length} files (skipping ${fileNames.length - filesToRegister.length} unused files)`,
    )

    if (filesToRegister.length === 0) {
      throw new Error("No GTFS files selected for import")
    }

    const zipEntriesByName =
      "entries" in zip
        ? new Map(zip.entries.map((entry) => [zipEntryName(entry.name), entry]))
        : new Map(
            Object.values(zip.files)
              .filter((entry) => !entry.dir)
              .map((entry) => [zipEntryName(entry.name), entry]),
          )

    for (let i = 0; i < filesToRegister.length; i++) {
      const fileName = filesToRegister[i]
      const percent = ((i + 1) / filesToRegister.length) * 100

      onProgress?.({
        percent,
        message: `Registering ${fileName}...`,
        step: "register",
      })

      const zipEntry = zipEntriesByName.get(fileName)
      if (zipEntry && !("dir" in zipEntry && zipEntry.dir)) {
        const arrayBuffer =
          "getFileBuffer" in zip
            ? await zip.getFileBuffer(fileName)
            : await (zipEntry as JSZip.JSZipObject).async("arraybuffer")
        const uint8Array = new Uint8Array(arrayBuffer)

        await db.registerFileBuffer(fileName, uint8Array)

        const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2)
        logger.log(`  Registered ${fileName} (${sizeMB} MB)`)
      }
    }

    onProgress?.({ percent: 100, message: "All files registered", step: "register" })
  } catch (error) {
    logger.error("Failed to register files:", error)
    throw error
  }
}

export async function runIngestion(
  conn: AsyncDuckDBConnection,
  _skipReformat: boolean = false,
  onProgress?: ProgressCallback,
  hasPathwaysFile: boolean = false,
  hasRoutesFile: boolean = false,
  hasTripsFile: boolean = false,
  hasStopTimesFile: boolean = false,
  hasShapesFile: boolean = false,
  hasCalendarFile: boolean = false,
  hasCalendarDatesFile: boolean = false,
  onCsvImported?: () => Promise<void>,
): Promise<{ hasStations: boolean; hasStops: boolean; hasRoutes: boolean }> {
  try {
    onProgress?.({
      percent: 20,
      message: "Importing and reformatting GTFS data...",
      step: "import",
    })

    const executor: SqlExecutor = async (sql: string) => {
      await conn.query(sql)
    }

    await importGtfs(executor, {
      stopsPath: "stops.txt",
      pathwaysPath: hasPathwaysFile ? "pathways.txt" : undefined,
      routesPath: hasRoutesFile ? "routes.txt" : undefined,
      tripsPath: hasTripsFile ? "trips.txt" : undefined,
      stopTimesPath: hasStopTimesFile ? "stop_times.txt" : undefined,
      shapesPath: hasShapesFile ? "shapes.txt" : undefined,
      calendarPath: hasCalendarFile ? "calendar.txt" : undefined,
      calendarDatesPath: hasCalendarDatesFile ? "calendar_dates.txt" : undefined,
      onCsvImported,
      onProgress: ({ phase, done, total, detail }) => {
        const frac = total > 0 ? Math.min(1, done / total) : 1
        if (phase === "macros") {
          onProgress?.({
            percent: 20 + frac * 2,
            message: "Preparing database helpers...",
            step: "import",
          })
        } else if (phase === "drop") {
          onProgress?.({
            percent: 22 + frac * 2,
            message: "Clearing previous tables...",
            step: "import",
          })
        } else if (phase === "import") {
          const step = Math.min(done + 1, total)
          onProgress?.({
            percent: 24 + frac * 36,
            message: detail
              ? `Loading ${detail} (${step}/${total})...`
              : `Loading GTFS tables (${step}/${total})...`,
            step: "import",
          })
        } else {
          onProgress?.({
            percent: 60 + frac * 28,
            message: detail
              ? `Building ${detail} (${done}/${total})...`
              : `Building views and tables (${done}/${total})...`,
            step: "reformat",
          })
        }
      },
    })

    // Add geom columns if spatial extension is available
    try {
      await conn.query(`SELECT ST_Point(0, 0)`)
      const { addGeomColumnsSql } = await import("@gtfs-viz/duckdb-extension")
      await conn.query(addGeomColumnsSql())
    } catch {
      // spatial not available — skip geom columns
    }

    onProgress?.({ percent: 90, message: "Validating data...", step: "complete" })

    const availability = await fetchGTFSDataAvailability(conn)

    logger.log(
      `Data imported: ${availability.stations + availability.stops} stops, ${availability.hasStations ? "includes stations" : "no stations"}, ${availability.hasRoutes ? "includes routes" : "no routes"}`,
    )

    onProgress?.({ percent: 100, message: "Ingestion complete!", step: "complete" })

    return {
      hasStations: availability.hasStations,
      hasStops: availability.hasStops,
      hasRoutes: availability.hasRoutes,
    }
  } catch (error) {
    logger.error("Ingestion failed:", error)
    throw error
  }
}

export async function ingestGTFS(
  db: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  source: File | string,
  options: {
    skipReformat?: boolean
    onProgress?: ProgressCallback
    selectedFiles?: GTFSImportSelection
  } = {},
): Promise<{ hasStations: boolean; hasStops: boolean; hasRoutes: boolean }> {
  const { skipReformat = false, onProgress, selectedFiles } = options

  try {
    onProgress?.({ percent: 0, message: "Starting validation...", step: "validate" })

    let validation: ValidationResult
    if (typeof source === "string") {
      validation = await validateGTFSUrl(source, onProgress)
    } else {
      validation = await validateGTFSZip(source, onProgress)
    }

    return await ingestValidatedGTFS(db, conn, validation, {
      skipReformat,
      onProgress,
      selectedFiles,
    })
  } catch (error) {
    logger.error("GTFS ingestion failed:", error)
    throw error
  }
}

export async function ingestValidatedGTFS(
  db: AsyncDuckDB,
  conn: AsyncDuckDBConnection,
  validation: ValidationResult,
  options: {
    skipReformat?: boolean
    onProgress?: ProgressCallback
    selectedFiles?: GTFSImportSelection
  } = {},
): Promise<{ hasStations: boolean; hasStops: boolean; hasRoutes: boolean }> {
  const { skipReformat = false, onProgress, selectedFiles } = options

  if (!validation.valid) {
    throw new Error(`Validation failed:\n${validation.errors.join("\n")}`)
  }

  if (validation.warnings.length > 0) {
    logger.log("Validation warnings:", validation.warnings)
  }

  const zip = validation.zipSource || validation.zip

  if (!zip) {
    throw new Error("ZIP file not available from validation")
  }

  onProgress?.({ percent: 10, message: "Registering files...", step: "register" })

  const fileNames = validation.files.map((f) => f.name)
  const selection = normalizeGTFSImportSelection(selectedFiles, fileNames)

  if (!selection["stops.txt"]) {
    throw new Error("stops.txt is required to use GTFS Viz in the browser importer")
  }

  await registerGTFSFiles(
    db,
    zip,
    fileNames,
    onProgress ? (p) => onProgress({ ...p, percent: 10 + p.percent * 0.1 }) : undefined,
    selection,
  )

  const dropCsvBuffers = async () => {
    for (const fileName of fileNames) {
      try {
        await db.dropFile(fileName)
      } catch {}
    }
  }

  return await runIngestion(
    conn,
    skipReformat,
    onProgress,
    selection["pathways.txt"],
    selection["routes.txt"],
    selection["trips.txt"],
    selection["stop_times.txt"],
    selection["shapes.txt"],
    selection["calendar.txt"],
    selection["calendar_dates.txt"],
    dropCsvBuffers,
  )
}
