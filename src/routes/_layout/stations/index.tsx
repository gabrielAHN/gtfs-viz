import { createFileRoute, redirect } from "@tanstack/react-router";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/_layout/stations/")({
  beforeLoad: async ({ context }: any) => {
    
    const initialized = localStorage.getItem('gtfs_data_initialized') === 'true';
    const hasStations = localStorage.getItem('gtfs_has_stations') === 'true';

    if (!initialized || !hasStations) {
      throw redirect({ to: "/" });
    }

    const conn = context?.duckdb?.conn;

    if (!conn) {
      logger.warn('DuckDB connection not available');
      return;
    }

    try {
      
      await conn.query(`SELECT 1 FROM StationsTable LIMIT 1`);
    } catch (error) {
      
      logger.warn('StationsTable does not exist or has no data, redirecting to home');
      localStorage.removeItem('gtfs_data_initialized');
      localStorage.removeItem('gtfs_has_stations');
      throw redirect({ to: "/" });
    }

    throw redirect({ to: "/stations/map" });
  },
});
