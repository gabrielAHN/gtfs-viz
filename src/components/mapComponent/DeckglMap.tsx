import { useCallback } from "react";
import { MapViewState } from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json"

function DeckglMap({
  viewState,
  setViewState,
  setClickInfo,
  MapLayers,
  BoundBox,
  MinZoom,
  dragRotate,
}) {
  const onRestrictStateChange = useCallback(
    (viewState: MapViewState) => {
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
        if (event.object) {
          setClickInfo(event);
        } else {
          setClickInfo(null);
        }
      }}
    >
      <Map mapStyle={MAP_STYLE} reuseMaps />
    </DeckGL>
  );
}
export default DeckglMap;
