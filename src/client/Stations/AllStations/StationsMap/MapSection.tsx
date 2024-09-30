import { useEffect } from "react";
import { DATA_STATUS } from "./main";
import { ScatterplotLayer } from "@deck.gl/layers";

import DeckglMap from "@/components/mapComponent/DeckglMap";


function MapSection({
  MapLayers,
  TableData,
  setMapLayers,
  ClickInfo,
  setClickInfo,
  DataColor,
  viewState,
  setViewState,
  BoundBox,
}) {
  useEffect(() => {
    const mapPoints = TableData.map((row) => ({
      coordinates: [Number(row.stop_lon), Number(row.stop_lat)],
      ...row,
    }));

    const baseLayer = new ScatterplotLayer({
      id: "table-view",
      data: mapPoints,
      getFillColor: (row) => DATA_STATUS[row[DataColor]].color,
      pickable: true,
      getLineWidth: 1,
      stroked: true,
      radiusScale: 4,
      radiusMinPixels: 5,
      getPosition: (d) => d.coordinates,
    });

    const layers = [baseLayer];

    if (ClickInfo) {
      setViewState({
        longitude: ClickInfo.object.stop_lon,
        latitude: ClickInfo.object.stop_lat,
        zoom: 15,
      });
      const highlightedPoint = new ScatterplotLayer({
        id: "highlighted-point",
        data: [ClickInfo.object],
        filled: true,
        radiusScale: 1.5,
        getFillColor: [0, 0, 0],
        radiusMinPixels: 10,
        radiusMaxPixels: 10,
        getPosition: (d) => d.coordinates,
      });
      layers.unshift(highlightedPoint);
    }

    setMapLayers([layers]);
  }, [TableData, DataColor, ClickInfo]);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      <DeckglMap
        MinZoom={7}
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
