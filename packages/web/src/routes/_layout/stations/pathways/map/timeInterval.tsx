import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStopColor } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";
import PathwaysHeader from "@/client/Stations/SelectedStations/StationPathways/Header";
import PathwaysLoadingSkeleton from "@/client/Stations/SelectedStations/StationPathways/LoadingSkeleton";
import MapSection from "@/client/Stations/SelectedStations/StationPathways/MapView/MapSection";
import { getAvailablePopupFields } from "@/client/Stations/SelectedStations/StationPathways/MapView/popupFields";
import MapContainer from "@/components/maps/MapContainer";
import MapLegend from "@/components/maps/MapLegend";
import MapClickPopup from "@/components/maps/MapClickPopup";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchStationPathwaysComplete } from "@/lib/duckdb/DataFetching/pathways";
import { fetchPathwayMapRouteData } from "@/lib/duckdb/DataFetching/pathways/fetchPathwayMapRoute";
import { getPathwayRouteFilterData } from "@/lib/pathways/routeFilterGraph";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { BiEdit, BiReset } from "react-icons/bi";
import { usePathwaysNavigate } from "../-usePathwaysNavigate";

type TimeIntervalSearchParams = {
  selectedStationId?: string;
  toStop?: string;
  fromStop?: string;
  timeRangeMin?: number;
  timeRangeMax?: number;
  excludeTime?: number;
  emptyArcs?: boolean;
  showOnlyConnected?: boolean;
};

export const Route = createFileRoute("/_layout/stations/pathways/map/timeInterval")({
  component: TimeIntervalMapPage,
  validateSearch: (search: Record<string, unknown>): TimeIntervalSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      toStop: search.toStop as string | undefined,
      fromStop: search.fromStop as string | undefined,
      timeRangeMin: search.timeRangeMin !== undefined ? Number(search.timeRangeMin) : undefined,
      timeRangeMax: search.timeRangeMax !== undefined ? Number(search.timeRangeMax) : undefined,
      excludeTime: search.excludeTime !== undefined ? Number(search.excludeTime) : undefined,
      emptyArcs: search.emptyArcs !== undefined ? search.emptyArcs !== false && search.emptyArcs !== 'false' : false,
      showOnlyConnected: search.showOnlyConnected !== undefined ? search.showOnlyConnected !== false && search.showOnlyConnected !== 'false' : false,
    };
  },
});

