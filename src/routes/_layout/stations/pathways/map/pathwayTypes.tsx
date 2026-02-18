import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStopColor, getPathwayColor } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";
import PathwaysHeader from "@/client/Stations/SelectedStations/StationPathways/Header";
import MapSection from "@/client/Stations/SelectedStations/StationPathways/MapView/MapSection";
import MapContainer from "@/components/maps/MapContainer";
import MapLegend from "@/components/maps/MapLegend";
import MapClickPopup from "@/components/maps/MapClickPopup";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchStationPathwaysComplete } from "@/lib/duckdb/DataFetching/pathways";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { BiReset } from "react-icons/bi";

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
  const navigate = useNavigate();
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

  const { data: pathwayDataComplete, isLoading: isMapLoading } = useQuery({
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

  const availableFromStops = useMemo(() => {
    if (!pathwayDataComplete?.connections) return [];

    let connections = pathwayDataComplete.connections;

    if (PathwayTypes && PathwayTypes.length > 0) {
      connections = connections.filter((p: any) => PathwayTypes.includes(p.pathway_mode_name));
    }

    const fromStops = new Set<string>();
    connections.forEach((conn: any) => {
      if (ToStop) {
        
        if (conn.to_stop_id === ToStop && conn.from_stop_id) {
          fromStops.add(conn.from_stop_id);
        }
        
        if (conn.direction_type === "bidirectional" && conn.from_stop_id === ToStop && conn.to_stop_id) {
          fromStops.add(conn.to_stop_id);
        }
      } else {
        
        if (conn.from_stop_id) fromStops.add(conn.from_stop_id);
        
        if (conn.direction_type === "bidirectional" && conn.to_stop_id) {
          fromStops.add(conn.to_stop_id);
        }
      }
    });

    if (FromStop) {
      fromStops.add(FromStop);
    }

    return Array.from(fromStops).sort().map(stopId => ({
      label: stopId,
      value: stopId
    }));
  }, [pathwayDataComplete?.connections, PathwayTypes, ToStop, FromStop]);

  const availableToStops = useMemo(() => {
    if (!pathwayDataComplete?.connections) return [];

    let connections = pathwayDataComplete.connections;

    if (PathwayTypes && PathwayTypes.length > 0) {
      connections = connections.filter((p: any) => PathwayTypes.includes(p.pathway_mode_name));
    }

    const toStops = new Set<string>();
    connections.forEach((conn: any) => {
      if (FromStop) {
        
        if (conn.from_stop_id === FromStop && conn.to_stop_id) {
          toStops.add(conn.to_stop_id);
        }
        
        if (conn.direction_type === "bidirectional" && conn.to_stop_id === FromStop && conn.from_stop_id) {
          toStops.add(conn.from_stop_id);
        }
      } else {
        
        if (conn.to_stop_id) toStops.add(conn.to_stop_id);
        
        if (conn.direction_type === "bidirectional" && conn.from_stop_id) {
          toStops.add(conn.from_stop_id);
        }
      }
    });

    if (ToStop) {
      toStops.add(ToStop);
    }

    return Array.from(toStops).sort().map(stopId => ({
      label: stopId,
      value: stopId
    }));
  }, [pathwayDataComplete?.connections, PathwayTypes, FromStop, ToStop]);

  const availablePathwayTypes = useMemo(() => {
    if (!pathwayDataComplete?.connections) return [];

    let connections = pathwayDataComplete.connections;

    if (FromStop) connections = connections.filter((p: any) => p.from_stop_id === FromStop);
    if (ToStop) connections = connections.filter((p: any) => p.to_stop_id === ToStop);

    const types = new Set<string>();
    connections.forEach((conn: any) => {
      if (conn.pathway_mode_name) {
        types.add(conn.pathway_mode_name);
      }
    });

    return pathwayDataComplete.pathwayModesAvailable?.filter((mode: any) =>
      types.has(mode.value)
    ) || [];
  }, [pathwayDataComplete?.connections, pathwayDataComplete?.pathwayModesAvailable, FromStop, ToStop]);

  const filteredConnections = useMemo(() => {
    if (!pathwayDataComplete?.connections) return [];
    let connections = pathwayDataComplete.connections;

    if (FromStop || ToStop) {
      connections = connections.filter((p: any) => {
        let matchesFrom = !FromStop;
        let matchesTo = !ToStop;

        if (FromStop) {
          
          matchesFrom = p.from_stop_id === FromStop ||
            (p.direction_type === "bidirectional" && p.to_stop_id === FromStop);
        }

        if (ToStop) {
          
          matchesTo = p.to_stop_id === ToStop ||
            (p.direction_type === "bidirectional" && p.from_stop_id === ToStop);
        }

        return matchesFrom && matchesTo;
      });
    }

    if (PathwayTypes && PathwayTypes.length > 0) {
      connections = connections.filter((p: any) => PathwayTypes.includes(p.pathway_mode_name));
    }

    return connections;
  }, [pathwayDataComplete?.connections, FromStop, ToStop, PathwayTypes]);

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
      <div className="relative h-[70vh] w-full border p-1 rounded-md overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading pathways data...</div>
      </div>
    );
  }

  if (!pathwayData || !pathwayData.stops || pathwayData.stops.length === 0) {
    return (
      <div className="relative h-[70vh] w-full border p-1 rounded-md overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">No pathways data available for this station.</div>
      </div>
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

  const popupElement = clickData ? (
    <>
      {localClickInfo?.layer?.id === "TableView" && (
        <MapClickPopup
          title={clickData.stop_name}
          data={clickData}
          onClose={() => handleSetClickInfo(undefined)}
          borderColor={getPopupBorderColor()}
          columns={["stop_id", "stop_lon", "stop_lat", "status", "location_type_name", "wheelchair_status"]}
          columnNames={["Stop Id", "Stop Lon", "Stop Lat", "Status", "Location Type", "Wheelchair Boarding"]}
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={handleGoToLocation}
              className="w-full bg-primary/10 dark:bg-primary/20 border-primary/50 hover:bg-primary/20 dark:hover:bg-primary/30"
            >
              <BiReset className="mr-2 h-5" />
              Zoom to Stop
            </Button>
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleGoToLocation}
              className="w-full bg-primary/10 dark:bg-primary/20 border-primary/50 hover:bg-primary/20 dark:hover:bg-primary/30"
            >
              <BiReset className="mr-2 h-5" />
              Zoom to Pathway
            </Button>
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
    </div>
  );
}
