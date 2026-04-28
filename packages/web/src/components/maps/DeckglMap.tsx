import { useCallback } from "react";

import DeckGL from "@deck.gl/react";
import maplibregl from "maplibre-gl";

import { Map } from "react-map-gl/maplibre";
import { useThemeContext } from "@/context/theme.client";

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
  MinZoom,
  dragRotate,
  minPitch = 0,
  maxPitch = 60,
  setClickInfo,
  setHoverInfo,
}) {
  const { theme } = useThemeContext();

  const onRestrictStateChange = useCallback(
    (newViewState) => {
      if (!BoundBox) {
        setViewState(newViewState);
        return;
      }

      const padding = 0.5; 

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
    [BoundBox, setViewState],
  );

  const getCursor = useCallback(({ isHovering, isDragging }) => {
    if (isDragging) return "grabbing";
    if (isHovering) return "pointer";
    return "grab";
  }, []);

  const getTooltip = useCallback(({ object }) => {
    
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
      <Map
        mapLib={maplibregl}
        mapStyle={MAP_STYLES[theme]}
        reuseMaps={true}
        attributionControl={false}
      />
    </DeckGL>
  );
}
