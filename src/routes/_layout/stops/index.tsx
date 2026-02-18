import { createFileRoute, redirect } from "@tanstack/react-router";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/_layout/stops/")({
  beforeLoad: async ({ context }: any) => {
    const initialized = localStorage.getItem('gtfs_data_initialized') === 'true';
    const hasStops = localStorage.getItem('gtfs_has_stops') === 'true';

    if (!initialized || !hasStops) {
      throw redirect({ to: "/" });
    }

    const conn = context?.duckdb?.conn;

    if (!conn) {
      logger.warn('DuckDB connection not available');
      return;
    }

    try {
      await conn.query(`SELECT 1 FROM StopsTable LIMIT 1`);
    } catch (error) {
      logger.warn('StopsTable does not exist or has no data, redirecting to home');
      localStorage.removeItem('gtfs_data_initialized');
      localStorage.removeItem('gtfs_has_stops');
      throw redirect({ to: "/" });
    }

    throw redirect({ to: "/stops/map" });
  },
});
