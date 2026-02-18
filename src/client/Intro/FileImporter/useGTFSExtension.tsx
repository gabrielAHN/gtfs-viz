

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDuckDB } from '@/context/duckdb.client';
import { createGTFSExtension, type IngestionProgress, type IngestionResult } from '@/lib/gtfs-extension';
import { logger } from '@/lib/logger';

export interface UseGTFSExtensionResult {
  ingest: (source: File | string) => Promise<IngestionResult | null>;
  progress: IngestionProgress | null;
  error: string | null;
  isLoading: boolean;
  cancel: () => void;
  reset: () => void;
}

export function useGTFSExtension(): UseGTFSExtensionResult {
  const duckDB = useDuckDB();
  const { db, conn, setInitialized, setHasStations, setHasStops } = duckDB || {};

  const [progress, setProgress] = useState<IngestionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const cancel = useCallback(() => {
    logger.log('🛑 Cancelling ingestion...');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsLoading(false);
    setProgress(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setError(null);
    setIsLoading(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const ingest = useCallback(
    async (source: File | string): Promise<IngestionResult | null> => {
      if (!db || !conn) {
        const err = 'DuckDB not initialized';
        setError(err);
        logger.error(err);
        return null;
      }

      setIsLoading(true);
      setError(null);
      setProgress({ percent: 0, message: 'Starting...', step: 'download' });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {

        if (typeof source === 'string') {

          try {
            new URL(source);
          } catch {
            throw new Error('Invalid URL format');
          }
        } else {

          if (!source.name.endsWith('.zip')) {
            throw new Error('File must be a ZIP archive');
          }
        }

        const gtfsExtension = createGTFSExtension(db, conn);

        const result = await gtfsExtension.ingest(source, {
          skipReformat: false,
          signal: controller.signal,
          onProgress: (p) => {
            if (controller.signal.aborted) {
              throw new Error('Ingestion cancelled by user');
            }
            setProgress(p);
          },
        });

        if (setHasStations) {
          setHasStations(result.hasStations);
        }
        if (setHasStops) {
          setHasStops(result.hasStops);
        }
        if (setInitialized) {
          setInitialized(true);
        }

        localStorage.setItem('gtfs_data_initialized', 'true');
        localStorage.setItem('gtfs_has_stations', String(result.hasStations));
        localStorage.setItem('gtfs_has_stops', String(result.hasStops));

        logger.log('✅ Ingestion complete:', result);

        setIsLoading(false);
        abortControllerRef.current = null;

        return result;

      } catch (err) {
        if (controller.signal.aborted) {
          logger.log('⚠️ Ingestion cancelled by user');
          setError('Ingestion cancelled');
          return null;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('❌ Ingestion failed:', err);
        setError(errorMessage);
        setIsLoading(false);
        setProgress(null);
        abortControllerRef.current = null;

        if (duckDB?.resetDb) {
          try {
            await duckDB.resetDb();
            logger.log('Database reset after error');
          } catch (resetError) {
            logger.error('Failed to reset database:', resetError);
          }
        }

        localStorage.removeItem('gtfs_data_initialized');
        localStorage.removeItem('gtfs_has_stations');
        localStorage.removeItem('gtfs_has_stops');

        if (setInitialized) setInitialized(false);
        if (setHasStations) setHasStations(false);
        if (setHasStops) setHasStops(false);

        return null;
      }
    },
    [db, conn, duckDB, setInitialized, setHasStations, setHasStops]
  );

  return {
    ingest,
    progress,
    error,
    isLoading,
    cancel,
    reset,
  };
}
