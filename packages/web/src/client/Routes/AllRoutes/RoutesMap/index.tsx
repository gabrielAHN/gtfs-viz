import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MapContainer from "@/components/maps/MapContainer";
import MapLegend from "@/components/maps/MapLegend";
import MapClickPopup from "@/components/maps/MapClickPopup";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@tanstack/react-router";
import { BiPencil, BiReset, BiRightArrow, BiTrash } from "react-icons/bi";
import { EditIndicator } from "@/components/ui/EditIndicator";
import MapSection from "./Components/MapSection";
import { getRouteTypeColor, getRouteTypeLegendItems } from "@/client/Routes/routeTypeColors";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchRouteMapBounds, fetchFitZoom } from "@/lib/duckdb/DataFetching/fetchRouteData";

function RoutesMap({
  routes,
  shapeRows,
  stopRows,
  routeIds,
  ClickInfo,
  setClickInfo,
  externalViewState,
  onEdit,
  onDelete,
  isDeleting,
}: any) {
  const duckDB = useDuckDB();
  const conn = duckDB?.conn;
  const hasStopTimes = duckDB?.hasStopTimes ?? false;
  const route = ClickInfo;

  // Fetch bounds from SQL — no large array processing in JS
  const { data: allRoutesFit } = useQuery({
    queryKey: ["fetchRouteMapBounds", routeIds],
    queryFn: () => fetchRouteMapBounds(conn, routeIds),
    enabled: !!conn && routeIds.length > 0,
    staleTime: Infinity,
  });

  const { data: selectedRouteFit } = useQuery({
    queryKey: ["fetchRouteMapBounds", route?.route_id ? [String(route.route_id)] : []],
    queryFn: () => fetchRouteMapBounds(conn, [String(route.route_id)]),
    enabled: !!conn && !!route?.route_id,
    staleTime: Infinity,
  });

  const initialView = externalViewState || allRoutesFit?.viewState;
  const initialBounds = allRoutesFit?.boundBox;

  const [viewState, setViewState] = useState<any>(initialView);
  const [BoundBox, setBoundBox] = useState<any>(initialBounds);
  const appliedFitRef = useRef<string>("");

  // Fit view when bounds arrive or route IDs change
  useEffect(() => {
    if (externalViewState) {
      setViewState(externalViewState);
      return;
    }
    if (!allRoutesFit) return;
    const key = routeIds.join(",");
    if (appliedFitRef.current === key && viewState) return;
    appliedFitRef.current = key;
    setViewState({ ...allRoutesFit.viewState, transitionDuration: 0 });
    setBoundBox(allRoutesFit.boundBox);
  }, [allRoutesFit, externalViewState, routeIds]);

  const mapReady = !!viewState;

  const legendItems = useMemo(() => getRouteTypeLegendItems(routes), [routes]);

  // Zoom to route via DuckDB macro, with shapeRows min/max + fit_zoom for new routes
  const zoomToRoute = useCallback(async (routeId: string) => {
    if (!conn) return;
    // Try macro first (existing routes with shapes/stops in DB)
    const macroBounds = await fetchRouteMapBounds(conn, [routeId]).catch(() => null);
    if (macroBounds) {
      setViewState((prev: any) => ({ ...prev, ...macroBounds.viewState, transitionDuration: 300 }));
      setBoundBox(macroBounds.boundBox);
      return;
    }
    // New routes: get min/max from shapeRows, zoom via DuckDB fit_zoom
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    let count = 0;
    for (const r of (Array.isArray(shapeRows) ? shapeRows : [])) {
      if (String(r.route_id) !== routeId || r.shape_pt_lat == null || r.shape_pt_lon == null) continue;
      const lat = Number(r.shape_pt_lat), lon = Number(r.shape_pt_lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      count++;
    }
    if (count === 0) return;
    try {
      const zoom = await fetchFitZoom(conn, minLon, maxLon, minLat, maxLat);
      setViewState((prev: any) => ({
        ...prev,
        longitude: (minLon + maxLon) / 2,
        latitude: (minLat + maxLat) / 2,
        zoom,
        transitionDuration: 300,
      }));
      setBoundBox([[minLon, minLat], [maxLon, maxLat]]);
    } catch {}
  }, [conn, shapeRows]);

  // Auto-zoom on selection
  const lastZoomedRouteRef = useRef<string>("");
  useEffect(() => {
    if (!route?.route_id || !conn) return;
    const id = String(route.route_id);
    if (lastZoomedRouteRef.current === id) return;
    lastZoomedRouteRef.current = id;
    zoomToRoute(id);
  }, [route?.route_id, conn, zoomToRoute]);

  useEffect(() => {
    if (!route) lastZoomedRouteRef.current = "";
  }, [route]);

  const handleGoToRoute = useCallback(() => {
    if (!route?.route_id) return;
    zoomToRoute(String(route.route_id));
  }, [route?.route_id, zoomToRoute]);

  if (!routes || routes.length === 0) {
    return (
      <div className="relative h-[74vh] w-full border rounded overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">No route data available.</div>
      </div>
    );
  }

  return (
    <MapContainer
      instructionText="Click a route to view details"
      showLegend={legendItems.length > 0}
      legendContent={
        <MapLegend title="Routes" items={legendItems} collapsible={true} defaultExpanded={true} />
      }
      clickPopup={
        route ? (
          <MapClickPopup
            title={
              <div className="flex min-w-0 items-center gap-2">
                <EditIndicator status={route.status} className="h-5 w-5" />
                <span
                  className="h-3 w-8 rounded-sm border shrink-0"
                  style={{ backgroundColor: route.route_color_hex || getRouteTypeColor(route.route_type_name) }}
                />
                <span className="truncate">{route.route_name || route.route_id}</span>
              </div>
            }
            data={route}
            onClose={() => setClickInfo(undefined)}
            borderColor={route.route_color_hex || getRouteTypeColor(route.route_type_name)}
            columns={[
              "route_id",
              "route_name",
              "route_type_name",
              ...(hasStopTimes ? ["stop_count", "station_count"] : []),
              "trip_count",
            ]}
            columnNames={[
              "Route ID",
              "Route Name",
              "Type",
              ...(hasStopTimes ? ["Stops", "Stations"] : []),
              "Trips",
            ]}
            actions={
              <TooltipProvider delayDuration={300}>
                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGoToRoute}
                    className="w-full bg-primary/10 dark:bg-primary/20 border-primary/50 hover:bg-primary/20 dark:hover:bg-primary/30"
                  >
                    <BiReset className="mr-2 h-5" />
                    Zoom to Route
                  </Button>
                  <Button asChild size="sm" variant="default" className="w-full">
                    <Link to="/routes/info" search={{ selectedRouteId: route.route_id }}>
                      <BiRightArrow className="mr-2 h-4 w-4" />
                      Select Route
                    </Link>
                  </Button>
                  <div className="flex gap-2">
                    {onEdit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => onEdit(route)}
                          >
                            <BiPencil className="mr-2 h-5 w-5" />
                            Edit
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            disabled={isDeleting}
                            onClick={() => onDelete(route)}
                          >
                            <BiTrash className="mr-2 h-5 w-5" />
                            {isDeleting ? "Deleting..." : "Delete"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </TooltipProvider>
            }
          />
        ) : undefined
      }
    >
      {mapReady ? (
        <MapSection
          routes={routes}
          shapeRows={shapeRows}
          stopRows={stopRows}
          ClickInfo={ClickInfo}
          setClickInfo={setClickInfo}
          viewState={viewState}
          setViewState={setViewState}
          BoundBox={BoundBox}
          setBoundBox={setBoundBox}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="rounded-md border bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
            Loading routes...
          </div>
        </div>
      )}
    </MapContainer>
  );
}

export default RoutesMap;
