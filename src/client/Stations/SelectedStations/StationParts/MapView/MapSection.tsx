import { useEffect } from "react";

import { ScatterplotLayer } from "@deck.gl/layers";
import { StopTypeColors } from "@/util/gtfsStyling";
import { getMapsFunction } from "@/components/mapComponent/MapFunctions";
import DeckglMap from "@/components/mapComponent/DeckglMap";

function MapSection({
  MapLayers,
  StationData,
  setMapLayers,
  ClickInfo,
  setClickInfo,
  viewState,
  setViewState,
  setBoundBox,
  BoundBox,
}) {

  useEffect(() => {
    if (!StationData || StationData.StationData === undefined) return;

    const mapPoints = StationData.StationData.filter(
      (row) => row.stop_lon !== null && row.stop_lat !== null
    );
    if (mapPoints.length === 0) {
      setMapLayers([]);
      return;
    }

    const { CenterData, BoundBox: mapBoundBox } = getMapsFunction({
      data: mapPoints,
    });

    setViewState((prevState) => ({
      ...prevState,
      longitude: CenterData.lon,
      latitude: CenterData.lat,
      zoom: 17,
    }));

    setBoundBox(mapBoundBox);

    const baseLayer = new ScatterplotLayer({
      id: "table-view",
      data: mapPoints,
      getFillColor: (row) => StopTypeColors[row["location_type_name"]]?.color,
      pickable: true,
      getLineWidth: 0.025,
      stroked: true,
      radiusUnits: "pixels",
      radiusMinPixels: 4,
      getPosition: (row) => [Number(row.stop_lon), Number(row.stop_lat)],
    });

    const layers = [baseLayer];

    if (ClickInfo) {
      setViewState({
        longitude: ClickInfo.object.stop_lon,
        latitude: ClickInfo.object.stop_lat,
        zoom: 18,
      });

      const highlightedPoint = new ScatterplotLayer({
        id: "highlighted-point",
        data: [ClickInfo.object],
        getFillColor: [0, 0, 0],
        pickable: true,
        lineWidthUnits: "pixels",
        getLineWidth: 4,
        lineWidthMinPixels: 5,
        stroked: true,
        radiusUnits: "pixels",
        radiusMinPixels: 20,
        getPosition: (d) => d.coordinates,
      });
      layers.unshift(highlightedPoint);
    }

    setMapLayers(layers);
  }, [StationData, ClickInfo, setViewState, setMapLayers, setBoundBox]);

  if (!viewState || !BoundBox) return null;

  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      <DeckglMap
        MinZoom={14}
        dragRotate={false}
        MapLayers={MapLayers}
        BoundBox={BoundBox}
        viewState={viewState}
        setViewState={setViewState}
        setClickInfo={setClickInfo}
      />
    </div>
  );
}
export default MapSection;
