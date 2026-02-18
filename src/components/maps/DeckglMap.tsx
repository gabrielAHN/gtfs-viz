import { useCallback } from "react";

import DeckGL from "@deck.gl/react";
import maplibregl from 'maplibre-gl';

import { Map } from "react-map-gl/maplibre";
import { useThemeContext } from "@/context/combinedContext";


const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export default function DeckglMap({
  viewState,
  setViewState,
  MapLayers,
  BoundBox,
  MinZoom,
  dragRotate,
  setClickInfo
}) {
  const { theme } = useThemeContext();

  const onRestrictStateChange = useCallback(
    (viewState) => {
      if (!BoundBox) {
        setViewState(viewState);
        return;
      }

      setViewState({
        ...viewState,
        longitude: Math.min(
          BoundBox[1][0],
          Math.max(BoundBox[0][0], viewState.longitude)
        ),
        latitude: Math.min(
          BoundBox[1][1],
          Math.max(BoundBox[0][1], viewState.latitude)
        ),
      });
    },
    [BoundBox]
  );

  return (
    <DeckGL
      initialViewState={viewState}
      onViewStateChange={({ viewState }) => onRestrictStateChange(viewState)}
      controller={{
        minZoom: MinZoom,
        maxZoom: 20,
        dragRotate: dragRotate,
      }}
      layers={MapLayers}
      onClick={(event) => {
          setClickInfo(event);
      }}
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
