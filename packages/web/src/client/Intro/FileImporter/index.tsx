import { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useDuckDB } from "@/context/duckdb.client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { logger } from "@/lib/logger"

import {
  clearGTFSAvailabilityStorage,
  downloadGTFSZip,
  fetchGTFSDataAvailability,
  importGTFSFromZip,
  isLikelyDuckDBMemoryError,
  normalizeGTFSImportSelection,
  prepareGTFSZipForWebImport,
  updateGTFSImportSelection,
  writeGTFSAvailabilityToStorage,
  type GTFSImportFileName,
  type GTFSImportSelection,
  type GTFSWebImportPlan,
  type ValidationResult,
} from "@/lib/gtfs-ingestion"
import setupGTFSData from "@/lib/gtfs-ingestion"
import { resetProceduresFlag } from "@/lib/duckdb/DataFetching/pathways/fetchStationPathways"
import { resetStationInfoProceduresFlag } from "@/lib/duckdb/DataFetching/fetchStationInfoData"
import { postCliStatus, resolveCliLaunchTarget } from "@/lib/cli"

import ExampleDatasets from "./ExampleDatasets"
import UploadFile from "./UploadFile"

const CLI_INSTALL_URL = "https://www.npmjs.com/package/@gabrielahn/gtfs-viz-cli"

type ImportPromptState = {
  file: File
  plan: GTFSWebImportPlan
  reason: string
}

const selectedFileNames = (selection: GTFSImportSelection) =>
  Object.entries(selection)
    .filter(([, selected]) => selected)
    .map(([fileName]) => fileName)
    .join(", ")

