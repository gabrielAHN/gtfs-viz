

import { useState, useCallback } from 'react';
import { useDuckDB } from '@/context/duckdb.client';
import { ingestGTFS, type IngestionProgress } from '@/lib/gtfs-ingestion/client';
import { logger } from '@/lib/logger';

export interface UseGTFSIngestionResult {
  ingest: (source: File | string) => Promise<void>;
  progress: IngestionProgress | null;
  error: string | null;
  isLoading: boolean;
  cancel: () => void;
}

export function useGTFSIngestion(): UseGTFSIngestionResult {
  const duckDB = useDuckDB();
  const { db, conn } = duckDB || {};

  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    setIsLoading(false);
    setProgress(null);
    setError(null);
  }, [abortController]);

  const ingest = useCallback(
    async (source: File | string) => {
      if (!db || !conn) {
        setError('DuckDB not initialized');
        return;
      }

      setIsLoading(true);
      setError(null);
      setProgress({ percent: 0, message: 'Starting...', step: 'validate' });

      const controller = new AbortController();
      setAbortController(controller);

      try {
        const result = await ingestGTFS(db, conn, source, {
          skipReformat: false,
          onProgress: (p) => {
            if (controller.signal.aborted) {
              throw new Error('Ingestion cancelled by user');
            }
            setProgress(p);
          },
        });

        if (duckDB?.setHasStations) {
          duckDB.setHasStations(result.hasStations);
        }
        if (duckDB?.setHasStops) {
          duckDB.setHasStops(result.hasStops);
        }
        if (duckDB?.setInitialized) {
          duckDB.setInitialized(true);
        }

        localStorage.setItem('gtfs_data_initialized', 'true');
        localStorage.setItem('gtfs_has_stations', String(result.hasStations));
        localStorage.setItem('gtfs_has_stops', String(result.hasStops));

        setProgress({ percent: 100, message: 'Complete!', step: 'complete' });
        setIsLoading(false);

      } catch (err) {
        if (controller.signal.aborted) {
          logger.log('Ingestion cancelled by user');
          setError('Ingestion cancelled');
        } else {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          logger.error('Ingestion failed:', err);
          setError(errorMessage);
        }
        setIsLoading(false);
        setProgress(null);

        if (duckDB?.resetDb) {
          try {
            await duckDB.resetDb();
          } catch (resetError) {
            logger.error('Failed to reset database:', resetError);
          }
        }
      } finally {
        setAbortController(null);
      }
    },
    [db, conn, duckDB]
  );

  return {
    ingest,
    progress,
    error,
    isLoading,
    cancel,
  };
}
