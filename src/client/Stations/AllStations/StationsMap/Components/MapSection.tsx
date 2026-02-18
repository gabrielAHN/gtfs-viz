import { useEffect } from "react";

import DeckglMap from "@/components/maps/DeckglMap"

import { DATA_STATUS } from "@/components/style";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useThemeContext } from "@/context/combinedContext";


function MapSection({
  MapLayers,
  TableData,
  setMapLayers,
  DataColor,
  viewState,
  setViewState,
  BoundBox,
  ClickInfo,
  setClickInfo
}) {
  const { theme } = useThemeContext();

  useEffect(() => {
    const mapPoints = TableData.map((row) => ({
      coordinates: [Number(row.stop_lon), Number(row.stop_lat)],
      ...row,
    }));

    const baseLayer = new ScatterplotLayer({
      id: "all-table-view",
      data: mapPoints,
      getFillColor: (row) => DATA_STATUS[row[DataColor]].color,
      getPosition: (d) => d.coordinates,
      pickable: true,
      getLineWidth: 0.025,
      stroked: true,
      radiusUnits: "pixels",
      radiusMinPixels: 4,
    });

    const layers = [baseLayer];

    if (ClickInfo) {
      setViewState({
        ...viewState,
        longitude: Number(ClickInfo.stop_lon),
        latitude: Number(ClickInfo.stop_lat),
        zoom: 15
      });

      const highlightedPoint = new ScatterplotLayer({
        id: "highlighted-point",
        data: [{'coordinates': [ClickInfo.stop_lon, ClickInfo.stop_lat]}],
        getFillColor: theme === "dark" ? [255, 255, 255] : [0, 0, 0],
        getPosition: (d) => d.coordinates,
        pickable: true,
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        radiusUnits: "pixels",
        radiusMaxPixels: 10,
        radiusMinPixels: 10,
      });
      layers.unshift(highlightedPoint);
    }

    setMapLayers([layers]);
  }, [TableData, DataColor, ClickInfo, theme]);

  const handleMapClick = (info: any) => {
    setClickInfo(info?.object)
  };

  return (
    <div className="relative h-[74vh] w-full">
      <DeckglMap
        MinZoom={7}
        dragRotate={false}
        MapLayers={MapLayers}
        BoundBox={BoundBox}
        viewState={viewState}
        setClickInfo={handleMapClick}
        setViewState={setViewState}
      />
    </div>
  );
}

export default MapSection;
