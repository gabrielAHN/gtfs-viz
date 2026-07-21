import { useCallback, useEffect, useRef } from "react";

import DeckGL from "@deck.gl/react";
import maplibregl from "maplibre-gl";
import { useThemeContext } from "@/context/theme.client";

// Direct internal import avoids the barrel `export const Map` that shadows JS built-in Map
import MapGLComponent from "react-map-gl/dist/esm/components/map";

const MAP_STYLES = {
  light:
    "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export default function DeckglMap({
  viewState,
  setViewState,
  MapLayers,
  BoundBox,
  BoundPadding = 0.5,
  MinZoom,
  dragRotate,
  minPitch = 0,
  maxPitch = 60,
  setClickInfo,
  setHoverInfo,
}: any) {
  const { theme } = useThemeContext();

  const onRestrictStateChange = useCallback(
    (newViewState) => {
      if (!BoundBox) {
        setViewState(newViewState);
        return;
      }

      const padding = BoundPadding;

      const minLon = BoundBox[0][0] - padding;
      const minLat = BoundBox[0][1] - padding;
      const maxLon = BoundBox[1][0] + padding;
      const maxLat = BoundBox[1][1] + padding;

      const constrainedLon = Math.min(
        maxLon,
        Math.max(minLon, newViewState.longitude),
      );
      const constrainedLat = Math.min(
        maxLat,
        Math.max(minLat, newViewState.latitude),
      );

      setViewState({
        ...newViewState,
        longitude: constrainedLon,
        latitude: constrainedLat,
      });
    },
    [BoundBox, BoundPadding, setViewState],
  );

  const getCursor = useCallback(({ isHovering, isDragging }) => {
    if (isDragging) return "grabbing";
    if (isHovering) return "pointer";
    return "grab";
  }, []);

  const getTooltip = useCallback(() => {
    return null;
  }, []);

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={({ viewState }) => onRestrictStateChange(viewState)}
      controller={{
        ...(MinZoom !== undefined && { minZoom: MinZoom }),
        maxZoom: 20,
        ...(minPitch !== undefined && { minPitch }),
        ...(maxPitch !== undefined && { maxPitch }),
        scrollZoom: true,
        dragPan: true,
        dragRotate: dragRotate,
        doubleClickZoom: true,
        touchZoom: true,
        touchRotate: dragRotate,
        keyboard: true,
      }}
      layers={MapLayers}
      onClick={(event) => {
        if (setClickInfo) {
          setClickInfo(event);
        }
      }}
      onHover={(event) => {
        if (setHoverInfo) {
          setHoverInfo(event);
        }
      }}
      getCursor={getCursor}
      getTooltip={getTooltip}
      pickingRadius={5}
    >
      <MapGLComponent
        mapLib={maplibregl}
        mapStyle={MAP_STYLES[theme]}
        reuseMaps={true}
        attributionControl={false}
      />
    </DeckGL>
  );
}
