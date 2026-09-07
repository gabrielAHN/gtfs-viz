import { useState, useCallback, useRef, useEffect } from "react"
import { useDuckDB } from "@/context/duckdb.client"
import {
  createGTFSExtension,
  type IngestionProgress,
  type IngestionResult,
} from "@/lib/gtfs-extension"
import { clearGTFSAvailabilityStorage, writeGTFSAvailabilityToStorage } from "@/lib/gtfs-ingestion"
import { logger } from "@/lib/logger"

export interface UseGTFSExtensionResult {
  ingest: (source: File | string) => Promise<IngestionResult | null>
  progress: IngestionProgress | null
  error: string | null
  isLoading: boolean
  cancel: () => void
  reset: () => void
}

export function useGTFSExtension(): UseGTFSExtensionResult {
  const duckDB = useDuckDB()
  const { db, conn, setInitialized, setHasStations, setHasStops, setHasRoutes } = duckDB || {}

  const [progress, setProgress] = useState<IngestionProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const cancel = useCallback(() => {
    logger.log("🛑 Cancelling ingestion...")

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setIsLoading(false)
    setProgress(null)
    setError(null)
  }, [])

  const reset = useCallback(() => {
    setProgress(null)
    setError(null)
    setIsLoading(false)

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const ingest = useCallback(
    async (source: File | string): Promise<IngestionResult | null> => {
      if (!db || !conn) {
        const err = "DuckDB not initialized"
        setError(err)
        logger.error(err)
        return null
      }

      setIsLoading(true)
      setError(null)
      setProgress({ percent: 0, message: "Starting...", step: "download" })

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        if (typeof source === "string") {
          try {
            new URL(source)
          } catch {
            throw new Error("Invalid URL format")
          }
        } else {
          if (!source.name.endsWith(".zip")) {
            throw new Error("File must be a ZIP archive")
          }
        }

        const gtfsExtension = createGTFSExtension(db, conn)

        const result = await gtfsExtension.ingest(source, {
          skipReformat: false,
          signal: controller.signal,
          onProgress: (p) => {
            if (controller.signal.aborted) {
              throw new Error("Ingestion cancelled by user")
            }
            setProgress(p)
          },
        })

        if (setHasStations) {
          setHasStations(result.hasStations)
        }
        if (setHasStops) {
          setHasStops(result.hasStops)
        }
        if (setHasRoutes) {
          setHasRoutes(result.hasRoutes)
        }
        if (setInitialized) {
          setInitialized(true)
        }

        writeGTFSAvailabilityToStorage({
          stations: 0,
          stops: 0,
          pathways: 0,
          routes: 0,
          hasStations: result.hasStations,
          hasStops: result.hasStops,
          hasRoutes: result.hasRoutes,
        })

        logger.log("✅ Ingestion complete:", result)

        setIsLoading(false)
        abortControllerRef.current = null

        return result
      } catch (err) {
        if (controller.signal.aborted) {
          logger.log("⚠️ Ingestion cancelled by user")
          setError("Ingestion cancelled")
          return null
        }

        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        logger.error("❌ Ingestion failed:", err)
        setError(errorMessage)
        setIsLoading(false)
        setProgress(null)
        abortControllerRef.current = null

        if (duckDB?.resetDb) {
          try {
            await duckDB.resetDb()
            logger.log("Database reset after error")
          } catch (resetError) {
            logger.error("Failed to reset database:", resetError)
          }
        }

        clearGTFSAvailabilityStorage()

        if (setInitialized) setInitialized(false)
        if (setHasStations) setHasStations(false)
        if (setHasStops) setHasStops(false)
        if (setHasRoutes) setHasRoutes(false)

        return null
      }
    },
    [db, conn, duckDB, setInitialized, setHasStations, setHasStops, setHasRoutes],
  )

  return {
    ingest,
    progress,
    error,
    isLoading,
    cancel,
    reset,
  }
}
