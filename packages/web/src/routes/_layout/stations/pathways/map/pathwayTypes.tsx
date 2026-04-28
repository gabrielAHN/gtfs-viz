import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStopColor, getPathwayColor } from "@/components/style";
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

type PathwayTypesSearchParams = {
  selectedStationId?: string;
  toStop?: string;
  fromStop?: string;
  pathwayTypes?: string[];
  showOnlyConnected?: boolean;
};

export const Route = createFileRoute("/_layout/stations/pathways/map/pathwayTypes")({
  component: PathwayTypesMapPage,
  validateSearch: (search: Record<string, unknown>): PathwayTypesSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      toStop: search.toStop as string | undefined,
      fromStop: search.fromStop as string | undefined,
      pathwayTypes: Array.isArray(search.pathwayTypes)
        ? search.pathwayTypes as string[]
        : search.pathwayTypes
        ? [search.pathwayTypes as string]
        : undefined,
      showOnlyConnected:
        search.showOnlyConnected !== undefined
          ? Boolean(search.showOnlyConnected)
          : false,
    };
  },
});

function PathwayTypesMapPage() {
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
  const PathwayTypes = search.pathwayTypes ?? [];
  const ShowOnlyConnected = search.showOnlyConnected ?? false;

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

  const baseConnections = useMemo(() => {
    if (!pathwayDataComplete?.connections) {
      return [];
    }

    let connections = [...pathwayDataComplete.connections];

    if (PathwayTypes && PathwayTypes.length > 0) {
      connections = connections.filter((p: any) =>
        PathwayTypes.includes(p.pathway_mode_name),
      );
    }

    return connections;
  }, [pathwayDataComplete?.connections, PathwayTypes]);

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
      "pathwayTypes",
      stationId,
      pathwayDataUpdatedAt,
      FromStop ?? "",
      ToStop ?? "",
      JSON.stringify(PathwayTypes ?? []),
    ],
    queryFn: async () =>
      fetchPathwayMapRouteData({
        conn,
        stationId: String(stationId),
        stops: pathwayDataComplete?.stops ?? [],
        fromStopId: FromStop,
        toStopId: ToStop,
        pathwayTypes: PathwayTypes,
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

  const availablePathwayTypes = useMemo(() => {
    if (!pathwayDataComplete?.connections) return [];

    const connections =
      FromStop || ToStop
        ? routeFilterData.filteredConnections
        : baseConnections;

    const types = new Set<string>();
    connections.forEach((conn: any) => {
      if (conn.pathway_mode_name) {
        types.add(conn.pathway_mode_name);
      }
    });

    return pathwayDataComplete.pathwayModesAvailable?.filter((mode: any) =>
      types.has(mode.value)
    ) || [];
  }, [
    pathwayDataComplete?.connections,
    pathwayDataComplete?.pathwayModesAvailable,
    baseConnections,
    FromStop,
    ToStop,
    routeFilterData.filteredConnections,
  ]);

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

    return {
      stops,
      connections: filteredConnections,
      _version: Date.now(),
    };
  }, [pathwayDataComplete, filteredConnections, ShowOnlyConnected]);

  const legendItems = useMemo(() => {
    if (!availablePathwayTypes || availablePathwayTypes.length === 0) return [];
    return availablePathwayTypes.map(type => ({
      label: type.label,
      color: rgbToHex(getPathwayColor(type.value, theme))
    }));
  }, [availablePathwayTypes, theme]);

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
      const pathwayType = clickData?.pathwayType;
      if (pathwayType) {
        return rgbToHex(getPathwayColor(pathwayType, theme));
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
        connectionType="PathwayTypes"
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
        pathwayTypeData={availablePathwayTypes}
        PathwayTypes={PathwayTypes}
        setPathwayTypes={(value) => {
          navigate({
            search: (prev) => {
              const { pathwayTypes, ...rest } = prev;
              return value && value.length > 0 ? { ...rest, pathwayTypes: value } : rest;
            }
          });
        }}
        isLoading={false}
      />

      {hasMapData ? (
        <MapContainer
          instructionText="Click a Point or Arc to find out more"
          showLegend={legendItems.length > 0}
          legendContent={
            <MapLegend
              title="Pathway Types"
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
            ConnectionType="PathwayTypes"
            timeIntervalRanges={pathwayDataComplete?.timeIntervals}
            viewState={MapViewState}
            setViewState={setMapViewState}
          />
        </MapContainer>
      ) : (
        <div className="relative h-[70vh] w-full border p-1 rounded-md overflow-hidden flex items-center justify-center">
          <div className="text-sm text-muted-foreground">
            No pathways data available for this station.
          </div>
        </div>
      )}
    </div>
  );
}
