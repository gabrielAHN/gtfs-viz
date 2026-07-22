import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { isCliSession } from "@/lib/cli/isCliSession";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/components/ui/tab-header";
import { BiMap, BiTable } from "react-icons/bi";
import RoutesHeader from "@/client/Routes/AllRoutes/Header";
import RoutesMap from "@/client/Routes/AllRoutes/RoutesMap";
import PageFooter from "@/components/PageFooter";
import EntityForm from "@/components/forms/EntityForm";
import { buildRouteNameOptions, routeMatchesNameFilter } from "@/client/Routes/routeFilters";
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors";
import {
  fetchServiceRouteShapesData,
  fetchServiceRouteStopsData,
  fetchServiceRoutesData,
} from "@/lib/duckdb/DataFetching/fetchRouteData";
import { parseRouteLineValue } from "@/components/forms/RouteLineInput/routeLine";
import { fetchStationsData } from "@/lib/duckdb/DataFetching/fetchGTFSData";
import { mutationDeleteRouteFn } from "@/lib/duckdb/DataEditing/editRoutes";
import { refreshRoutesTables } from "@/lib/extensions";

type RoutesMapSearchParams = {
  routeId?: string;
  routeName?: string;
  routeType?: string[];
  selectedRouteId?: string;
  mapFocus?: string;
};

export const Route = createFileRoute("/_layout/routes/map")({
  component: RoutesMapPage,
  validateSearch: (search: Record<string, unknown>): RoutesMapSearchParams => {
    return {
      routeId: search.routeId as string | undefined,
      routeName: search.routeName as string | undefined,
      routeType: Array.isArray(search.routeType)
        ? (search.routeType as string[])
        : search.routeType
          ? [search.routeType as string]
          : undefined,
      selectedRouteId: search.selectedRouteId as string | undefined,
      mapFocus: search.mapFocus as string | undefined,
    };
  },
  beforeLoad: ({ search }) => {
    if (isCliSession()) return;
    const hasShapes = localStorage.getItem("gtfs_has_shapes") === "true";
    if (!hasShapes) {
      throw redirect({
        to: "/routes/table",
        search: {
          routeId: (search as any).routeId || (search as any).selectedRouteId,
          routeName: (search as any).routeName,
          routeType: (search as any).routeType,
          selectedRouteId: (search as any).selectedRouteId,
        },
      });
    }
  },
});

const ToggleTabs = [
  { value: "map", label: "Map", icon: <BiMap />, path: "/routes/map" },
  { value: "table", label: "Table", icon: <BiTable />, path: "/routes/table" },
];

function RoutesMapPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { conn } = useDuckDB() ?? {};
  const queryClient = useQueryClient();

  const [ClickInfo, setClickInfo] = useState<any>();
  const [Open, setOpen] = useState<{ formType: string | null; state: boolean }>({
    formType: null,
    state: false,
  });
  const [viewState, setViewState] = useState<any>();
  const clearingSelectionRef = useRef(false);

  const routeId = search.routeId;
  const routeName = search.routeName;
  const routeType = search.routeType;

  useEffect(() => {
    if (!search.mapFocus) return;
    const [latitude, longitude, zoom] = search.mapFocus
      .split(",")
      .map((value) => Number(value.trim()));
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(zoom)) {
      setViewState({ latitude, longitude, zoom });
    }
  }, [search.mapFocus]);

  const { data: allRoutes = [], isLoading: allRoutesLoading } = useQuery({
    queryKey: ["fetchRoutesData", "RoutesTable"],
    queryFn: async () => {
      return fetchServiceRoutesData(conn);
    },
    enabled: !!conn,
    staleTime: Infinity,
  });

  const filteredData = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : [];
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId);
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName));
    if (routeType && routeType.length > 0) {
      filtered = filtered.filter((r: any) => routeType.includes(r.route_type_name));
    }
    return filtered;
  }, [allRoutes, routeId, routeName, routeType]);

  const routeIds = useMemo(
    () => filteredData.map((route: any) => String(route.route_id)),
    [filteredData],
  );

  const allRouteIds = useMemo(
    () => allRoutes.map((route: any) => String(route.route_id)).filter(Boolean),
    [allRoutes],
  );

  const shouldFetchShapes = routeIds.length > 0;

  const { data: shapeRows = [], isLoading: shapeRowsLoading, isFetching: shapeRowsFetching } = useQuery({
    queryKey: ["fetchRouteShapes", routeIds, shouldFetchShapes],
    queryFn: async () => {
      return fetchServiceRouteShapesData(conn, routeIds, { routeTypes: routeType });
    },
    enabled: !!conn && shouldFetchShapes,
    staleTime: Infinity,
  });

  const { data: stopRows = [], isLoading: stopRowsLoading, isFetching: stopRowsFetching } = useQuery({
    queryKey: ["fetchRouteStops", routeIds],
    queryFn: async () => {
      return fetchServiceRouteStopsData(conn, routeIds);
    },
    enabled: !!conn && routeIds.length > 0,
    staleTime: Infinity,
  });

  // Form data — single route shapes for edit, stops/stations for map context
  const formOpen = Open.state;
  const editRouteId = ClickInfo?.route_id;

  const { data: editRouteShapes = [] } = useQuery({
    queryKey: ["fetchRouteShapes", editRouteId, "route-edit"],
    queryFn: async () => fetchServiceRouteShapesData(conn, [editRouteId]),
    enabled: !!conn && !!editRouteId,
    staleTime: Infinity,
  });

  const { data: allStops = [] } = useQuery({
    queryKey: ["fetchStopsData", "StopsTable", "route-form"],
    queryFn: () => fetchStationsData({ conn, table: "StopsTable" }),
    enabled: !!conn && formOpen,
    staleTime: Infinity,
  });

  const { data: allStations = [] } = useQuery({
    queryKey: ["fetchStationsData", "StationsTable", "route-form"],
    queryFn: () => fetchStationsData({ conn, table: "StationsTable" }),
    enabled: !!conn && formOpen,
    staleTime: Infinity,
  });

  const drawnShapeRows = useMemo(() => {
    return filteredData.flatMap((route: any) => {
      const points = parseRouteLineValue(route.shape_points_json);
      return points.map((point, index) => ({
        route_id: route.route_id,
        route_name: route.route_name,
        route_color_hex: route.route_color_hex,
        route_text_color_hex: route.route_text_color_hex,
        route_type_name: route.route_type_name,
        shape_id: `drawn_${route.route_id}`,
        shape_pt_lat: point.lat,
        shape_pt_lon: point.lon,
        shape_pt_sequence: index,
        shape_dist_traveled: null,
      }));
    });
  }, [filteredData]);

  const mapShapeRows = useMemo(() => {
    const drawnRouteIds = new Set(drawnShapeRows.map((row: any) => String(row.route_id)));
    return shapeRows
      .filter((row: any) => !drawnRouteIds.has(String(row.route_id)))
      .concat(drawnShapeRows);
  }, [drawnShapeRows, shapeRows]);

  const hasShapeGeometry = useMemo(() => {
    return mapShapeRows.some((row: any) => {
      return Number.isFinite(Number(row.shape_pt_lon)) && Number.isFinite(Number(row.shape_pt_lat));
    });
  }, [mapShapeRows]);

  const hasStopGeometry = useMemo(() => {
    return stopRows.some((row: any) => {
      return Number.isFinite(Number(row.stop_lon)) && Number.isFinite(Number(row.stop_lat));
    });
  }, [stopRows]);

  const routeGeometryLoading = shouldFetchShapes && (shapeRowsLoading || stopRowsLoading);
  const routeGeometryFetching = shouldFetchShapes && (shapeRowsFetching || stopRowsFetching);
  const routeMapReady = filteredData.length === 0 || hasShapeGeometry || hasStopGeometry;

  // Cross-filtered options: each dropdown filters by the OTHER active filters
  const routesForIdFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : [];
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName));
    if (routeType && routeType.length > 0) filtered = filtered.filter((r: any) => routeType.includes(r.route_type_name));
    return filtered;
  }, [allRoutes, routeName, routeType]);

  const routesForNameFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : [];
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId);
    if (routeType && routeType.length > 0) filtered = filtered.filter((r: any) => routeType.includes(r.route_type_name));
    return filtered;
  }, [allRoutes, routeId, routeType]);

  const routesForTypeFilter = useMemo(() => {
    let filtered = Array.isArray(allRoutes) ? allRoutes : [];
    if (routeId) filtered = filtered.filter((r: any) => r.route_id === routeId);
    if (routeName) filtered = filtered.filter((r: any) => routeMatchesNameFilter(r, routeName));
    return filtered;
  }, [allRoutes, routeId, routeName]);

  const availableRouteIds = useMemo(() => {
    return routesForIdFilter
      .filter((r: any) => r.route_id)
      .map((r: any) => ({
        label: String(r.route_id),
        value: String(r.route_id),
        color: r.route_color_hex || getRouteTypeColor(r.route_type_name),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [routesForIdFilter]);

  const availableRouteNames = useMemo(() => buildRouteNameOptions(routesForNameFilter), [routesForNameFilter]);

  const availableRouteTypes = useMemo(() => {
    return Array.from(new Set(routesForTypeFilter.map((route: any) => route.route_type_name).filter(Boolean)))
      .sort()
      .map((type) => ({ label: String(type), value: String(type), color: getRouteTypeColor(String(type)) }));
  }, [routesForTypeFilter]);

  const routeFormData = useMemo(
    () => [...editRouteShapes, ...allStops, ...allStations],
    [editRouteShapes, allStations, allStops],
  );

  useEffect(() => {
    if (!search.selectedRouteId) {
      clearingSelectionRef.current = false;
      if (ClickInfo) setClickInfo(undefined);
      return;
    }

    if (clearingSelectionRef.current) return;

    const selected = filteredData.find(
      (route: any) => String(route.route_id) === String(search.selectedRouteId),
    );

    if (!selected) {
      if (ClickInfo) setClickInfo(undefined);
      return;
    }

    if (
      String(ClickInfo?.route_id) !== String(selected.route_id) ||
      ClickInfo?.status !== selected.status ||
      ClickInfo?.route_name !== selected.route_name ||
      ClickInfo?.route_color_hex !== selected.route_color_hex
    ) {
      setClickInfo(selected);
    }
  }, [search.selectedRouteId, filteredData, ClickInfo]);

  const deleteMutation = useMutation({
    mutationFn: async (route: any) => {
      return mutationDeleteRouteFn({ conn, SelectRoute: route });
    },
    onSuccess: async () => {
      await refreshRoutesTables(conn);
      ["fetchRoutesData", "fetchRouteShapes", "fetchRouteStops", "routeChips"].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      );
      setClickInfo(undefined);
      updateSearch({ selectedRouteId: undefined });
    },
  });

  const hasActiveFilters = Boolean(routeId || routeName || (routeType && routeType.length > 0));

  const updateSearch = (next: Partial<RoutesMapSearchParams>) => {
    navigate({
      to: "/routes/map",
      search: (prev) => ({ ...prev, ...next }),
      resetScroll: false,
    });
  };

  const clearFilters = () => {
    navigate({
      to: "/routes/map",
      search: (prev) => ({
        ...prev,
        routeId: undefined,
        routeName: undefined,
        routeType: undefined,
        selectedRouteId: undefined,
      }),
      resetScroll: false,
    });
    setClickInfo(undefined);
  };

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4">
        <TabHeader
          tabs={ToggleTabs}
          searchParams={(prev) => ({
            routeId: prev.routeId,
            routeName: prev.routeName,
            routeType: prev.routeType,
            selectedRouteId: prev.selectedRouteId,
          })}
        />
        <RoutesHeader
          setOpen={setOpen}
          RouteIdData={availableRouteIds}
          RouteIdDropdown={routeId || ""}
          setRouteIdDropdown={(value) => updateSearch({ routeId: value || undefined })}
          RouteNameData={availableRouteNames}
          RouteNameDropDown={routeName || ""}
          setRouteNameDropDown={(value) => updateSearch({ routeName: value || undefined })}
          RouteTypeData={availableRouteTypes}
          RouteTypeDropDown={routeType || []}
          setRouteTypeDropDown={(values) =>
            updateSearch({ routeType: values.length ? values : undefined })
          }
          onResetFilters={clearFilters}
          isResetDisabled={!hasActiveFilters}
        />
        {allRoutesLoading || routeGeometryLoading ? (
          <div className="relative h-[74vh] w-full overflow-hidden flex items-center justify-center">
            <Skeleton className="h-full w-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-sm border bg-background/90 px-3 py-2 text-sm text-muted-foreground shadow-sm">
                Loading routes...
              </div>
            </div>
          </div>
        ) : !routeMapReady ? (
          <div className="relative h-[74vh] w-full border rounded overflow-hidden flex items-center justify-center">
            <div className="text-sm text-muted-foreground">
              No route geometry available for the current filters.
            </div>
          </div>
        ) : (
          <>
            <EntityForm
              Data={routeFormData}
              OpenValue={Open}
              setOpenValue={setOpen}
              ClickInfo={ClickInfo}
              setClickInfo={setClickInfo}
              type="route"
            />
            <div className="relative h-[74vh] w-full overflow-hidden">
              {routeGeometryFetching && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                  <div className="rounded-md border bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                    Loading routes...
                  </div>
                </div>
              )}
              <RoutesMap
                routes={filteredData}
                routeIds={routeIds}
                shapeRows={mapShapeRows}
                stopRows={stopRows}
                ClickInfo={ClickInfo}
                setClickInfo={(route: any) => {
                  clearingSelectionRef.current = !route;
                  setClickInfo(route);
                  if (route) {
                    updateSearch({ selectedRouteId: route.route_id });
                  } else {
                    updateSearch({ selectedRouteId: undefined });
                  }
                }}
                externalViewState={viewState}
                onEdit={(route: any) => {
                  setClickInfo(route);
                  setOpen({ formType: "edit", state: true });
                }}
                onDelete={(route: any) => deleteMutation.mutate(route)}
                isDeleting={deleteMutation.isPending}
              />
            </div>
          </>
        )}
        <PageFooter />
      </div>
    </div>
  );
}
