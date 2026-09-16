export interface DuckDBContextType {
  db: any
  conn: any
  loading: boolean
  isCliLaunch: boolean
  initialized: boolean
  setInitialized: (value: boolean) => void
  hasStations: boolean
  setHasStations: (value: boolean) => void
  hasStops: boolean
  setHasStops: (value: boolean) => void
  hasRoutes: boolean
  setHasRoutes: (value: boolean) => void
  hasTrips: boolean
  hasStopTimes: boolean
  hasShapes: boolean
  hasCalendar: boolean
  refreshDataAvailability: () => Promise<void>
  resetDb: () => Promise<void>
  storage: "opfs" | "memory" | "unknown"
  isResetting: boolean
  setIsResetting: (value: boolean) => void
  loadingMessage: string
  setLoadingMessage: (value: string) => void
  loadingSubMessage: string
  setLoadingSubMessage: (value: string) => void
}
