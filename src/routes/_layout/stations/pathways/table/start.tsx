import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import PathwaysHeader from "@/client/Stations/SelectedStations/StationPathways/Header";
import Table from "@/client/Stations/SelectedStations/StationPathways/TableView/Components/Table";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchRouteData } from "@/lib/duckdb/DataFetching/fetchRouteData";
import { Skeleton } from "@/components/ui/skeleton";

type StartTableSearchParams = {
  selectedStationId?: string;
  emptyConnect?: boolean;
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

export const Route = createFileRoute("/_layout/stations/pathways/table/start")({
  component: StartTablePage,
  validateSearch: (search: Record<string, unknown>): StartTableSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      emptyConnect: search.emptyConnect !== undefined ? Boolean(search.emptyConnect) : true,
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
  const navigate = useNavigate();
  const { conn } = useDuckDB();
  const queryClient = useQueryClient();

  const stationId = search.selectedStationId;

  const EmptyConnect = search.emptyConnect ?? true;
  const StartDropdown = search.startDropdown;
  const EndDropdown = search.endDropdown;
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

  const stationData = queryClient.getQueryData(["fetchStationInfoData", stationId]);

  const { data: RouteData, isLoading: isTableLoading } = useQuery({
    queryKey: ["fetchRouteData", stationId],
    queryFn: async () => {
      const result = await fetchRouteData({
        conn,
        StationView: stationData?.stop_id ? stationData : { stop_id: stationId }
      });
      return result;
    },
    enabled: !!conn && !!stationId,
    staleTime: Infinity,
  });

  const hasNullConnections = useMemo(() => {
    if (!RouteData || !Array.isArray(RouteData)) return false;
    return RouteData.some(row => row.shortest_time === null || row.shortest_time === undefined);
  }, [RouteData]);

  if (isTableLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
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
        setEmptyConnect={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              emptyConnect: value
            })
          });
        }}
        onReset={() => {
          navigate({
            search: (prev) => ({
              selectedStationId: prev.selectedStationId
            })
          });
        }}
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
        setEmptyConnect={(value) => navigate({ search: (prev) => ({ ...prev, emptyConnect: value }) })}
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
      />
    </div>
  );
}
