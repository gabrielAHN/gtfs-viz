import { useCallback, useEffect, useMemo, useState } from "react";
import DeckglMap from "@/components/maps/DeckglMap.lazy";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { createPointOutline } from "@/components/maps/MapOutlineHelpers";
import { useThemeContext } from "@/context/theme.client";
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors";
import { safeHexToRgb, withAlpha } from "@/components/colorUtil";

const DEFAULT_VIEW_STATE = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 3,
  pitch: 0,
  bearing: 0,
};

const DEFAULT_BOUND_BOX = [
  [-180, -85],
  [180, 85],
];

const SELECTED_ROUTE_GLOW = [250, 204, 21];
const selectionSeparatorColor = (theme: string) =>
  theme === "dark" ? [255, 255, 255] : [15, 23, 42];
const routeTypeLineColor = (route: any) => safeHexToRgb(getRouteTypeColor(route.route_type_name));

function MapSection({
  routes,
  shapeRows,
  stopRows,
  viewState,
  setViewState,
  BoundBox,
  setBoundBox,
  ClickInfo,
  setClickInfo,
}: any) {
  const { theme } = useThemeContext();
  const [HoverInfo, setHoverInfo] = useState<any>();

  const routeLookup = useMemo(() => {
    const lookup = new Map<string, any>();
    (Array.isArray(routes) ? routes : []).forEach((route: any) =>
      lookup.set(String(route.route_id), route),
    );
    return lookup;
  }, [routes]);

  const paths = useMemo(() => {
    const groups = new Map<string, any>();
    (Array.isArray(shapeRows) ? shapeRows : []).forEach((row: any) => {
      if (row.shape_pt_lon == null || row.shape_pt_lat == null) return;
      const key = `${row.route_id}::${row.shape_id || "shape"}`;
      const route = routeLookup.get(String(row.route_id)) || row;
      if (!groups.has(key)) {
        groups.set(key, {
          route_id: row.route_id,
          route_name: route.route_name || row.route_name,
          route_color_hex: route.route_color_hex || row.route_color_hex,
          route_text_color_hex: route.route_text_color_hex || row.route_text_color_hex,
          route_type_name: route.route_type_name || row.route_type_name,
          shape_id: row.shape_id,
          points: [],
        });
      }
      groups.get(key).points.push({
        sequence: Number(row.shape_pt_sequence || 0),
        position: [Number(row.shape_pt_lon), Number(row.shape_pt_lat)],
      });
    });
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        path: group.points
          .sort((a: any, b: any) => a.sequence - b.sequence)
          .map((point: any) => point.position),
      }))
      .filter((group) => group.path.length > 1);
  }, [shapeRows, routeLookup]);

  const fallbackStops = useMemo(() => {
    return (Array.isArray(stopRows) ? stopRows : [])
      .filter((row: any) => routeLookup.has(String(row.route_id)))
      .map((row: any) => ({
        ...row,
        ...routeLookup.get(String(row.route_id)),
      }))
      .filter((row: any) => row.stop_lon != null && row.stop_lat != null);
  }, [stopRows, routeLookup]);

  const stopPaths = useMemo(() => {
    const groups = new Map<string, any>();
    fallbackStops.forEach((row: any) => {
      const routeId = String(row.route_id);
      if (!groups.has(routeId)) {
        groups.set(routeId, {
          route_id: row.route_id,
          route_name: row.route_name,
          route_color_hex: row.route_color_hex,
          route_text_color_hex: row.route_text_color_hex,
          route_type_name: row.route_type_name,
          points: [],
        });
      }
      groups.get(routeId).points.push({
        sequence: Number(row.stop_sequence || 0),
        position: [Number(row.stop_lon), Number(row.stop_lat)],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        path: group.points
          .sort((a: any, b: any) => a.sequence - b.sequence)
          .map((point: any) => point.position),
      }))
      .filter((group) => group.path.length > 1);
  }, [fallbackStops]);

  // Bounds set by parent via fetchRouteMapBounds macro
  useEffect(() => {
    if (BoundBox && viewState) return;
    if (!BoundBox) setBoundBox(DEFAULT_BOUND_BOX);
    if (!viewState) setViewState(DEFAULT_VIEW_STATE);
  }, [BoundBox, viewState, setBoundBox, setViewState]);

  const handleClick = useCallback(
    (event: any) => {
      if (event.object) {
        const route = routeLookup.get(String(event.object.route_id)) || event.object;
        setClickInfo(route);
      } else {
        setClickInfo(undefined);
      }
    },
    [routeLookup, setClickInfo],
  );

  const MapLayers = useMemo(() => {
    const layers: any[] = [];
    const linePaths = paths.length > 0 ? paths : stopPaths;
    const clickData = ClickInfo?.object || ClickInfo;
    const hoverData = HoverInfo?.object || HoverInfo;
    const selectedRouteId = clickData?.route_id ? String(clickData.route_id) : undefined;
    const hoverRouteId = hoverData?.route_id ? String(hoverData.route_id) : undefined;
    const activeRouteId = selectedRouteId || hoverRouteId;

    if (linePaths.length > 0) {
      const selectedPaths = selectedRouteId
        ? linePaths.filter((row: any) => String(row.route_id) === selectedRouteId)
        : [];
      const hoverPaths =
        hoverRouteId && hoverRouteId !== selectedRouteId
          ? linePaths.filter((row: any) => String(row.route_id) === hoverRouteId)
          : [];

      layers.push(
        new PathLayer({
          id: paths.length > 0 ? "routes-shape-view" : "routes-stop-path-view",
          data: linePaths,
          getPath: (row: any) => row.path,
          getColor: (row: any) => {
            const routeId = String(row.route_id);
            const color = routeTypeLineColor(row);
            if (!activeRouteId || activeRouteId === routeId) return withAlpha(color, 255);
            return withAlpha(color, selectedRouteId ? 65 : 105);
          },
          getWidth: (row: any) => {
            const routeId = String(row.route_id);
            if (selectedRouteId === routeId) return 7;
            if (hoverRouteId === routeId) return 6;
            return activeRouteId ? 3 : 4;
          },
          widthUnits: "pixels",
          pickable: true,
          capRounded: true,
          jointRounded: true,
        }),
      );

      if (hoverPaths.length > 0) {
        layers.push(
          new PathLayer({
            id: "routes-hover-outline",
            data: hoverPaths,
            getPath: (row: any) => row.path,
            getColor: withAlpha(SELECTED_ROUTE_GLOW, 115),
            getWidth: 11,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new PathLayer({
            id: "routes-hover-line",
            data: hoverPaths,
            getPath: (row: any) => row.path,
            getColor: (row: any) => withAlpha(routeTypeLineColor(row), 255),
            getWidth: 6,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
        );
      }

      if (selectedPaths.length > 0) {
        layers.push(
          new PathLayer({
            id: "routes-selected-glow",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            getColor: withAlpha(SELECTED_ROUTE_GLOW, 90),
            getWidth: 24,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new PathLayer({
            id: "routes-selected-separator",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            getColor: withAlpha(selectionSeparatorColor(theme), 230),
            getWidth: 13,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
          new PathLayer({
            id: "routes-selected-line",
            data: selectedPaths,
            getPath: (row: any) => row.path,
            getColor: (row: any) => withAlpha(routeTypeLineColor(row), 255),
            getWidth: 7,
            widthUnits: "pixels",
            pickable: false,
            capRounded: true,
            jointRounded: true,
          }),
        );
      }
    } else if (fallbackStops.length > 0) {
      layers.push(
        new ScatterplotLayer({
          id: "routes-stop-view",
          data: fallbackStops,
          getFillColor: (row: any) => routeTypeLineColor(row),
          getPosition: (row: any) => [Number(row.stop_lon), Number(row.stop_lat)],
          pickable: true,
          getLineWidth: 0.025,
          stroked: true,
          radiusUnits: "pixels",
          radiusMinPixels: 4,
        }),
      );
    }

    if (
      hoverData?.route_id &&
      linePaths.length === 0 &&
      selectedRouteId !== String(hoverData.route_id)
    ) {
      const hoverOutline = createPointOutline({
        id: "hover-route-point",
        data: [hoverData],
        theme,
        state: "hover",
      });
      layers.push(hoverOutline);
    }

    return layers;
  }, [paths, stopPaths, fallbackStops, ClickInfo, HoverInfo, theme]);

  return (
    <DeckglMap
      MinZoom={4}
      dragRotate={false}
      maxPitch={0}
      MapLayers={MapLayers}
      BoundBox={BoundBox || DEFAULT_BOUND_BOX}
      viewState={viewState || DEFAULT_VIEW_STATE}
      setClickInfo={handleClick}
      setViewState={setViewState}
      setHoverInfo={setHoverInfo}
    />
  );
}

export default MapSection;
