import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import PathwaysHeader from "@/client/Stations/SelectedStations/StationPathways/Header";
import PathwaysLoadingSkeleton from "@/client/Stations/SelectedStations/StationPathways/LoadingSkeleton";
import Table from "@/client/Stations/SelectedStations/StationPathways/TableView/Components/Table";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchStationPathwaysComplete } from "@/lib/duckdb/DataFetching/pathways";
import {
  buildEndpointRouteTableData,
  mergeEndpointRouteTableData,
} from "@/lib/pathways/endpointRouteTable";
import { usePathwaysNavigate } from "../-usePathwaysNavigate";

type StartTableSearchParams = {
  selectedStationId?: string;
  fromStop?: string;
  toStop?: string;
  emptyConnect?: boolean;
  emptyArcs?: boolean;
  wheelchairOnly?: boolean;
  startDropdown?: string;
  endDropdown?: string;
  timeRangeMin?: number;
  timeRangeMax?: number;
  excludeTime?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startStopTypesDropdown?: string[];
  endStopTypesDropdown?: string[];
};

const parseBooleanSearchParam = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  return value !== false && value !== "false";
};

export const Route = createFileRoute("/_layout/stations/pathways/table/start")({
  component: StartTablePage,
  validateSearch: (search: Record<string, unknown>): StartTableSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      fromStop: search.fromStop as string | undefined,
      toStop: search.toStop as string | undefined,
      emptyConnect: parseBooleanSearchParam(search.emptyConnect ?? search.emptyArcs),
      emptyArcs: parseBooleanSearchParam(search.emptyArcs),
      wheelchairOnly: parseBooleanSearchParam(search.wheelchairOnly) ?? false,
      startDropdown: search.startDropdown as string | undefined,
      endDropdown: search.endDropdown as string | undefined,
      timeRangeMin: search.timeRangeMin !== undefined ? Number(search.timeRangeMin) : undefined,
      timeRangeMax: search.timeRangeMax !== undefined ? Number(search.timeRangeMax) : undefined,
      excludeTime: search.excludeTime !== undefined ? Number(search.excludeTime) : undefined,
      sortBy: search.sortBy as string | undefined,
      sortOrder: (search.sortOrder === 'asc' || search.sortOrder === 'desc') ? search.sortOrder : undefined,
      startStopTypesDropdown: Array.isArray(search.startStopTypesDropdown)
        ? search.startStopTypesDropdown as string[]
        : search.startStopTypesDropdown
        ? [search.startStopTypesDropdown as string]
        : undefined,
      endStopTypesDropdown: Array.isArray(search.endStopTypesDropdown)
        ? search.endStopTypesDropdown as string[]
        : search.endStopTypesDropdown
        ? [search.endStopTypesDropdown as string]
        : undefined,
    };
  },
});

