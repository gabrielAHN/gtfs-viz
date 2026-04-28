import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useDuckDB } from "@/context/duckdb.client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { logger } from "@/lib/logger";

import { importGTFSFromZip, validateZipContents } from "@/lib/gtfs-ingestion";
import setupGTFSData from "@/lib/gtfs-ingestion";
import { resetProceduresFlag } from "@/lib/duckdb/DataFetching/pathways/fetchStationPathways";
import { resetStationInfoProceduresFlag } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import { postCliStatus, resolveCliLaunchTarget } from "@/lib/cli";

import ExampleDatasets from "./ExampleDatasets";
import UploadFile from "./UploadFile";

export default function FileImporter() {
  const queryClient = useQueryClient();
  const duckDB = useDuckDB();
  const { db, conn, setInitialized, setHasStations, setHasStops, refreshDataAvailability } =
    duckDB || {};
  const router = useRouter();

  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [ErrorMessage, setErrorMessage] = useState<string | null>(null);
  const [LoadingState, setLoadingState] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const isCancelledRef = useRef(false);
  const cliLaunchProfile = null;

  const {
    data: uploadData,
    isError: isUploadError,
    error: uploadError,
  } = useQuery({
    queryKey: ["fetchUploadData"],
    queryFn: async () => {
      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user");
      }

      if (conn) {
        try {
          logger.log("🧹 Cleaning up any temporary tables...");
          await conn.query(`DROP TABLE IF EXISTS stops_temp`);
          await conn.query(`DROP TABLE IF EXISTS pathways_temp`);
          logger.log("  ✅ Temporary tables cleaned up");
        } catch {
          logger.log("  ℹ️  No temporary tables to clean up");
        }
      }

      setUploadMessage("Importing GTFS data from ZIP...");
      setUploadProgress(40);
      const result = await importGTFSFromZip(conn, importedFile!, db);

      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user");
      }

      setUploadProgress(70);
      return result;
    },
    enabled: !!importedFile && !!conn && !!db && !isCancelledRef.current,
    retry: false,
    onError: async (error) => {
      if (isCancelledRef.current) {
        logger.log("⚠️ Upload cancelled - ignoring import error");
        return;
      }

      await postCliStatus(
        cliLaunchProfile,
        "error",
        "GTFS import failed",
        error instanceof Error ? error.message : String(error),
      );
      logger.error("GTFS import error:", error);
      setErrorMessage(
        `GTFS import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setLoadingState(false);
      setUploadProgress(0);
      setImportedFile(null);
      setAbortController(null);

      resetProceduresFlag();
      resetStationInfoProceduresFlag();

      localStorage.removeItem("gtfs_data_initialized");
      localStorage.removeItem("gtfs_has_stations");
      localStorage.removeItem("gtfs_has_stops");

      if (setInitialized) {
        setInitialized(false);
      }
      if (setHasStations) {
        setHasStations(false);
      }
      if (setHasStops) {
        setHasStops(false);
      }

      if (duckDB?.resetDb) {
        try {
          await duckDB.resetDb();
        } catch (resetError) {
          logger.error("Error resetting database:", resetError);
        }
      }
    },
  });

  const {
    data: formattingData,
    isError: isFormattingError,
    error: formattingError,
    isSuccess: isFormattingSuccess,
  } = useQuery({
    queryKey: ["createFormatedTables"],
    queryFn: async () => {
      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user");
      }

      setUploadMessage("Creating views and tables...");
      setUploadProgress(80);
      const result = await setupGTFSData(conn);

      if (isCancelledRef.current) {
        throw new Error("Upload cancelled by user");
      }

      setUploadProgress(100);
      setUploadMessage("Processing complete! Loading dashboard...");
      return result;
    },
    enabled: !!uploadData && !isUploadError && !!conn && !isCancelledRef.current,
    retry: false,
    onError: async (error) => {
      if (isCancelledRef.current) {
        logger.log("⚠️ Upload cancelled - ignoring table creation error");
        return;
      }

      await postCliStatus(
        cliLaunchProfile,
        "error",
        "Table creation failed",
        error instanceof Error ? error.message : String(error),
      );
      logger.error("Table creation error:", error);
      setErrorMessage(
        `Table creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setLoadingState(false);
      setUploadProgress(0);
      setImportedFile(null);
      setAbortController(null);

      resetProceduresFlag();
      resetStationInfoProceduresFlag();

      localStorage.removeItem("gtfs_data_initialized");
      localStorage.removeItem("gtfs_has_stations");
      localStorage.removeItem("gtfs_has_stops");

      if (setInitialized) {
        setInitialized(false);
      }
      if (setHasStations) {
        setHasStations(false);
      }
      if (setHasStops) {
        setHasStops(false);
      }

      if (duckDB?.resetDb) {
        try {
          await duckDB.resetDb();
        } catch (resetError) {
          logger.error("Error resetting database:", resetError);
        }
      }
    },
  });

  const resetBeforeNewUpload = async () => {
    isCancelledRef.current = false;

    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }

    setErrorMessage(null);
    setUploadProgress(0);
    setUploadMessage("");
    setImportedFile(null);
    queryClient.removeQueries(["fetchUploadData"]);
    queryClient.removeQueries(["createFormatedTables"]);

    if (conn) {
      try {
        logger.log("🧹 Cleaning up existing tables...");
        const tables = [
          "stops",
          "pathways",
          "EditStopTable",
          "StopsTable",
          "StationsTable",
          "stops_temp",
          "pathways_temp",
        ];
        for (const table of tables) {
          try {
            await conn.query(`DROP TABLE IF EXISTS ${table}`);
          } catch {}
        }
        const views = ["StopsView", "pathway_network"];
        for (const view of views) {
          try {
            await conn.query(`DROP VIEW IF EXISTS ${view}`);
          } catch {}
        }
        logger.log("  ✅ Tables and views cleaned up");
      } catch {
        logger.log("  ℹ️  No tables to clean up");
      }
    }

    resetProceduresFlag();
    resetStationInfoProceduresFlag();

    if (setInitialized) setInitialized(false);
    if (setHasStations) setHasStations(false);
    if (setHasStops) setHasStops(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setErrorMessage("No file selected");
      setLoadingState(false);
      return;
    }

    if (file.type !== "application/zip" && !file.name.endsWith(".zip")) {
      setErrorMessage("Please upload a valid ZIP file");
      setLoadingState(false);
      return;
    }

    try {
      setLoadingState(true);
      setUploadProgress(0);
      setUploadMessage("Starting upload...");

      await resetBeforeNewUpload();

      setUploadMessage(`Validating ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);

      await validateZipContents(file, (percent, message) => {
        setUploadProgress(percent * 0.2);
        setUploadMessage(message);
      });

      setUploadMessage("Validation complete! Starting import...");
      setUploadProgress(20);
      setImportedFile(file);
    } catch (error) {
      logger.error("Validation error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to validate zip file. Please ensure it's a valid GTFS file.",
      );
      setLoadingState(false);
      setUploadProgress(0);
    }
  };

  const handleExampleFileUpload = async (url: string, retryCount = 3) => {
    setLoadingState(true);
    setUploadProgress(0);
    setUploadMessage("Downloading example dataset...");
    await postCliStatus(cliLaunchProfile, "importing", "Downloading GTFS dataset");

    await resetBeforeNewUpload();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        if (isCancelledRef.current) {
          return;
        }

        setUploadMessage("Downloading example dataset...");
        setUploadProgress(10);

        const controller = new AbortController();
        setAbortController(controller);
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/zip, application/octet-stream",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const fileName = url.split("/").pop()?.split("?")[0] || "example.zip";
        const file = new File([blob], fileName, { type: "application/zip" });

        if (isCancelledRef.current) {
          logger.log("Download cancelled by user");
          setLoadingState(false);
          setUploadProgress(0);
          setAbortController(null);
          return;
        }

        setUploadMessage("Download complete, validating...");
        setUploadProgress(20);

        await validateZipContents(file, (percent, message) => {
          setUploadProgress(20 + percent * 0.1);
          setUploadMessage(message);
        });

        setUploadMessage("Validation complete! Starting import...");
        setUploadProgress(30);

        setImportedFile(file);
        setAbortController(null);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          logger.log("Download cancelled by user");
          setLoadingState(false);
          setUploadProgress(0);
          setAbortController(null);
          return;
        }

        lastError = error instanceof Error ? error : new Error("Unknown error");
        logger.error(`Download attempt ${attempt} failed:`, error);

        if (attempt < retryCount) {
          setUploadMessage("Retrying download...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    setErrorMessage(
      lastError?.message?.includes("aborted")
        ? "Download timed out. The file might be too large or your connection is slow. Please try downloading the file manually and uploading it."
        : `Failed to download file: ${lastError?.message || "Unknown error"}. Please check the URL or try uploading the file manually.`,
    );
    await postCliStatus(
      cliLaunchProfile,
      "error",
      "Failed to download GTFS dataset",
      lastError?.message || "Unknown error",
    );
    setLoadingState(false);
    setUploadProgress(0);
    setAbortController(null);
  };

  const handleCancel = async () => {
    logger.log("🛑 Cancelling upload process...");

    isCancelledRef.current = true;

    setUploadMessage("Cancelling and resetting database...");

    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }

    await queryClient.cancelQueries();
    logger.log("  ✅ React Query queries cancelled");

    if (duckDB?.resetDb) {
      try {
        logger.log("  🔄 Resetting DuckDB to kill all running queries...");
        await duckDB.resetDb();
        logger.log("  ✅ DuckDB reset complete");
      } catch (error) {
        logger.error("  ❌ Error resetting database:", error);
      }
    }

    queryClient.clear();
    logger.log("  ✅ Query cache cleared");

    resetProceduresFlag();
    resetStationInfoProceduresFlag();
    logger.log("  ✅ Procedure flags reset");

    localStorage.removeItem("gtfs_data_initialized");
    localStorage.removeItem("gtfs_has_stations");
    localStorage.removeItem("gtfs_has_stops");

    if (setInitialized) {
      setInitialized(false);
    }
    if (setHasStations) {
      setHasStations(false);
    }
    if (setHasStops) {
      setHasStops(false);
    }

    setLoadingState(false);
    setImportedFile(null);
    setErrorMessage(null);
    setUploadProgress(0);
    setUploadMessage("");

    logger.log("✅ Upload cancelled and database reset - ready for new upload");
  };

  useEffect(() => {
    if (isCancelledRef.current) {
      return;
    }

    if (!LoadingState) {
      return;
    }

    if (!uploadData || !isFormattingSuccess || !formattingData) {
      return;
    }

    logger.log("✅ Upload and formatting completed successfully");

    const checkDataAvailability = async () => {
      if (isCancelledRef.current || !conn) {
        return;
      }

      try {
        const stationsResult = await conn.query(
          `SELECT COUNT(*) as count FROM StationsTable LIMIT 1`,
        );

        if (isCancelledRef.current) {
          logger.log("⚠️ Cancelled during data check - aborting");
          return;
        }

        const stationsCount = stationsResult.toArray()[0]?.count || 0;
        const hasStationsData = stationsCount > 0;

        const stopsResult = await conn.query(`SELECT COUNT(*) as count FROM StopsTable LIMIT 1`);

        if (isCancelledRef.current) {
          logger.log("⚠️ Cancelled during data check - aborting");
          return;
        }

        const stopsCount = stopsResult.toArray()[0]?.count || 0;
        const hasStopsData = stopsCount > 0;

        logger.log("Data availability:", { hasStationsData, hasStopsData });

        if (isCancelledRef.current) {
          logger.log("⚠️ Cancelled before state update - aborting");
          return;
        }

        if (setHasStations) setHasStations(hasStationsData);
        if (setHasStops) setHasStops(hasStopsData);

        if (setInitialized) {
          setInitialized(true);
        }

        if (refreshDataAvailability) {
          await refreshDataAvailability();
        }

        const target = await resolveCliLaunchTarget({
          conn,
          profile: cliLaunchProfile,
          hasStations: hasStationsData,
        });

        await postCliStatus(cliLaunchProfile, "ready", "Import complete");

        if (hasStationsData || hasStopsData) {
          setUploadMessage("Success! Redirecting to dashboard...");
          setTimeout(() => {
            if (isCancelledRef.current) {
              logger.log("⚠️ Navigation prevented - upload was cancelled");
              return;
            }
            router.navigate({ to: target.to as any, search: target.search as any });
          }, 1000);
        } else {
          setUploadMessage("Upload complete, but no stations or stops found");
          await postCliStatus(
            cliLaunchProfile,
            "error",
            "Import complete, but no stations or stops found",
          );
          setLoadingState(false);
        }
      } catch (error) {
        logger.error("Error checking data availability:", error);

        if (isCancelledRef.current) {
          logger.log("⚠️ Error occurred but upload was cancelled - not navigating");
          return;
        }

        setUploadMessage("Success! Redirecting to stations...");
        await postCliStatus(cliLaunchProfile, "ready", "Import complete");
        setTimeout(() => {
          if (isCancelledRef.current) {
            logger.log("⚠️ Navigation prevented - upload was cancelled");
            return;
          }
          router.navigate({ to: "/stations/map" });
        }, 1000);
      }
    };

    checkDataAvailability();
  }, [
    uploadData,
    isFormattingSuccess,
    formattingData,
    LoadingState,
    router,
    setInitialized,
    setHasStations,
    setHasStops,
    refreshDataAvailability,
    conn,
  ]);

  useEffect(() => {
    if (isUploadError || isFormattingError) {
      if (isCancelledRef.current) {
        return;
      }

      const error = isUploadError ? uploadError : formattingError;
      void postCliStatus(
        cliLaunchProfile,
        "error",
        isUploadError ? "GTFS import failed" : "Table creation failed",
        error instanceof Error ? error.message : String(error),
      );

      setLoadingState(false);
      setUploadProgress(0);
      setImportedFile(null);

      if (setInitialized) {
        setInitialized(false);
      }
      if (setHasStations) {
        setHasStations(false);
      }
      if (setHasStops) {
        setHasStops(false);
      }
    }
  }, [
    isUploadError,
    isFormattingError,
    uploadError,
    formattingError,
    cliLaunchProfile,
    setInitialized,
    setHasStations,
    setHasStops,
  ]);

  const showUploadComponents = !LoadingState;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {isUploadError && (
        <div className="w-full bg-red-50 dark:bg-red-900/20 border-2 border-red-400 shadow-md rounded-lg mb-4 overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="upload-error" className="border-none">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-semibold text-red-800 dark:text-red-200">
                  ❌ Database Ingestion Error
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <p className="text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap">
                    {(uploadError as Error)?.message}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    The database has been reset. Please try uploading the file again.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await resetBeforeNewUpload();
                    }}
                    className="mt-2"
                  >
                    Upload Another File
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
      {isFormattingError && (
        <div className="w-full bg-red-50 dark:bg-red-900/20 border-2 border-red-400 shadow-md rounded-lg mb-4 overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="formatting-error" className="border-none">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-semibold text-red-800 dark:text-red-200">
                  ❌ Table Formatting Error
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <p className="text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap">
                    {(formattingError as Error)?.message}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    The database has been reset. Please try uploading the file again.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await resetBeforeNewUpload();
                    }}
                    className="mt-2"
                  >
                    Upload Another File
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
      {ErrorMessage && !isUploadError && !isFormattingError && (
        <div className="w-full bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 shadow-md rounded-lg mb-4 overflow-hidden">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="validation-error" className="border-none">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                  ⚠️ File Validation Error
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm whitespace-pre-wrap">
                    {ErrorMessage}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setErrorMessage(null);
                      await resetBeforeNewUpload();
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
      {}
      {showUploadComponents && (
        <>
          <UploadFile handleFileUpload={handleFileUpload} />
          <ExampleDatasets handleExampleFileUpload={handleExampleFileUpload} />
        </>
      )}

      {}
      {LoadingState && (
        <>
          <div className="w-full max-w-md space-y-2">
            <Progress className="w-full m-4" value={uploadProgress} max={100} />
            {uploadMessage && (
              <p className="text-sm text-center text-muted-foreground">{uploadMessage}</p>
            )}
          </div>
          <Button variant="destructive" onClick={handleCancel} className="w-full max-w-xs mt-4">
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
