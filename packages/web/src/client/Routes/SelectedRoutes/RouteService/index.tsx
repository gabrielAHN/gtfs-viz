import { useEffect, useMemo, useRef, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { logger } from "@/lib/logger"
import TableComponent from "@/components/table"
import Combobox from "@/components/ui/combobox"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { BiInfoCircle, BiPencil, BiPlus, BiTrash, BiX } from "react-icons/bi"
import { useDuckDB } from "@/context/duckdb.client"
import {
  fetchServiceRouteTripsForServiceData,
  saveCalendarEdit,
  saveTripEdit,
  fetchEditedCalendarStatuses,
  fetchEditedTripStatusesForRoute,
  fetchRouteStopsForShape,
  deleteServiceCascade,
  deleteTripCascade,
} from "@/lib/duckdb/DataFetching/fetchRouteData"
import { EditIndicator } from "@/components/ui/EditIndicator"
import FormPopup from "@/components/ui/formpopup"
import { CalendarForm } from "./CalendarForm"
import { TripForm } from "./TripForm"
import { secondsValue, formatTripTime, formatTimeRange } from "@/lib/tripUtils"
import { serviceDays, gtfsDateToDay, dayToDisplay, serviceInDateRange } from "@/lib/gtfsDateUtils"

type RouteServiceRow = {
  route_id: string
  service_id: string
  trip_count?: number
  shape_count?: number
  block_count?: number
  headsign_count?: number
  monday?: number
  tuesday?: number
  wednesday?: number
  thursday?: number
  friday?: number
  saturday?: number
  sunday?: number
  start_date?: string
  end_date?: string
  added_dates?: number
  removed_dates?: number
  first_exception_date?: string
  last_exception_date?: string
  added_exception_dates?: string
  removed_exception_dates?: string
  service_days?: string
}

type RouteTrip = {
  route_id: string
  service_id?: string
  trip_id: string
  trip_headsign?: string
  trip_short_name?: string
  direction_id?: number
  block_id?: string
  shape_id?: string
  wheelchair_accessible?: number
  bikes_allowed?: number
  first_departure_time?: string
  last_arrival_time?: string
  first_departure_seconds?: number
  last_arrival_seconds?: number
}

function RouteService({
  routeId,
  services: servicesProp,
  selectedServiceId,
  routeTypeName: _routeTypeName,
  hasStopTimes = true,
  onSelectionChange,
}: {
  routeId: string
  services: RouteServiceRow[]
  selectedServiceId?: string
  routeTypeName?: string
  hasStopTimes?: boolean
  onSelectionChange?: (serviceId?: string) => void
}) {
  const { conn, initialized } = useDuckDB()
  const queryClient = useQueryClient()

  const services = servicesProp
  const [selectedTripId, setSelectedTripIdLocal] = useState<string | undefined>()
  const [serviceFilterId, setServiceFilterId] = useState(selectedServiceId || "")
  // Local selection state — only set by table click, not by URL param
  const [activeServiceId, setActiveServiceId] = useState<string | undefined>()

  // Sync serviceFilterId with selectedServiceId prop (e.g. navigating from trips page)
  useEffect(() => {
    setServiceFilterId(selectedServiceId || "")
  }, [selectedServiceId])
  const [tripFilterId, setTripFilterId] = useState("")
  const [headsignFilter, setHeadsignFilter] = useState("")
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 86400])
  // Calendar/Trip forms
  const [showCalendarForm, setShowCalendarForm] = useState<false | "new" | "edit">(false)
  const [showTripForm, setShowTripForm] = useState<false | "new" | "edit">(false)

  // Edited calendar/trip IDs for indicators (Map<id, status>)
  const { data: editedCalendarMap = new Map<string, string>() } = useQuery({
    queryKey: ["editedCalendarMap"],
    queryFn: () => fetchEditedCalendarStatuses(conn),
    enabled: !!conn && !!initialized,
    staleTime: 1000,
  })

  const { data: editedTripMap = new Map<string, string>() } = useQuery({
    queryKey: ["editedTripMapForRoute", routeId],
    queryFn: () => fetchEditedTripStatusesForRoute(conn),
    enabled: !!conn && !!initialized,
    staleTime: 5000,
  })

  const serviceRows = useMemo(
    () => services.map((s) => ({ ...s, service_days: serviceDays(s) })),
    [services],
  )
  const selectedService = useMemo(() => {
    if (!activeServiceId) return undefined
    return serviceRows.find((s) => String(s.service_id) === String(activeServiceId))
  }, [activeServiceId, serviceRows])

  const dateBounds = useMemo<[number, number] | undefined>(() => {
    let min = Infinity
    let max = -Infinity
    for (const s of services) {
      const start = gtfsDateToDay(s.start_date)
      const end = gtfsDateToDay(s.end_date)
      if (start !== undefined) {
        if (start < min) min = start
        if (start > max) max = start
      }
      if (end !== undefined) {
        if (end < min) min = end
        if (end > max) max = end
      }
    }
    return min === Infinity ? undefined : [min, max]
  }, [services])
  const [dateRange, setDateRange] = useState<[number, number] | undefined>(() => dateBounds)

  useEffect(() => {
    setTripFilterId("")
    setHeadsignFilter("")
  }, [activeServiceId])

  const servicesByDate = useMemo(() => {
    if (!dateRange || !dateBounds) return serviceRows
    if (dateRange[0] === dateBounds[0] && dateRange[1] === dateBounds[1]) return serviceRows
    return serviceRows.filter((s) => serviceInDateRange(s, dateRange))
  }, [dateRange, dateBounds, serviceRows])

  const filteredServices = useMemo(() => {
    if (!serviceFilterId) return servicesByDate
    return servicesByDate.filter((s) => String(s.service_id || "") === String(serviceFilterId))
  }, [serviceFilterId, servicesByDate])

  const serviceOptions = useMemo(
    () => servicesByDate.map((s) => ({ value: String(s.service_id), label: String(s.service_id) })),
    [servicesByDate],
  )

  const handleServiceSelect = (service?: RouteServiceRow) => {
    setActiveServiceId(service?.service_id)
    setServiceFilterId(service?.service_id || "")
    onSelectionChange?.(service?.service_id)
    setSelectedTripIdLocal(undefined)
  }
  const handleServiceDropdownChange = (value?: string) => {
    handleServiceSelect(
      value ? servicesByDate.find((s) => String(s.service_id) === String(value)) : undefined,
    )
  }

  const {
    data: serviceTrips = [],
    error: serviceTripsError,
    isLoading: serviceTripsLoading,
  } = useQuery({
    queryKey: ["fetchServiceRouteTripsForServiceData", routeId, activeServiceId],
    queryFn: async () => fetchServiceRouteTripsForServiceData(conn, routeId, activeServiceId!),
    enabled: !!conn && !!routeId && !!activeServiceId && initialized,
    retry: false,
  })

  const tripById = useMemo(() => {
    const m = new Map<string, RouteTrip>()
    for (const t of serviceTrips) m.set(String(t.trip_id), t)
    return m
  }, [serviceTrips])

  const headsignOptions = useMemo(() => {
    const set = new Set<string>()
    serviceTrips.forEach((t: RouteTrip) => {
      if (t.trip_headsign) set.add(t.trip_headsign)
    })
    return Array.from(set)
      .sort()
      .map((h) => ({ value: h, label: h }))
  }, [serviceTrips])

  const tripTimeBounds = useMemo<[number, number]>(() => {
    let min = Infinity
    let max = -Infinity
    for (const t of serviceTrips) {
      const dep = secondsValue(t.first_departure_seconds)
      const arr = secondsValue(t.last_arrival_seconds)
      if (dep !== undefined) {
        if (dep < min) min = dep
        if (dep > max) max = dep
      }
      if (arr !== undefined) {
        if (arr < min) min = arr
        if (arr > max) max = arr
      }
    }
    if (min === Infinity) return [0, 86400] as [number, number]
    return [Math.max(0, Math.floor(min / 300) * 300), Math.ceil(max / 300) * 300] as [
      number,
      number,
    ]
  }, [serviceTrips])

  const sliderBounds = useMemo<[number, number]>(() => {
    if (tripTimeBounds[0] !== tripTimeBounds[1]) return tripTimeBounds
    return [Math.max(0, tripTimeBounds[0] - 300), tripTimeBounds[1] + 300]
  }, [tripTimeBounds])

  // Reset timeRange when service or bounds change (derived state via ref tracking)
  const prevServiceRef = useRef(activeServiceId)
  const prevBoundsRef = useRef(tripTimeBounds)
  if (
    prevServiceRef.current !== activeServiceId ||
    prevBoundsRef.current[0] !== tripTimeBounds[0] ||
    prevBoundsRef.current[1] !== tripTimeBounds[1]
  ) {
    prevServiceRef.current = activeServiceId
    prevBoundsRef.current = tripTimeBounds
    setTimeRange(tripTimeBounds)
  }

  const filteredTrips = useMemo(
    () =>
      serviceTrips.filter((trip: RouteTrip) => {
        if (tripFilterId && String(trip.trip_id) !== String(tripFilterId)) return false
        if (headsignFilter && trip.trip_headsign !== headsignFilter) return false
        const start = secondsValue(trip.first_departure_seconds)
        const end = secondsValue(trip.last_arrival_seconds) ?? start
        if (start === undefined && end === undefined) return true
        return (start ?? end ?? 0) <= timeRange[1] && (end ?? start ?? 0) >= timeRange[0]
      }),
    [serviceTrips, timeRange, tripFilterId, headsignFilter],
  )

  const tripOptions = useMemo(
    () =>
      serviceTrips.map((t: RouteTrip) => ({ value: String(t.trip_id), label: String(t.trip_id) })),
    [serviceTrips],
  )

  const handleTripSelect = (trip?: RouteTrip) => {
    setSelectedTripIdLocal(trip?.trip_id)
    setTripFilterId(trip?.trip_id || "")
  }
  const handleTripDropdownChange = (v?: string) => handleTripSelect(v ? tripById.get(v) : undefined)

  // Route stops for shape drawing in service form
  const { data: routeStopsForShape = [] } = useQuery({
    queryKey: ["routeStopsForShape", routeId],
    queryFn: () => fetchRouteStopsForShape(conn, routeId),
    enabled: !!conn && !!initialized && showTripForm !== false,
    staleTime: Infinity,
  })

  // Calendar save mutation
  const calendarMutation = useMutation({
    mutationFn: async (data: any) => saveCalendarEdit(conn, data, data._isNew),
    onSuccess: () => {
      setShowCalendarForm(false)
      queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteServicesData"] })
      queryClient.invalidateQueries({ queryKey: ["EditCalendarTable"] })
      queryClient.invalidateQueries({ queryKey: ["editedCalendarMap"] })
    },
  })

  // Calendar delete — tracks pending state manually since we navigate before mutation
  const [isDeleting, setIsDeleting] = useState(false)
  const handleDeleteService = async (serviceId: string) => {
    onSelectionChange?.(undefined)
    setActiveServiceId(undefined)
    setSelectedTripIdLocal(undefined)
    setServiceFilterId("")
    setIsDeleting(true)
    try {
      await deleteServiceCascade(conn, serviceId, routeId)
      queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteServicesData"] })
      queryClient.invalidateQueries({ queryKey: ["EditCalendarTable"] })
      queryClient.invalidateQueries({ queryKey: ["editedCalendarMap"] })
      queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteTripsForServiceData"] })
      queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] })
      queryClient.invalidateQueries({ queryKey: ["EditTripsTable"] })
      queryClient.invalidateQueries({ queryKey: ["EditStopTimesTable"] })
      queryClient.invalidateQueries({ queryKey: ["editedTripMap"] })
      queryClient.invalidateQueries({ queryKey: ["editedTripMapForRoute"] })
    } catch (err) {
      logger.error("Service delete failed:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Trip add mutation — auto-select the new trip after creation
  const tripAddMutation = useMutation({
    mutationFn: async (data: any) => {
      await saveTripEdit(conn, data, true)
      return data
    },
    onSuccess: () => {
      setShowTripForm(false)
      queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteTripsForServiceData"] })
      queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] })
      queryClient.invalidateQueries({ queryKey: ["EditTripsTable"] })
      queryClient.invalidateQueries({ queryKey: ["editedTripMapForRoute"] })
    },
  })

  // Trip edit mutation
  const tripEditMutation = useMutation({
    mutationFn: async (data: any) => {
      await saveTripEdit(conn, data, false)
      return data
    },
    onSuccess: () => {
      setShowTripForm(false)
      queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteTripsForServiceData"] })
      queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] })
      queryClient.invalidateQueries({ queryKey: ["EditTripsTable"] })
      queryClient.invalidateQueries({ queryKey: ["editedTripMapForRoute"] })
    },
  })

  // Trip delete — deletes stop times then trip
  const [isDeletingTrip, setIsDeletingTrip] = useState(false)
  const handleDeleteTrip = async (tripId: string) => {
    setIsDeletingTrip(true)
    try {
      await deleteTripCascade(conn, tripId)
      setSelectedTripIdLocal(undefined)
      queryClient.invalidateQueries({ queryKey: ["fetchServiceRouteTripsForServiceData"] })
      queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] })
      queryClient.invalidateQueries({ queryKey: ["EditTripsTable"] })
      queryClient.invalidateQueries({ queryKey: ["EditStopTimesTable"] })
      queryClient.invalidateQueries({ queryKey: ["editedTripMap"] })
      queryClient.invalidateQueries({ queryKey: ["editedTripMapForRoute"] })
    } catch (err) {
      logger.error("Trip delete failed:", err)
    } finally {
      setIsDeletingTrip(false)
    }
  }

  const hasDateFilter =
    dateRange && dateBounds && (dateRange[0] !== dateBounds[0] || dateRange[1] !== dateBounds[1])
  const hasServiceFilters = Boolean(serviceFilterId || hasDateFilter)

  const serviceColumns = useMemo<ColumnDef<RouteServiceRow>[]>(
    () => [
      {
        accessorKey: "service_id",
        header: "Service ID",
        cell: ({ row }: any) => (
          <div className="flex items-center gap-2">
            <EditIndicator
              status={editedCalendarMap.get(row.original.service_id)}
              className="h-4 w-4"
            />
            <span>{row.original.service_id}</span>
          </div>
        ),
      },
      { accessorKey: "service_days", header: "Days" },
      { accessorKey: "start_date", header: "Start" },
      { accessorKey: "end_date", header: "End" },
      { accessorKey: "trip_count", header: "Trips" },
      { accessorKey: "shape_count", header: "Shapes" },
      { accessorKey: "added_dates", header: "Added Dates" },
      { accessorKey: "removed_dates", header: "Removed Dates" },
      { accessorKey: "first_exception_date", header: "First Exception" },
      { accessorKey: "last_exception_date", header: "Last Exception" },
    ],
    [editedCalendarMap],
  )

  const tripColumns = useMemo<ColumnDef<RouteTrip>[]>(
    () => [
      {
        accessorKey: "trip_id",
        header: "Trip ID",
        cell: ({ row }: any) => (
          <div className="flex items-center gap-2">
            <EditIndicator status={editedTripMap.get(row.original.trip_id)} className="h-4 w-4" />
            <span>{row.original.trip_id}</span>
          </div>
        ),
      },
      { accessorKey: "trip_headsign", header: "Headsign" },
      {
        accessorKey: "first_departure_time",
        header: "First Departure",
        cell: ({ row }: any) =>
          formatTripTime(row.original.first_departure_seconds) ||
          row.original.first_departure_time ||
          "",
      },
      {
        accessorKey: "last_arrival_time",
        header: "Last Arrival",
        cell: ({ row }: any) =>
          formatTripTime(row.original.last_arrival_seconds) || row.original.last_arrival_time || "",
      },
      { accessorKey: "direction_id", header: "Direction" },
      { accessorKey: "shape_id", header: "Shape" },
      { accessorKey: "block_id", header: "Block" },
    ],
    [editedTripMap],
  )

  return (
    <div className="space-y-4">
      {isDeleting && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
          <span>Deleting service and associated trips...</span>
        </div>
      )}
      {isDeleting ? null : (
        <>
          {/* Service selected */}
          {selectedService && !isDeleting ? (
            <div className="flex min-w-0 items-center gap-2 rounded-md border bg-primary/5 px-3 py-2">
              <button
                onClick={() => handleServiceSelect(undefined)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <BiX className="h-4 w-4" />
              </button>
              <EditIndicator
                status={editedCalendarMap.get(selectedService.service_id)}
                className="h-5 w-5"
              />
              <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">
                Service
              </span>
              <span className="truncate text-sm font-semibold">{selectedService.service_id}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {selectedService.service_days} {"\u2022"} {selectedService.trip_count || 0} trips
              </span>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowCalendarForm("edit")}
                >
                  <BiPencil className="mr-1 h-3 w-3" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (activeServiceId) handleDeleteService(activeServiceId)
                  }}
                >
                  <BiTrash className="mr-1 h-3 w-3" />
                  Delete
                </Button>
              </div>
            </div>
          ) : null}

          {/* Filter area */}
          {!selectedService && !isDeleting ? (
            <div className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-3">
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setShowCalendarForm("new")}
              >
                <BiPlus className="mr-1 h-4 w-4" />
                Add Service
              </Button>
              <Combobox
                options={serviceOptions}
                Message="Service ID"
                value={serviceFilterId}
                setValue={handleServiceDropdownChange}
              />
              {dateBounds ? (
                <div className="grid gap-2 px-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Date Range</span>
                    <span>
                      {dateRange
                        ? `${dayToDisplay(dateRange[0])} – ${dayToDisplay(dateRange[1])}`
                        : "All dates"}
                    </span>
                  </div>
                  <Slider
                    value={dateRange || dateBounds}
                    min={dateBounds[0]}
                    max={dateBounds[1]}
                    step={1}
                    onValueChange={(v) =>
                      setDateRange([v[0] ?? dateBounds[0], v[1] ?? dateBounds[1]] as [
                        number,
                        number,
                      ])
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : hasStopTimes && !isDeletingTrip ? (
            <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setShowTripForm("new")}
              >
                <BiPlus className="mr-1 h-4 w-4" />
                Add Trip
              </Button>
              <Combobox
                options={tripOptions}
                Message="Trip ID"
                value={tripFilterId}
                setValue={handleTripDropdownChange}
              />
              {headsignOptions.length > 1 && (
                <Combobox
                  options={headsignOptions}
                  Message="Headsign"
                  value={headsignFilter}
                  setValue={(v) => setHeadsignFilter(v || "")}
                />
              )}
              <div className="grid gap-2 px-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Time</span>
                  <span>{formatTimeRange(timeRange)}</span>
                </div>
                <Slider
                  value={timeRange}
                  min={sliderBounds[0]}
                  max={sliderBounds[1]}
                  step={300}
                  disabled={serviceTrips.length === 0}
                  onValueChange={(v) =>
                    setTimeRange([v[0] ?? sliderBounds[0], v[1] ?? sliderBounds[1]] as [
                      number,
                      number,
                    ])
                  }
                />
              </div>
            </div>
          ) : null}

          {/* Service table */}
          {!selectedService && !isDeleting ? (
            <TableComponent
              key="all-services"
              data={filteredServices}
              columns={serviceColumns}
              paginationKey="services"
              ClickInfo={undefined}
              setClickInfo={hasStopTimes ? handleServiceSelect : undefined}
              selectionKey="service_id"
              hasActiveFilters={hasServiceFilters}
              onSortingChange={undefined}
              clearSortingTrigger={undefined}
              onClearFilters={() => {
                setServiceFilterId("")
                setDateRange(dateBounds)
                handleServiceSelect(undefined)
              }}
            >
              {hasStopTimes ? (
                <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
                  Select a service to show trips
                </div>
              ) : (
                <div className="text-sm text-yellow-800 dark:text-yellow-200 p-3 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20">
                  stop_times.txt not imported — trip selection disabled
                </div>
              )}
            </TableComponent>
          ) : null}

          {selectedService && hasStopTimes && serviceTripsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : null}
          {selectedService && hasStopTimes && serviceTripsError ? (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Error loading service trips.
            </div>
          ) : null}

          {/* Trip deleting indicator */}
          {isDeletingTrip && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
              <span>Deleting trip and stop times...</span>
            </div>
          )}

          {/* Trip table */}
          {selectedService &&
          hasStopTimes &&
          !serviceTripsLoading &&
          !serviceTripsError &&
          !isDeletingTrip ? (
            <TableComponent
              key={activeServiceId}
              paginationKey="serviceTrips"
              data={filteredTrips}
              columns={tripColumns}
              ClickInfo={selectedTripId ? { trip_id: selectedTripId } : undefined}
              setClickInfo={(trip: RouteTrip | undefined) => {
                if (!trip) {
                  setSelectedTripIdLocal(undefined)
                  return
                }
                setSelectedTripIdLocal(
                  selectedTripId === String(trip.trip_id) ? undefined : String(trip.trip_id),
                )
              }}
              selectionKey="trip_id"
              onSortingChange={undefined}
              clearSortingTrigger={undefined}
              hasActiveFilters={Boolean(
                tripFilterId ||
                headsignFilter ||
                timeRange[0] !== tripTimeBounds[0] ||
                timeRange[1] !== tripTimeBounds[1],
              )}
              onClearFilters={() => {
                setTripFilterId("")
                setHeadsignFilter("")
                setTimeRange(tripTimeBounds)
                setSelectedTripIdLocal(undefined)
              }}
            >
              {selectedTripId ? (
                <div className="flex items-center gap-2 p-3 border rounded-md bg-primary/5">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/trips/table" search={{ selectedTripId }}>
                      <BiInfoCircle className="mr-1 h-4 w-4" />
                      View Trip
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowTripForm("edit")}>
                    <BiPencil className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteTrip(selectedTripId)}
                  >
                    <BiTrash className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
                  Select a trip
                </div>
              )}
            </TableComponent>
          ) : null}
        </>
      )}

      {/* Calendar Form Dialog */}
      {showCalendarForm && (
        <FormPopup OpenValue={{ state: true }} setOpenValue={() => setShowCalendarForm(false)}>
          <h3 className="text-lg font-semibold mb-4">
            {showCalendarForm === "new" ? "Add Service" : "Edit Service"}
          </h3>
          <CalendarForm
            initialData={showCalendarForm === "edit" ? selectedService : undefined}
            onSave={(data) =>
              calendarMutation.mutate({ ...data, _isNew: showCalendarForm === "new" })
            }
            onCancel={() => setShowCalendarForm(false)}
            isPending={calendarMutation.isPending}
          />
        </FormPopup>
      )}

      {/* Trip Form */}
      {showTripForm && (
        <FormPopup OpenValue={{ state: true }} setOpenValue={() => setShowTripForm(false)}>
          <h3 className="text-lg font-semibold mb-4">
            {showTripForm === "edit" ? "Edit Trip" : "Add Trip"}
          </h3>
          <TripForm
            routeId={routeId}
            serviceId={activeServiceId || ""}
            initialData={showTripForm === "edit" ? tripById.get(selectedTripId!) : undefined}
            onSave={(data) =>
              showTripForm === "edit" ? tripEditMutation.mutate(data) : tripAddMutation.mutate(data)
            }
            onCancel={() => setShowTripForm(false)}
            isPending={
              showTripForm === "edit" ? tripEditMutation.isPending : tripAddMutation.isPending
            }
            routeStops={routeStopsForShape}
          />
        </FormPopup>
      )}
    </div>
  )
}

export default RouteService
