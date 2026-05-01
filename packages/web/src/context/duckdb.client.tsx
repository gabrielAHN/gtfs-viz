import React, { createContext, useState, useContext, ReactNode, FC, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import DuckDB from "./duckdbConfig";
import { DuckDBContextType } from "@/types/objectTypes";
import { logger } from "@/lib/logger";
import { resetProceduresFlag } from "@/lib/duckdb/DataFetching/pathways/fetchStationPathways";
import { resetStationInfoProceduresFlag } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import {
  createCliNativeConnection,
  fetchCliNativeDataset,
  getCliNativeLaunchProfile,
} from "@/lib/cli/nativeDuckDb";

const DuckDBContext = createContext<DuckDBContextType | null>(null);

const SESSION_KEY = "duckdb_session_active";

export const DuckDBProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cliProfile] = useState(() => getCliNativeLaunchProfile());
  const [dbInstance, setDbInstance] = useState<any>(null);
  const [connInstance, setConnInstance] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialized, setInitialized] = useState<boolean>(() => {
    return (
      Boolean(getCliNativeLaunchProfile()) ||
      localStorage.getItem("gtfs_data_initialized") === "true"
    );
  });

  const [hasStations, setHasStations] = useState<boolean>(() => {
    return (
      Boolean(getCliNativeLaunchProfile()) || localStorage.getItem("gtfs_has_stations") === "true"
    );
  });

  const [hasStops, setHasStops] = useState<boolean>(() => {
    return (
      Boolean(getCliNativeLaunchProfile()) || localStorage.getItem("gtfs_has_stops") === "true"
    );
  });

  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [loadingSubMessage, setLoadingSubMessage] = useState<string>("");

  const initializeDuckDB = async () => {
    setLoading(true);
    if (cliProfile) {
      const dataset = await fetchCliNativeDataset(cliProfile);
      setConnInstance(createCliNativeConnection(cliProfile));
      setDbInstance({ __gtfsVizCliNative: true });
      setInitialized(dataset.status === "ready");
      setHasStations(Number(dataset.counts?.stations || 0) > 0);
      setHasStops(Number(dataset.counts?.stops || 0) > 0);
      setLoading(false);
      return;
    }
    const { conn, db } = await DuckDB();
    setConnInstance(conn);
    setDbInstance(db);
    setLoading(false);
  };

  useEffect(() => {
    if (cliProfile) {
      sessionStorage.setItem(SESSION_KEY, "true");
      return;
    }

    const currentPath = window.location.pathname;
    const isHomePage = currentPath === "/";
    const isHardRefresh = !sessionStorage.getItem(SESSION_KEY);

    if (isHomePage || isHardRefresh) {
      const performReset = async () => {
        logger.log("🔄 Clearing database - fresh start");

        localStorage.removeItem("gtfs_data_initialized");
        localStorage.removeItem("gtfs_has_stations");
        localStorage.removeItem("gtfs_has_stops");

        resetProceduresFlag();
        resetStationInfoProceduresFlag();

        queryClient.clear();
        logger.log("  ✅ Cleared React Query cache");

        if (typeof indexedDB !== "undefined") {
          try {
            indexedDB.deleteDatabase("duckdb");
            logger.log("  ✅ Cleared DuckDB IndexedDB");
          } catch {
            logger.log("  ℹ️  No IndexedDB to clear");
          }
        }

        setInitialized(false);
        setHasStations(false);
        setHasStops(false);

        if (connInstance) {
          try {
            await connInstance.close();
            logger.log("  ✅ Closed database connection");
          } catch {
            logger.log("  ⚠️  Connection already closed");
          }
        }

        if (dbInstance) {
          try {
            await dbInstance.terminate();
            logger.log("  ✅ Terminated database instance");
          } catch {
            logger.log("  ⚠️  Database already terminated");
          }
        }

        setDbInstance(null);
        setConnInstance(null);

        logger.log("  🔄 Reinitializing empty database...");
        await initializeDuckDB();

        if (isHardRefresh && !isHomePage) {
          navigate({ to: "/" }).catch(() => {});
        }

        logger.log("✅ Database reset complete - ready for import");
      };

      performReset();
    }

    sessionStorage.setItem(SESSION_KEY, "true");
  }, [navigate, queryClient, cliProfile]);

  useEffect(() => {
    initializeDuckDB();
  }, []);

  useEffect(() => {
    if (cliProfile) return;
    if (!connInstance) return;

    const checkAndResetIfNeeded = async () => {
      const localStorageInitialized = localStorage.getItem("gtfs_data_initialized") === "true";
      if (!localStorageInitialized) return;

      try {
        await connInstance.query(`SELECT COUNT(*) FROM StationsTable LIMIT 1`);
      } catch (error) {
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes("does not exist")) {
          logger.log("🔄 Data missing after refresh - resetting state...");

          setInitialized(false);
          setHasStations(false);
          setHasStops(false);

          resetProceduresFlag();
          resetStationInfoProceduresFlag();

          queryClient.clear();
          logger.log("  ✅ Cleared React Query cache");

          localStorage.removeItem("gtfs_data_initialized");
          localStorage.removeItem("gtfs_has_stations");
          localStorage.removeItem("gtfs_has_stops");

          navigate({ to: "/" }).catch(() => {});

          logger.log("✅ State reset - please import data");
        }
      }
    };

    checkAndResetIfNeeded();
  }, [connInstance, navigate, cliProfile]);

  useEffect(() => {
    if (!connInstance || !initialized) return;

    let isCancelled = false;

    const checkDataAvailability = async () => {
      if (isCancelled || !connInstance || !initialized) return;

      try {
        const stationsResult = await connInstance.query(
          `SELECT COUNT(*) as count FROM StationsTable LIMIT 1`,
        );
        if (isCancelled) return;

        const stationsCount = stationsResult.toArray()[0]?.count || 0;
        const hasStationsData = stationsCount > 0;

        const stopsResult = await connInstance.query(
          `SELECT COUNT(*) as count FROM StopsTable LIMIT 1`,
        );
        if (isCancelled) return;

        const stopsCount = stopsResult.toArray()[0]?.count || 0;
        const hasStopsData = stopsCount > 0;

        setHasStations((prev) => {
          if (prev !== hasStationsData) {
            logger.log("Stations availability changed:", hasStationsData);
            return hasStationsData;
          }
          return prev;
        });

        setHasStops((prev) => {
          if (prev !== hasStopsData) {
            logger.log("Stops availability changed:", hasStopsData);
            return hasStopsData;
          }
          return prev;
        });
      } catch (error) {
        if (isCancelled || !initialized) return;

        const errorMsg = error?.message || String(error);

        if (errorMsg.includes("does not exist")) {
          logger.log("⚠️ Tables missing but data flagged as initialized - resetting...");

          setInitialized(false);
          setHasStations(false);
          setHasStops(false);

          resetProceduresFlag();
          resetStationInfoProceduresFlag();

          queryClient.clear();
          logger.log("  ✅ Cleared React Query cache");

          localStorage.removeItem("gtfs_data_initialized");
          localStorage.removeItem("gtfs_has_stations");
          localStorage.removeItem("gtfs_has_stops");

          if (!cliProfile) {
            navigate({ to: "/" }).catch(() => {});
          }

          logger.log("✅ Reset complete - navigate to home to import data");
        } else {
          logger.error("Error checking data availability:", error);
        }
      }
    };

    checkDataAvailability();
    const intervalId = setInterval(checkDataAvailability, 2000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [connInstance, initialized, cliProfile]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem("gtfs_data_initialized", "true");

      queryClient.invalidateQueries();
      logger.log("  ✅ Invalidated all queries after initialization");
    } else {
      localStorage.removeItem("gtfs_data_initialized");
    }
  }, [initialized, queryClient]);

  useEffect(() => {
    if (hasStations) {
      localStorage.setItem("gtfs_has_stations", "true");
    } else {
      localStorage.removeItem("gtfs_has_stations");
    }
  }, [hasStations]);

  useEffect(() => {
    if (hasStops) {
      localStorage.setItem("gtfs_has_stops", "true");
    } else {
      localStorage.removeItem("gtfs_has_stops");
    }
  }, [hasStops]);

  const refreshDataAvailability = async () => {
    if (!connInstance) return;

    try {
      const stationsResult = await connInstance.query(
        `SELECT COUNT(*) as count FROM StationsTable LIMIT 1`,
      );
      const stationsCount = stationsResult.toArray()[0]?.count || 0;
      const hasStationsData = stationsCount > 0;

      const stopsResult = await connInstance.query(
        `SELECT COUNT(*) as count FROM StopsTable LIMIT 1`,
      );
      const stopsCount = stopsResult.toArray()[0]?.count || 0;
      const hasStopsData = stopsCount > 0;

      logger.log("Refreshed data availability:", { hasStationsData, hasStopsData });

      setHasStations(hasStationsData);
      setHasStops(hasStopsData);
    } catch (error) {
      const errorMsg = error?.message || String(error);
      if (!errorMsg.includes("does not exist")) {
        logger.error("Error refreshing data availability:", error);
      }
    }
  };

  const resetDb = async () => {
    if (cliProfile) {
      queryClient.clear();
      await initializeDuckDB();
      return;
    }

    logger.log("🔄 Resetting DuckDB instance...");

    setInitialized(false);
    setHasStations(false);
    setHasStops(false);

    resetProceduresFlag();
    resetStationInfoProceduresFlag();

    queryClient.clear();
    logger.log("  ✅ Cleared React Query cache");

    await new Promise((resolve) => setTimeout(resolve, 50));

    if (connInstance) {
      try {
        await connInstance.close();
        logger.log("  ✅ Closed database connection");
      } catch {
        logger.log("  ⚠️  Connection already closed");
      }
    }

    if (dbInstance) {
      try {
        await dbInstance.terminate();
        logger.log("  ✅ Terminated database instance");
      } catch {
        logger.log("  ⚠️ Database already terminated");
      }
    }

    setDbInstance(null);
    setConnInstance(null);
    localStorage.removeItem("gtfs_data_initialized");
    localStorage.removeItem("gtfs_has_stations");
    localStorage.removeItem("gtfs_has_stops");

    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.log("  🔄 Creating fresh DuckDB instance...");
    await initializeDuckDB();
    logger.log("✅ Database reset complete - ready for new data");
  };

  return (
    <DuckDBContext.Provider
      value={{
        db: dbInstance,
        conn: connInstance,
        loading,
        isCliLaunch: Boolean(cliProfile),
        initialized,
        setInitialized,
        hasStations,
        setHasStations,
        hasStops,
        setHasStops,
        refreshDataAvailability,
        resetDb,
        isResetting,
        setIsResetting,
        loadingMessage,
        setLoadingMessage,
        loadingSubMessage,
        setLoadingSubMessage,
      }}
    >
      {children}
    </DuckDBContext.Provider>
  );
};

export const useDuckDB = (): DuckDBContextType | null => {
  return useContext(DuckDBContext);
};