export default function FileImporter() {
  const queryClient = useQueryClient()
  const duckDB = useDuckDB()
  const {
    db,
    conn,
    setInitialized,
    setHasStations,
    setHasStops,
    setHasRoutes,
    refreshDataAvailability,
  } = duckDB || {}
  const router = useRouter()

  const [importedFile, setImportedFile] = useState<File | null>(null)
  const [ErrorMessage, setErrorMessage] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("gtfs_import_error_message")
    } catch {
      return null
    }
  })
  const [errorTitle, setErrorTitle] = useState(() => {
    try {
      return sessionStorage.getItem("gtfs_import_error_title") || "Import Error"
    } catch {
      return "Import Error"
    }
  })
  useEffect(() => {
    try {
      if (ErrorMessage) {
        sessionStorage.setItem("gtfs_import_error_message", ErrorMessage)
        sessionStorage.setItem("gtfs_import_error_title", errorTitle)
      } else {
        sessionStorage.removeItem("gtfs_import_error_message")
        sessionStorage.removeItem("gtfs_import_error_title")
      }
    } catch {}
  }, [ErrorMessage, errorTitle])
  const [LoadingState, setLoadingState] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState("")
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [importPrompt, setImportPrompt] = useState<ImportPromptState | null>(null)
  const [importSelection, setImportSelection] = useState<GTFSImportSelection | null>(null)

  const isCancelledRef = useRef(false)
  const handledErrorRef = useRef<unknown>(null)
  const importValidationRef = useRef<ValidationResult | null>(null)
  const cliLaunchProfile = null

  const clearImportWorkflow = () => {
    setLoadingState(false)
    setImportedFile(null)
    setAbortController(null)
    setImportPrompt(null)
    setImportSelection(null)
    importValidationRef.current = null
    queryClient.removeQueries({ queryKey: ["fetchUploadData"] })
    queryClient.removeQueries({ queryKey: ["createFormatedTables"] })
  }

  const showImportSelectionPrompt = (
    file: File,
    plan: GTFSWebImportPlan,
    validation: ValidationResult,
    reason: string,
  ) => {
    setImportedFile(null)
    importValidationRef.current = validation
    setImportPrompt({ file, plan, reason })
    setImportSelection(plan.recommendedSelection)
    setErrorMessage(null)
    setLoadingState(false)
    setUploadProgress(0)
    setUploadMessage("")
    setAbortController(null)
  }

  const startImportWithSelection = (file: File, selection: GTFSImportSelection) => {
    const availableFiles =
      importPrompt?.plan.files.filter((item) => item.available).map((item) => item.name) || []
    const normalized = normalizeGTFSImportSelection(selection, availableFiles)
    handledErrorRef.current = null
    setImportSelection(normalized)
    setImportPrompt(null)
    setErrorMessage(null)
    setLoadingState(true)
    setUploadProgress(30)
    setUploadMessage(`Importing selected files: ${selectedFileNames(normalized)}`)
    setImportedFile(file)
  }

  const {
    data: uploadData,
    isError: isUploadError,
    error: uploadError,
  } = useQuery({
    queryKey: ["fetchUploadData", importedFile?.name, importSelection],
    queryFn: async () => {
      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user")
      }

      if (conn) {
        try {
          logger.log("🧹 Cleaning up any temporary tables...")
          await conn.query(`DROP TABLE IF EXISTS stops_temp`)
          await conn.query(`DROP TABLE IF EXISTS pathways_temp`)
          await conn.query(`DROP TABLE IF EXISTS routes_temp`)
          await conn.query(`DROP TABLE IF EXISTS trips_temp`)
          await conn.query(`DROP TABLE IF EXISTS stop_times_temp`)
          await conn.query(`DROP TABLE IF EXISTS shapes_temp`)
          logger.log("  ✅ Temporary tables cleaned up")
        } catch {
          logger.log("  ℹ️  No temporary tables to clean up")
        }
      }

      setUploadMessage("Importing GTFS data from ZIP...")
      setUploadProgress(40)
      const result = await importGTFSFromZip(conn, importedFile!, db, {
        selectedFiles: importSelection || undefined,
        validation: importValidationRef.current || undefined,
        onProgress: ({ percent, message }) => {
          if (isCancelledRef.current) return
          setUploadProgress(40 + Math.max(0, Math.min(100, percent)) * 0.4)
          if (message) setUploadMessage(message)
        },
      })

      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user")
      }

      setUploadProgress(80)
      return result
    },
    enabled: !!importedFile && !!conn && !!db && !isCancelledRef.current,
    retry: false,
  })

  const {
    data: formattingData,
    isError: isFormattingError,
    error: formattingError,
    isSuccess: isFormattingSuccess,
  } = useQuery({
    queryKey: ["createFormatedTables"],
    queryFn: async () => {
      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user")
      }

      setUploadMessage("Verifying imported tables...")
      setUploadProgress(80)
      const result = await setupGTFSData(conn, (percent, message) => {
        if (isCancelledRef.current) return
        setUploadProgress(80 + Math.max(0, Math.min(100, percent)) * 0.2)
        setUploadMessage(message)
      })

      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user")
      }

      setUploadProgress(100)
      setUploadMessage("Processing complete! Loading dashboard...")
      return result
    },
    enabled: !!uploadData && !isUploadError && !!conn && !isCancelledRef.current,
    retry: false,
  })

  const resetBeforeNewUpload = async () => {
    isCancelledRef.current = false
    handledErrorRef.current = null

    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }

    setErrorMessage(null)
    setUploadProgress(0)
    setUploadMessage("")
    setImportedFile(null)
    setImportPrompt(null)
    setImportSelection(null)
    importValidationRef.current = null
    clearGTFSAvailabilityStorage()
    queryClient.removeQueries({ queryKey: ["fetchUploadData"] })
    queryClient.removeQueries({ queryKey: ["createFormatedTables"] })

    if (duckDB?.resetDb && !duckDB.isCliLaunch && duckDB.initialized) {
      try {
        setUploadMessage("Preparing a clean database...")
        await duckDB.resetDb()
      } catch (error) {
        logger.error("Could not reset the database before import:", error)
      }
    }

    resetProceduresFlag()
    resetStationInfoProceduresFlag()

    if (setInitialized) setInitialized(false)
    if (setHasStations) setHasStations(false)
    if (setHasStops) setHasStops(false)
    if (setHasRoutes) setHasRoutes(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      setErrorTitle("File Selection Error")
      setErrorMessage("No file selected")
      setLoadingState(false)
      return
    }

    if (file.type !== "application/zip" && !file.name.endsWith(".zip")) {
      setErrorTitle("File Validation Error")
      setErrorMessage("Please upload a valid ZIP file")
      setLoadingState(false)
      return
    }

    try {
      setLoadingState(true)
      setUploadProgress(0)
      setUploadMessage("Starting upload...")

      await resetBeforeNewUpload()

      setUploadMessage(`Validating ${file.name}...`)

      const analysis = await prepareGTFSZipForWebImport(file, ({ percent, message }) => {
        setUploadProgress(percent * 0.2)
        setUploadMessage(message)
      })
      const { plan, validation } = analysis

      if (plan.shouldLimit) {
        showImportSelectionPrompt(
          file,
          plan,
          validation,
          "This feed may be too large for browser import.",
        )
        return
      }

      setUploadMessage("Validation complete! Starting import...")
      setUploadProgress(20)
      setImportSelection(plan.selection)
      importValidationRef.current = validation
      setImportedFile(file)
    } catch (error) {
      logger.error("Validation error:", error)
      setErrorTitle("File Validation Error")
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to validate zip file. Please ensure it's a valid GTFS file.",
      )
      setLoadingState(false)
      setUploadProgress(0)
    }
  }

  const handleExampleFileUpload = async (url: string, retryCount = 3) => {
    setLoadingState(true)
    setUploadProgress(0)
    setUploadMessage("Downloading example dataset...")
    await postCliStatus(cliLaunchProfile, "importing", "Downloading GTFS dataset")

    await resetBeforeNewUpload()

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        if (isCancelledRef.current) {
          return
        }

        setUploadMessage("Downloading example dataset...")
        setUploadProgress(2)

        const controller = new AbortController()
        setAbortController(controller)
        const timeoutId = setTimeout(() => controller.abort(), 60000)

        let file: File
        try {
          const mb = (n: number) => (n / (1024 * 1024)).toFixed(1)
          file = await downloadGTFSZip(url, controller.signal, (loaded, total) => {
            if (isCancelledRef.current) return
            const frac = total
              ? Math.min(1, loaded / total)
              : 1 - Math.exp(-loaded / (30 * 1024 * 1024))
            setUploadProgress(2 + frac * 16)
            setUploadMessage(
              total
                ? `Downloading example dataset... ${mb(loaded)} of ${mb(total)} MB`
                : `Downloading example dataset... ${mb(loaded)} MB`,
            )
          })
        } finally {
          clearTimeout(timeoutId)
        }

        if (isCancelledRef.current) {
          logger.log("Download cancelled by user")
          setLoadingState(false)
          setUploadProgress(0)
          setAbortController(null)
          return
        }

        setUploadMessage("Download complete, validating...")
        setUploadProgress(20)

        const analysis = await prepareGTFSZipForWebImport(file, ({ percent, message }) => {
          setUploadProgress(20 + percent * 0.1)
          setUploadMessage(message)
        })
        const { plan, validation } = analysis

        if (plan.shouldLimit) {
          showImportSelectionPrompt(
            file,
            plan,
            validation,
            "This example feed may be too large for browser import.",
          )
          return
        }

        setUploadMessage("Validation complete! Starting import...")
        setUploadProgress(30)

        setImportSelection(plan.selection)
        importValidationRef.current = validation
        setImportedFile(file)
        setAbortController(null)
        return
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          logger.log("Download cancelled by user")
          setLoadingState(false)
          setUploadProgress(0)
          setAbortController(null)
          return
        }

        lastError = error instanceof Error ? error : new Error("Unknown error")
        logger.error(`Download attempt ${attempt} failed:`, error)

        if (attempt < retryCount) {
          setUploadMessage("Retrying download...")
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    const downloadErrorMessage = lastError?.message?.includes("aborted")
      ? "Download timed out. The file might be too large or your connection is slow. Please try downloading the file manually and uploading it."
      : `Failed to download file: ${lastError?.message || "Unknown error"}. Please check the URL or try uploading the file manually.`
    setErrorTitle("Download Error")
    setErrorMessage(downloadErrorMessage)
    await postCliStatus(
      cliLaunchProfile,
      "error",
      "Failed to download GTFS dataset",
      lastError?.message || "Unknown error",
    )
    setLoadingState(false)
    setUploadProgress(0)
    setAbortController(null)
  }

  const handleCancel = async () => {
    logger.log("🛑 Cancelling upload process...")

    isCancelledRef.current = true
    handledErrorRef.current = null

    setUploadMessage("Cancelling and resetting database...")

    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }

    await queryClient.cancelQueries()
    logger.log("  ✅ React Query queries cancelled")

    if (duckDB?.resetDb) {
      try {
        logger.log("  🔄 Resetting DuckDB to kill all running queries...")
        await duckDB.resetDb()
        logger.log("  ✅ DuckDB reset complete")
      } catch (error) {
        logger.error("  ❌ Error resetting database:", error)
      }
    }

    queryClient.clear()
    logger.log("  ✅ Query cache cleared")

    resetProceduresFlag()
    resetStationInfoProceduresFlag()
    logger.log("  ✅ Procedure flags reset")

    clearGTFSAvailabilityStorage()

    if (setInitialized) {
      setInitialized(false)
    }
    if (setHasStations) {
      setHasStations(false)
    }
    if (setHasStops) {
      setHasStops(false)
    }
    if (setHasRoutes) {
      setHasRoutes(false)
    }

    setLoadingState(false)
    setImportedFile(null)
    setImportPrompt(null)
    setImportSelection(null)
    importValidationRef.current = null
    setErrorMessage(null)
    setUploadProgress(0)
    setUploadMessage("")

    logger.log("✅ Upload cancelled and database reset - ready for new upload")
  }

  useEffect(() => {
    if (isCancelledRef.current) {
      return
    }

    if (!LoadingState) {
      return
    }

    if (!uploadData || !isFormattingSuccess || !formattingData) {
      return
    }

    logger.log("✅ Upload and formatting completed successfully")

    const checkDataAvailability = async () => {
      if (isCancelledRef.current || !conn) {
        return
      }

      try {
        const availability = await fetchGTFSDataAvailability(conn)

        if (isCancelledRef.current) {
          logger.log("⚠️ Cancelled during data check - aborting")
          return
        }

        logger.log("Data availability:", availability)

        if (isCancelledRef.current) {
          logger.log("⚠️ Cancelled before state update - aborting")
          return
        }

        writeGTFSAvailabilityToStorage(availability)

        if (setHasStations) setHasStations(availability.hasStations)
        if (setHasStops) setHasStops(availability.hasStops)
        if (setHasRoutes) setHasRoutes(availability.hasRoutes)

        if (setInitialized) {
          setInitialized(true)
        }

        if (refreshDataAvailability) {
          await refreshDataAvailability()
        }

        const target = await resolveCliLaunchTarget({
          conn,
          profile: cliLaunchProfile,
          hasStations: availability.hasStations,
        })

        await postCliStatus(cliLaunchProfile, "ready", "Import complete")

        if (availability.hasStations || availability.hasStops || availability.hasRoutes) {
          setUploadMessage("Success! Redirecting...")
          // Keep loading state visible — navigate immediately, clear after
          setImportedFile(null)
          setAbortController(null)
          setImportPrompt(null)
          setImportSelection(null)
          if (!isCancelledRef.current) {
            router.navigate({ to: target.to as any, search: target.search as any })
          }
          setTimeout(() => setLoadingState(false), 500)
        } else {
          setUploadMessage("Upload complete, but no stations or stops found")
          await postCliStatus(
            cliLaunchProfile,
            "error",
            "Import complete, but no stations or stops found",
          )
          setLoadingState(false)
        }
      } catch (error) {
        logger.error("Error checking data availability:", error)

        if (isCancelledRef.current) {
          logger.log("⚠️ Error occurred but upload was cancelled - not navigating")
          return
        }

        setUploadMessage("Success! Redirecting to stations...")
        await postCliStatus(cliLaunchProfile, "ready", "Import complete")
        clearImportWorkflow()
        setTimeout(() => {
          if (isCancelledRef.current) {
            logger.log("⚠️ Navigation prevented - upload was cancelled")
            return
          }
          router.navigate({ to: "/stations/map" })
        }, 1000)
      }
    }

    checkDataAvailability()
  }, [
    uploadData,
    isFormattingSuccess,
    formattingData,
    LoadingState,
    router,
    setInitialized,
    setHasStations,
    setHasStops,
    setHasRoutes,
    refreshDataAvailability,
    conn,
  ])

  useEffect(() => {
    if (!isUploadError && !isFormattingError) {
      return
    }

    if (isCancelledRef.current) {
      return
    }

    const error = isUploadError ? uploadError : formattingError
    if (!error || handledErrorRef.current === error) {
      return
    }

    handledErrorRef.current = error

    const failedFile = importedFile
    const title = isUploadError ? "GTFS import failed" : "Table creation failed"
    const logLabel = isUploadError ? "GTFS import error:" : "Table creation error:"
    const memoryReason = isUploadError
      ? "Browser memory ran out during import."
      : "Browser memory ran out while building tables."

    const handleImportError = async () => {
      await postCliStatus(
        cliLaunchProfile,
        "error",
        title,
        error instanceof Error ? error.message : String(error),
      )

      logger.error(logLabel, error)
      const message = error instanceof Error ? error.message : "Unknown error"
      setErrorTitle(title)
      setErrorMessage(message)
      setLoadingState(false)
      setUploadProgress(0)
      setImportedFile(null)
      importValidationRef.current = null
      setAbortController(null)

      resetProceduresFlag()
      resetStationInfoProceduresFlag()
      clearGTFSAvailabilityStorage()

      if (setInitialized) {
        setInitialized(false)
      }
      if (setHasStations) {
        setHasStations(false)
      }
      if (setHasStops) {
        setHasStops(false)
      }
      if (setHasRoutes) {
        setHasRoutes(false)
      }

      if (duckDB?.resetDb) {
        try {
          await duckDB.resetDb()
        } catch (resetError) {
          logger.error("Error resetting database:", resetError)
        }
      }

      if (isLikelyDuckDBMemoryError(error) && failedFile) {
        try {
          setUploadMessage("Preparing reduced import options...")
          const analysis = await prepareGTFSZipForWebImport(failedFile)
          showImportSelectionPrompt(failedFile, analysis.plan, analysis.validation, memoryReason)
        } catch (planError) {
          logger.error("Failed to prepare reduced import options:", planError)
          setErrorTitle(title)
          setErrorMessage(
            `${message}\n\nBrowser memory ran out, and GTFS Viz could not prepare reduced options. Use the CLI for the full dataset.`,
          )
        }
      }
    }

    void handleImportError()
  }, [
    isUploadError,
    isFormattingError,
    uploadError,
    formattingError,
    cliLaunchProfile,
    importedFile,
    duckDB,
    setInitialized,
    setHasStations,
    setHasStops,
    setHasRoutes,
  ])

  const promptAvailableFiles =
    importPrompt?.plan.files.filter((item) => item.available).map((item) => item.name) || []
  const promptSelection = importPrompt
    ? normalizeGTFSImportSelection(
        importSelection || importPrompt.plan.recommendedSelection,
        promptAvailableFiles,
      )
    : null
  const promptSelectedEstimatedBytes = importPrompt
    ? importPrompt.plan.sourceSizeBytes +
      importPrompt.plan.files.reduce((total, file) => {
        return total + (promptSelection?.[file.name] ? file.estimatedBytes : 0)
      }, 0)
    : 0
  const promptSelectedFileCount = promptSelection
    ? Object.values(promptSelection).filter(Boolean).length
    : 0
  const promptMissingRequired = promptSelection ? !promptSelection["stops.txt"] : false
  const promptSelectionOverLimit = importPrompt
    ? promptSelectedEstimatedBytes > importPrompt.plan.duckdbWasmLimitBytes
    : false
  const promptReducedFeatures =
    importPrompt && promptSelection
      ? importPrompt.plan.files.some((file) => file.available && !promptSelection[file.name])
      : false
  const promptHighMemoryFiles = importPrompt
    ? [...importPrompt.plan.files]
        .filter(
          (file) =>
            file.available &&
            file.estimatedBytes + importPrompt.plan.sourceSizeBytes >
              importPrompt.plan.duckdbWasmLimitBytes,
        )
        .sort((left, right) => right.estimatedBytes - left.estimatedBytes)
        .slice(0, 3)
    : []

  const setPromptSelection = (selection: GTFSImportSelection) => {
    setImportSelection(normalizeGTFSImportSelection(selection, promptAvailableFiles))
  }

  const handlePromptFileChange = (fileName: GTFSImportFileName, checked: boolean) => {
    setImportSelection((current) =>
      updateGTFSImportSelection(
        current || importPrompt?.plan.recommendedSelection || {},
        fileName,
        checked,
        promptAvailableFiles,
      ),
    )
  }

  const showUploadComponents = !LoadingState && !importPrompt
  const errorRecoveryMessage =
    errorTitle === "File Selection Error" || errorTitle === "File Validation Error"
      ? "No import was started. Choose another GTFS ZIP."
      : errorTitle === "Download Error"
        ? "The download did not complete. You can upload the ZIP manually."
        : "The browser database was reset so you can try a smaller import."
  const showCliLinkInError =
    errorTitle !== "File Selection Error" && errorTitle !== "File Validation Error"

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {ErrorMessage && !importPrompt && (
        <div className="w-full bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 shadow-md rounded-lg mb-4 overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="import-error" className="border-none">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                  {errorTitle}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm whitespace-pre-wrap">
                    {ErrorMessage}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    {errorRecoveryMessage}
                    {showCliLinkInError && (
                      <>
                        {" "}
                        Use the{" "}
                        <a
                          href={CLI_INSTALL_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold underline"
                        >
                          CLI install
                        </a>{" "}
                        for the full dataset.
                      </>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setErrorMessage(null)
                      await resetBeforeNewUpload()
                    }}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
      {importPrompt && promptSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 shadow-lg rounded-lg text-left flex flex-col">
            <div className="shrink-0 px-4 pt-4 pb-3 space-y-3 border-b border-yellow-300/40">
              <div className="space-y-2">
                <h2 className="font-semibold text-yellow-900 dark:text-yellow-100">
                  Browser import limit
                </h2>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {importPrompt.reason} Use the recommended file set or choose fewer files. Need
                  everything? Use the{" "}
                  <a
                    href={CLI_INSTALL_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    CLI install.
                  </a>
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Selected: {promptSelectedFileCount} files.
                </p>
                {promptMissingRequired && (
                  <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100">
                    GTFS Viz requires stops.txt in the browser importer. Removing it also removes
                    dependent files.
                  </p>
                )}
                {promptHighMemoryFiles.length > 0 && (
                  <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100">
                    Try removing: {promptHighMemoryFiles.map((file) => file.name).join(", ")}.
                  </p>
                )}
                {promptSelectionOverLimit && (
                  <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100">
                    Selection is still too large. Remove routes, trips, stop_times, and shapes
                    before importing.
                  </p>
                )}
                {!promptMissingRequired && promptReducedFeatures && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Reduced imports may disable route, trip, shape, service, or pathway features.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPromptSelection(importPrompt.plan.recommendedSelection)}
                >
                  Recommended
                </Button>
                <Button
                  size="sm"
                  onClick={() => startImportWithSelection(importPrompt.file, promptSelection)}
                  disabled={promptMissingRequired || promptSelectionOverLimit}
                >
                  Import
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    setImportPrompt(null)
                    setImportSelection(null)
                    await resetBeforeNewUpload()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <div className="grid gap-1.5">
                {importPrompt.plan.files.map((file) => {
                  const missingDependencies = file.dependencies.filter(
                    (dependency) =>
                      !importPrompt.plan.files.some(
                        (candidate) => candidate.name === dependency && candidate.available,
                      ),
                  )
                  const disabled = !file.available || missingDependencies.length > 0
                  const detail = !file.available
                    ? "Not in feed"
                    : missingDependencies.length > 0
                      ? `Requires ${missingDependencies.join(", ")}`
                      : file.dependencies.length > 0
                        ? `Requires ${file.dependencies.join(", ")}`
                        : "Required for GTFS Viz"
                  const checked = Boolean(promptSelection[file.name])

                  const skipped = !checked && file.available
                  const featureImpact = skipped
                    ? file.name === "shapes.txt"
                      ? "Route map shapes disabled"
                      : file.name === "stop_times.txt"
                        ? "Trip stop sequences disabled"
                        : file.name === "trips.txt"
                          ? "Route service & trips disabled"
                          : file.name === "routes.txt"
                            ? "Routes section disabled"
                            : file.name === "calendar.txt"
                              ? "Service calendar filtering disabled"
                              : file.name === "calendar_dates.txt"
                                ? "Service exceptions disabled"
                                : file.name === "pathways.txt"
                                  ? "Station pathways disabled"
                                  : undefined
                    : undefined

                  return (
                    <label
                      key={file.name}
                      className={`flex items-start gap-2.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                        !file.available
                          ? "bg-muted/30 opacity-50"
                          : skipped
                            ? "bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-300/50"
                            : "bg-background/70"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          handlePromptFileChange(file.name, checked === true)
                        }
                        className="mt-1"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span
                            className={`font-medium ${skipped ? "line-through text-muted-foreground" : "text-foreground"}`}
                          >
                            {file.label}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {file.name}
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground">{detail}</span>
                        {featureImpact && (
                          <span className="block text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                            {featureImpact}
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {showUploadComponents && (
        <>
          {duckDB?.storage === "memory" && (
            <div
              role="alert"
              className="mb-3 flex flex-col items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-center"
            >
              <p className="text-xs">
                Persistent storage is unavailable, so this session runs in memory and large feeds
                may fail to import. Close any other GTFS Viz tabs, then retry.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-[30vh]"
                onClick={() => {
                  void duckDB?.resetDb?.()
                }}
              >
                Retry persistent storage
              </Button>
            </div>
          )}
          {duckDB?.initialized && (
            <div className="mb-3 flex flex-col items-center gap-2 text-center">
              <p className="text-xs text-muted-foreground">
                A dataset is already loaded. Importing another one replaces it.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-[30vh]"
                onClick={() => router.navigate({ to: "/routes/table" })}
              >
                Open dashboard
              </Button>
            </div>
          )}
          <UploadFile handleFileUpload={handleFileUpload} />
          <ExampleDatasets handleExampleFileUpload={handleExampleFileUpload} />
        </>
      )}

      {LoadingState && (
        <>
          <div className="w-full max-w-md space-y-2">
            <Progress className="w-full m-4" value={uploadProgress} max={100} />
            <div className="flex items-baseline justify-between gap-3 px-4">
              <p className="text-sm text-muted-foreground truncate" title={uploadMessage}>
                {uploadMessage}
              </p>
              <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                {Math.round(uploadProgress)}%
              </span>
            </div>
          </div>
          <Button variant="destructive" onClick={handleCancel} className="w-full max-w-xs mt-4">
            Cancel
          </Button>
        </>
      )}
    </div>
  )
}