function StartTablePage() {
  const search = Route.useSearch();
  const navigate = usePathwaysNavigate();
  const { conn, initialized } = useDuckDB();
  const previousStationIdRef = useRef<string | undefined>(undefined);

  const stationId = search.selectedStationId;

  const wheelchairOnly = search.wheelchairOnly ?? false;
  const StartDropdown = search.fromStop ?? search.startDropdown;
  const EndDropdown = search.toStop ?? search.endDropdown;
  const StartStopTypesDropdown = search.startStopTypesDropdown ?? [];
  const EndStopTypesDropdown = search.endStopTypesDropdown ?? [];
  const ExcludeTime = search.excludeTime;
  const SortBy = search.sortBy;
  const SortOrder = search.sortOrder;
  const TimeRange = search.timeRangeMin !== undefined && search.timeRangeMax !== undefined
    ? [search.timeRangeMin, search.timeRangeMax] as [number, number]
    : undefined;

  const [timeIntervalRanges, setTimeIntervalRanges] = useState([]);
  const [StartStops, setStartStops] = useState([]);
  const [StartStopTypes, setStartStopTypes] = useState([]);
  const [EndStopTypes, setEndStopTypes] = useState([]);
  const [EndStops, setEndStops] = useState([]);

  const defaultTimeRange = useMemo<[number, number] | undefined>(() => {
    if (!timeIntervalRanges || timeIntervalRanges.length === 0) return undefined;
    const values = new Set<number>();
    timeIntervalRanges.forEach((range: any) => {
      if (typeof range.min === "number") values.add(range.min);
      if (typeof range.max === "number") values.add(range.max);
    });
    const sortedValues = Array.from(values).sort((a, b) => a - b);
    if (sortedValues.length === 0) return undefined;
    return [sortedValues[0], sortedValues[sortedValues.length - 1]];
  }, [timeIntervalRanges]);

  const { data: pathwayDataComplete, isLoading: isTableLoading } = useQuery({
    queryKey: ["stationPathwaysComplete", stationId],
    queryFn: async () => {
      if (!stationId) {
        throw new Error("No station ID provided");
      }

      return fetchStationPathwaysComplete({
        conn,
        StationView: { stop_id: stationId },
      });
    },
    enabled: !!conn && !!stationId && initialized,
    staleTime: Infinity,
    retry: false,
  });

  const availableStops = useMemo(
    () =>
      (pathwayDataComplete?.stops ?? [])
        .filter(
          (stop: any) =>
            stop?.stop_id != null &&
            stop?.status !== "deleted" &&
            stop?.location_type_name !== "Station",
        )
        .map((stop: any) => ({
          stop_id: String(stop.stop_id),
          location_type: String(stop.location_type_name ?? "Unknown"),
          stop_name: String(stop.stop_name ?? stop.stop_id),
        }))
        .sort((left: any, right: any) =>
          String(left.stop_id).localeCompare(String(right.stop_id)),
        ),
    [pathwayDataComplete?.stops],
  );

  const availableStopTypes = useMemo(
    () =>
      Array.from(
        new Set(availableStops.map((stop: any) => stop.location_type)),
      ).sort(),
    [availableStops],
  );

  useEffect(() => {
    setStartStops(availableStops);
    setEndStops(availableStops);
    setStartStopTypes(availableStopTypes);
    setEndStopTypes(availableStopTypes);
  }, [availableStops, availableStopTypes]);

  const TimedRouteData = useMemo(
    () =>
      buildEndpointRouteTableData({
        stops: pathwayDataComplete?.stops ?? [],
        connections: pathwayDataComplete?.connections ?? [],
        viewType: "start",
        wheelchairAccessibleOnly: wheelchairOnly,
        preferNullConnections: false,
      }),
    [pathwayDataComplete, wheelchairOnly],
  );
  const NullRouteData = useMemo(
    () =>
      buildEndpointRouteTableData({
        stops: pathwayDataComplete?.stops ?? [],
        connections: pathwayDataComplete?.connections ?? [],
        viewType: "start",
        wheelchairAccessibleOnly: wheelchairOnly,
        preferNullConnections: true,
      }),
    [pathwayDataComplete, wheelchairOnly],
  );

  const hasNullConnections = useMemo(() => {
    const connections = pathwayDataComplete?.connections ?? [];
    return connections.some((connection: any) =>
      connection?.traversal_time === null ||
      connection?.traversal_time === undefined ||
      connection?.traversal_time === ""
    );
  }, [pathwayDataComplete?.connections]);
  const hasTimedConnections = useMemo(() => {
    const connections = pathwayDataComplete?.connections ?? [];
    return connections.some((connection: any) =>
      connection?.traversal_time !== null &&
      connection?.traversal_time !== undefined &&
      connection?.traversal_time !== ""
    );
  }, [pathwayDataComplete?.connections]);
  const EmptyConnect = !hasTimedConnections
    ? false
    : (search.emptyConnect ?? search.emptyArcs ?? true);

  useEffect(() => {
    if (!stationId) {
      return;
    }

    const stationChanged = previousStationIdRef.current !== stationId;
    previousStationIdRef.current = stationId;

    if (!hasTimedConnections) {
      if (search.emptyConnect === false && search.emptyArcs === false) {
        return;
      }

      navigate({
        search: (prev) => ({
          ...prev,
          emptyConnect: false,
          emptyArcs: false,
        }),
        replace: true,
      });
      return;
    }

    if (!stationChanged) {
      return;
    }

    if (search.emptyConnect === true && search.emptyArcs === true) {
      return;
    }

    navigate({
      search: (prev) => ({
        ...prev,
        emptyConnect: true,
        emptyArcs: true,
      }),
      replace: true,
    });
  }, [
    hasTimedConnections,
    navigate,
    search.emptyArcs,
    search.emptyConnect,
    stationId,
  ]);

  const RouteData = useMemo(() => {
    if (EmptyConnect) {
      return TimedRouteData;
    }

    return mergeEndpointRouteTableData(TimedRouteData, NullRouteData);
  }, [TimedRouteData, NullRouteData, EmptyConnect]);

  const handleRouteClick = (route: {
    start_stop?: string;
    end_stop?: string;
  }) => {
    navigate({
      to: "/stations/pathways/flow/column",
      search: {
        selectedStationId: stationId,
        selectedNodeId: undefined,
        selectedPathwayId: undefined,
        fromStop: route.start_stop || undefined,
        toStop: route.end_stop || undefined,
      },
    });
  };

  if (isTableLoading) {
    return (
      <PathwaysLoadingSkeleton
        className="p-4"
        contentClassName="h-64"
      />
    );
  }

  if (!RouteData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">No pathways data available.</div>
      </div>
    );
  }

  return (
    <div>
      <PathwaysHeader
        mode="table"
        viewType="start"
      EmptyConnect={EmptyConnect}
      hasNullConnections={hasNullConnections}
      showTimeRangeSlider={hasTimedConnections && RouteData.length > 0}
      setEmptyConnect={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              emptyConnect: value,
              emptyArcs: value,
            })
          });
        }}
        onReset={() => {
          navigate({
            search: (prev) => ({
              selectedStationId: prev.selectedStationId,
              fromStop: undefined,
              toStop: undefined,
              startDropdown: undefined,
              endDropdown: undefined,
              wheelchairOnly: false,
              emptyConnect: undefined,
              emptyArcs: undefined,
            })
          });
        }}
        wheelchairAccessibleOnly={wheelchairOnly}
        onWheelchairAccessibleOnlyChange={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              wheelchairOnly: value,
            }),
          });
        }}
        showWheelchairAccessibleSwitch={true}
        hasTimedConnections={hasTimedConnections}
        StartDropdown={StartDropdown}
        setStartDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { startDropdown, fromStop, ...rest } = prev;
              return value
                ? { ...rest, startDropdown: value, fromStop: value }
                : rest;
            }
          });
        }}
        EndDropdown={EndDropdown}
        setEndDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { endDropdown, toStop, ...rest } = prev;
              return value
                ? { ...rest, endDropdown: value, toStop: value }
                : rest;
            }
          });
        }}
        StartStops={StartStops}
        setStartStops={setStartStops}
        EndStops={EndStops}
        setEndStops={setEndStops}
        StartStopTypes={StartStopTypes}
        setStartStopTypes={setStartStopTypes}
        StartStopTypesDropdown={StartStopTypesDropdown}
        setStartStopTypesDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { startStopTypesDropdown, ...rest } = prev;
              return value && value.length > 0 ? { ...rest, startStopTypesDropdown: value } : rest;
            }
          });
        }}
        EndStopTypes={EndStopTypes}
        setEndStopTypes={setEndStopTypes}
        EndStopTypesDropdown={EndStopTypesDropdown}
        setEndStopTypesDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { endStopTypesDropdown, ...rest } = prev;
              return value && value.length > 0 ? { ...rest, endStopTypesDropdown: value } : rest;
            }
          });
        }}
        timeIntervalRanges={timeIntervalRanges}
        TimeRange={TimeRange}
        defaultTimeRange={defaultTimeRange}
        ExcludeTime={ExcludeTime}
        setTimeRange={(value: any) => {
          navigate({
            search: (prev) => {
              const { timeRangeMin, timeRangeMax, excludeTime, ...rest } = prev;

              if (value && typeof value === 'object' && 'exclude' in value) {
                return { ...rest, excludeTime: value.exclude };
              } else if (value && Array.isArray(value)) {
                return { ...rest, timeRangeMin: value[0], timeRangeMax: value[1] };
              } else {
                return rest;
              }
            }
          });
        }}
        isLoading={false}
      />
      <Table
        TabValue="start"
        StartDropdown={StartDropdown}
        setStartDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { startDropdown, ...rest } = prev;
              return value ? { ...rest, startDropdown: value } : rest;
            }
          });
        }}
        EndDropdown={EndDropdown}
        setEndDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { endDropdown, ...rest } = prev;
              return value ? { ...rest, endDropdown: value } : rest;
            }
          });
        }}
        StartStopTypes={StartStopTypes}
        setStartStopTypes={setStartStopTypes}
        StartStopTypesDropdown={StartStopTypesDropdown}
        setStartStopTypesDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { startStopTypesDropdown, ...rest } = prev;
              return value && value.length > 0 ? { ...rest, startStopTypesDropdown: value } : rest;
            }
          });
        }}
        EndStopTypes={EndStopTypes}
        setEndStopTypes={setEndStopTypes}
        setEndStopTypesDropdown={(value) => {
          navigate({
            search: (prev) => {
              const { endStopTypesDropdown, ...rest } = prev;
              return value && value.length > 0 ? { ...rest, endStopTypesDropdown: value } : rest;
            }
          });
        }}
        EndStopTypesDropdown={EndStopTypesDropdown}
        RouteData={RouteData}
        EmptyConnect={EmptyConnect}
        setEmptyConnect={(value) =>
          navigate({ search: (prev) => ({ ...prev, emptyConnect: value, emptyArcs: value }) })
        }
        StartStops={StartStops}
        setStartStops={setStartStops}
        EndStops={EndStops}
        setEndStops={setEndStops}
        TimeRange={TimeRange}
        setTimeRange={(value: any) => {
          navigate({
            search: (prev) => {
              const { timeRangeMin, timeRangeMax, excludeTime, ...rest } = prev;

              if (value && typeof value === 'object' && 'exclude' in value) {
                return { ...rest, excludeTime: value.exclude };
              } else if (value && Array.isArray(value)) {
                return { ...rest, timeRangeMin: value[0], timeRangeMax: value[1] };
              } else {
                return rest;
              }
            }
          });
        }}
        setTimeIntervalRanges={setTimeIntervalRanges}
        timeIntervalRanges={timeIntervalRanges}
        ExcludeTime={ExcludeTime}
        SortBy={SortBy}
        SortOrder={SortOrder}
        setSortBy={(value) => {
          navigate({
            search: (prev) => {
              const { sortBy, ...rest } = prev;
              return value ? { ...rest, sortBy: value } : rest;
            }
          });
        }}
        setSortOrder={(value) => {
          navigate({
            search: (prev) => {
              const { sortOrder, ...rest } = prev;
              return value ? { ...rest, sortOrder: value } : rest;
            }
          });
        }}
        onRouteClick={handleRouteClick}
      />
    </div>
  );
}