function TimeIntervalMapPage() {
  const search = Route.useSearch();
  const navigate = usePathwaysNavigate();
  const { conn, initialized } = useDuckDB();
  const { theme } = useThemeContext();
  const queryClient = useQueryClient();
  const routeContext = Route.useRouteContext();
  const { ClickInfo: parentClickInfo, setClickInfo: parentSetClickInfo, MapViewState, setMapViewState } = routeContext || {};

  const [localClickInfo, setLocalClickInfo] = useState(parentClickInfo);

  const stationId = search.selectedStationId;

  const ToStop = search.toStop;
  const FromStop = search.fromStop;
  const EmptyArcs = search.emptyArcs !== undefined ? search.emptyArcs : false;
  const ExcludeTime = search.excludeTime;
  const ShowOnlyConnected = search.showOnlyConnected !== undefined ? search.showOnlyConnected : false;
  const TimeRange = search.timeRangeMin !== undefined && search.timeRangeMax !== undefined
    ? [search.timeRangeMin, search.timeRangeMax] as [number, number]
    : undefined;

  const {
    data: pathwayDataComplete,
    isLoading: isMapLoading,
    dataUpdatedAt: pathwayDataUpdatedAt,
  } = useQuery({
    queryKey: ["stationPathwaysComplete", stationId],
    queryFn: async () => {
      if (!stationId) {
        throw new Error('No station ID provided');
      }
      const result = await fetchStationPathwaysComplete({
        conn,
        StationView: { stop_id: stationId },
      });
      return result;
    },
    enabled: !!conn && !!stationId,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    setLocalClickInfo(parentClickInfo);
  }, [parentClickInfo]);

  const handleSetClickInfo = useCallback((value: any) => {
    setLocalClickInfo(value);
    if (parentSetClickInfo) {
      parentSetClickInfo(value);
    }
  }, [parentSetClickInfo]);

  const handleGoToLocation = useCallback(() => {
    const clickData = localClickInfo?.object || localClickInfo;

    if (localClickInfo?.layer?.id === "TableView") {
      if (clickData?.stop_lon && clickData?.stop_lat) {
        if (setMapViewState) {
          setMapViewState({
            longitude: clickData.stop_lon,
            latitude: clickData.stop_lat,
            zoom: 18,
          });
        }
      }
    } else if (localClickInfo?.layer?.id === "ArcLayer" || localClickInfo?.layer?.id === "PointLayer") {
      if (clickData?.from_coord && clickData?.to_coord) {
        const midLon = (clickData.from_coord[1] + clickData.to_coord[1]) / 2;
        const midLat = (clickData.from_coord[0] + clickData.to_coord[0]) / 2;
        if (setMapViewState) {
          setMapViewState({
            longitude: midLon,
            latitude: midLat,
            zoom: 18,
          });
        }
      }
    }
  }, [localClickInfo, setMapViewState]);

  const handleEditStopInFlow = useCallback(
    (stopId?: string) => {
      if (!stationId || !stopId) {
        return;
      }

      navigate({
        to: "/stations/pathways/flow/column",
        search: {
          selectedStationId: stationId,
          selectedNodeId: String(stopId),
          selectedPathwayId: undefined,
          editTarget: "node",
        },
      });
    },
    [navigate, stationId],
  );

  const handleEditPathwayInFlow = useCallback(
    (pathwayId?: string) => {
      if (!stationId || !pathwayId) {
        return;
      }

      navigate({
        to: "/stations/pathways/flow/column",
        search: {
          selectedStationId: stationId,
          selectedNodeId: undefined,
          selectedPathwayId: String(pathwayId),
          editTarget: "pathway",
        },
      });
    },
    [navigate, stationId],
  );

  const baseConnections = useMemo(() => {
    if (!pathwayDataComplete?.connections) return [];

    let connections = [...pathwayDataComplete.connections];

    if (ExcludeTime !== undefined) {
      connections = connections.filter((p: any) => {
        const timeValue = p.traversal_time;

        return (
          timeValue !== null &&
          timeValue !== undefined &&
          timeValue !== ExcludeTime
        );
      });
    } else if (TimeRange) {
      const [minTime, maxTime] = TimeRange;

      connections = connections.filter((p: any) => {
        const timeValue = p.traversal_time;

        if (!EmptyArcs) {
          return (
            timeValue !== null &&
            timeValue !== undefined &&
            timeValue >= minTime &&
            timeValue <= maxTime
          );
        }

        return (
          timeValue === null ||
          timeValue === undefined ||
          (timeValue >= minTime && timeValue <= maxTime)
        );
      });
    } else if (!EmptyArcs) {
      connections = connections.filter((p: any) => {
        const timeValue = p.traversal_time;
        return timeValue !== null && timeValue !== undefined;
      });
    }

    return connections;
  }, [
    pathwayDataComplete?.connections,
    ExcludeTime,
    TimeRange,
    EmptyArcs,
  ]);

  const localRouteFilterData = useMemo(
    () =>
      getPathwayRouteFilterData({
        stops: pathwayDataComplete?.stops ?? [],
        connections: baseConnections,
        fromStopId: FromStop,
        toStopId: ToStop,
      }),
    [pathwayDataComplete?.stops, baseConnections, FromStop, ToStop],
  );

  const hasRouteEndpointFilters = Boolean(FromStop || ToStop);
  const { data: queriedRouteFilterData } = useQuery({
    queryKey: [
      "stationPathwaysMapRoute",
      "timeInterval",
      stationId,
      pathwayDataUpdatedAt,
      FromStop ?? "",
      ToStop ?? "",
      TimeRange?.[0] ?? null,
      TimeRange?.[1] ?? null,
      ExcludeTime ?? null,
      EmptyArcs,
    ],
    queryFn: async () =>
      fetchPathwayMapRouteData({
        conn,
        stationId: String(stationId),
        stops: pathwayDataComplete?.stops ?? [],
        fromStopId: FromStop,
        toStopId: ToStop,
        minTime: TimeRange?.[0],
        maxTime: TimeRange?.[1],
        includeNullTime: EmptyArcs,
        excludeTime: ExcludeTime,
      }),
    enabled:
      Boolean(conn) &&
      Boolean(stationId) &&
      Boolean(pathwayDataComplete) &&
      hasRouteEndpointFilters,
    staleTime: 0,
  });

  const routeFilterData =
    hasRouteEndpointFilters && queriedRouteFilterData
      ? queriedRouteFilterData
      : localRouteFilterData;

  const availableFromStops = routeFilterData.availableFromStops;
  const availableToStops = routeFilterData.availableToStops;

  const availableTimeValues = useMemo(() => {
    if (!pathwayDataComplete?.connections) return [];

    const connections =
      FromStop || ToStop
        ? routeFilterData.filteredConnections
        : baseConnections;

    const times = new Set<number>();
    connections.forEach((conn: any) => {
      if (conn.traversal_time !== null && conn.traversal_time !== undefined) {
        times.add(conn.traversal_time);
      }
    });

    return Array.from(times).sort((a, b) => a - b);
  }, [
    pathwayDataComplete?.connections,
    baseConnections,
    FromStop,
    ToStop,
    routeFilterData.filteredConnections,
  ]);

  const availableTimeIntervals = useMemo(() => {
    if (availableTimeValues.length === 0 || !pathwayDataComplete?.timeIntervals) return [];

    return pathwayDataComplete.timeIntervals.filter((interval: any) => {
      return availableTimeValues.some(time => time >= interval.min && time <= interval.max);
    });
  }, [availableTimeValues, pathwayDataComplete?.timeIntervals]);

  const defaultTimeRange = useMemo<[number, number] | undefined>(() => {
    if (availableTimeValues.length === 0) return undefined;
    return [availableTimeValues[0], availableTimeValues[availableTimeValues.length - 1]];
  }, [availableTimeValues]);

  const hasNullConnections = useMemo(() => {
    if (!pathwayDataComplete?.connections) return false;
    return pathwayDataComplete.connections.some((conn: any) =>
      conn.traversal_time === null || conn.traversal_time === undefined
    );
  }, [pathwayDataComplete?.connections]);

  const filteredConnections = useMemo(() => {
    return routeFilterData.filteredConnections;
  }, [routeFilterData.filteredConnections]);

  const pathwayData = useMemo(() => {
    if (!pathwayDataComplete) return undefined;

    let stops = [...(pathwayDataComplete.stops || [])];

    if (ShowOnlyConnected) {
      const connectedStopIds = new Set<string>();
      filteredConnections.forEach((conn: any) => {
        if (conn.from_stop_id) connectedStopIds.add(conn.from_stop_id);
        if (conn.to_stop_id) connectedStopIds.add(conn.to_stop_id);
      });
      stops = stops.filter((stop: any) => connectedStopIds.has(stop.stop_id));
    }

    const data = {
      stops,
      connections: filteredConnections,
      _version: Date.now(),
    };
    return data;
  }, [pathwayDataComplete, filteredConnections, ShowOnlyConnected]);

  const legendItems = useMemo(() => {
    if (!availableTimeIntervals || availableTimeIntervals.length === 0) return [];
    return availableTimeIntervals.map(interval => ({
      label: `${interval.min}-${interval.max}s`,
      color: interval.color
    }));
  }, [availableTimeIntervals]);

  if (isMapLoading) {
    return (
      <PathwaysLoadingSkeleton contentClassName="h-[70vh]" />
    );
  }

  const getPopupBorderColor = () => {
    const clickData = localClickInfo?.object || localClickInfo;
    if (!clickData) return "#3b82f6";

    if (localClickInfo?.layer?.id === "TableView") {
      const color = getStopColor(clickData.location_type_name, theme);
      return color ? rgbToHex(color) : "#3b82f6";
    }
    if (localClickInfo?.layer?.id === "ArcLayer" || localClickInfo?.layer?.id === "PointLayer") {
      const value = clickData?.timeInterval;
      if (value !== null && value !== undefined && availableTimeIntervals) {
        for (const range of availableTimeIntervals) {
          if (value >= range.min && value <= range.max) {
            return range.color;
          }
        }
      }
      return rgbToHex(theme === 'dark' ? [160, 160, 160] : [100, 100, 100]);
    }
    return "#3b82f6";
  };

  const clickData = localClickInfo?.object || localClickInfo;
  const hasMapData = Boolean(pathwayData?.stops?.length);
  const nodePopupFields = getAvailablePopupFields(clickData, [
    { key: "stop_id", label: "Stop Id" },
    { key: "level_id", label: "Level" },
    { key: "stop_lon", label: "Stop Lon" },
    { key: "stop_lat", label: "Stop Lat" },
    { key: "status", label: "Status" },
    { key: "location_type_name", label: "Location Type" },
    { key: "wheelchair_status", label: "Wheelchair Boarding" },
  ]);

  const popupElement = clickData ? (
    <>
      {localClickInfo?.layer?.id === "TableView" && (
        <MapClickPopup
          title={clickData.stop_name}
          data={clickData}
          onClose={() => handleSetClickInfo(undefined)}
          borderColor={getPopupBorderColor()}
          columns={nodePopupFields.columns}
          columnNames={nodePopupFields.columnNames}
          actions={
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGoToLocation}
                className="w-full justify-center bg-primary/10 dark:bg-primary/20 border-primary/50 hover:bg-primary/20 dark:hover:bg-primary/30"
              >
                <BiReset className="mr-2 h-4 w-4 shrink-0" />
                zoom
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEditStopInFlow(clickData?.stop_id)}
                className="w-full justify-center"
              >
                <BiEdit className="mr-2 h-4 w-4 shrink-0" />
                edit
              </Button>
            </div>
          }
        />
      )}
      {(localClickInfo?.layer?.id === "ArcLayer" || localClickInfo?.layer?.id === "PointLayer") && (
        <MapClickPopup
          title={clickData.id || clickData.pathway_id}
          data={{
            ...clickData,
            from_Lat: clickData.from_coord?.[0],
            from_Lon: clickData.from_coord?.[1],
            to_Lat: clickData.to_coord?.[0],
            to_Lon: clickData.to_coord?.[1],
          }}
          onClose={() => handleSetClickInfo(undefined)}
          borderColor={getPopupBorderColor()}
          columns={["directional", "pathwayType", "timeInterval", "from_name", "from_Lat", "from_Lon", "to_name", "to_Lat", "to_Lon"]}
          columnNames={["Direction Type", "Pathway Type", "Time Interval", "From Name", "From Latitude", "From Longitude", "To Name", "To Latitude", "To Longitude"]}
          actions={
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGoToLocation}
                className="w-full justify-center bg-primary/10 dark:bg-primary/20 border-primary/50 hover:bg-primary/20 dark:hover:bg-primary/30"
              >
                <BiReset className="mr-2 h-4 w-4 shrink-0" />
                zoom
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleEditPathwayInFlow(clickData?.pathway_id ?? clickData?.id)
                }
                className="w-full justify-center"
              >
                <BiEdit className="mr-2 h-4 w-4 shrink-0" />
                edit
              </Button>
            </div>
          }
        />
      )}
    </>
  ) : null;

  return (
    <div>
      <PathwaysHeader
        mode="map"
        connectionType="timeInterval"
        ToStopsData={availableToStops}
        ToStop={ToStop}
        setToStop={(value) => {
          navigate({
            search: (prev) => {
              const { toStop, ...rest } = prev;
              return value ? { ...rest, toStop: value } : rest;
            }
          });
        }}
        fromStopsData={availableFromStops}
        FromStop={FromStop}
        setFromStop={(value) => {
          navigate({
            search: (prev) => {
              const { fromStop, ...rest } = prev;
              return value ? { ...rest, fromStop: value } : rest;
            }
          });
        }}
        onReset={() => {
          navigate({
            search: {
              selectedStationId: stationId
            }
          });
        }}
        ShowOnlyConnected={ShowOnlyConnected}
        setShowOnlyConnected={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              showOnlyConnected: value
            })
          });
        }}
        EmptyArcs={EmptyArcs}
        setEmptyArcs={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              emptyArcs: value
            })
          });
        }}
        hasNullConnections={hasNullConnections}
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
        timeIntervalRanges={availableTimeIntervals}
        timeIntervalValues={availableTimeValues}
        isLoading={false}
      />

      {hasMapData ? (
        <MapContainer
          instructionText="Click a Point or Arc to find out more"
          showLegend={legendItems.length > 0}
          legendContent={
            <MapLegend
              title="Time Intervals"
              items={legendItems}
              collapsible={true}
              defaultExpanded={true}
            />
          }
          clickPopup={popupElement}
        >
          <MapSection
            Data={pathwayData}
            setClickInfo={handleSetClickInfo}
            ClickInfo={localClickInfo}
            ConnectionType="timeInterval"
            timeIntervalRanges={availableTimeIntervals}
            viewState={MapViewState}
            setViewState={setMapViewState}
          />
        </MapContainer>
      ) : (
        <div className="relative h-[70vh] w-full border p-1 rounded-md overflow-hidden flex flex-col items-center justify-center">
          <div className="text-sm text-muted-foreground">
            No pathways data available for this station.
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            This station may not have any pathways defined.
          </div>
        </div>
      )}
    </div>
  );
}
