export interface DuckDBContextType {
  db: any;
  conn: any;
  loading: boolean;
  initialized: boolean;
  setInitialized: (value: boolean) => void;
  hasStations: boolean;
  setHasStations: (value: boolean) => void;
  hasStops: boolean;
  setHasStops: (value: boolean) => void;
  refreshDataAvailability: () => Promise<void>;
  resetDb: () => Promise<void>;
  isResetting: boolean;
  setIsResetting: (value: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (value: string) => void;
  loadingSubMessage: string;
  setLoadingSubMessage: (value: string) => void;
}
