import { useEffect } from "react";

import { ScatterplotLayer } from "@deck.gl/layers";
import { StopTypeColors } from "@/components/style";
import { useThemeContext } from "@/context/combinedContext";
import { getMapsFunction } from "@/functions/mapComponent/MapFunctions";
import DeckglMap from "@/components/maps/DeckglMap"

function MapSection({
  MapLayers,
  Data,
  setMapLayers,
  ClickInfo,
  setClickInfo,
  viewState,
  setViewState,
  setBoundBox,
  BoundBox,
}) {
  const { theme } = useThemeContext();

  useEffect(() => {
    if (!Data ||Data.length === 0) return;

    const mapPoints = Data.filter(
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
      id: "station-table-view",
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
        longitude: ClickInfo.stop_lon,
        latitude: ClickInfo.stop_lat,
        zoom: 19,
      });

      const highlightedPoint = new ScatterplotLayer({
        id: "highlighted-point",
        data: [{ 'coordinates': [ClickInfo.stop_lon, ClickInfo.stop_lat] }],
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

    setMapLayers(layers);
  }, [Data, ClickInfo, setViewState, setMapLayers, setBoundBox, theme]);

  if (!viewState || !BoundBox) return null;
  
  const handleMapClick = (info: any) => {
    setClickInfo(info?.object)
  };

  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      <DeckglMap
        MinZoom={10}
        dragRotate={false}
        MapLayers={MapLayers}
        BoundBox={BoundBox}
        viewState={viewState}
        setViewState={setViewState}
        setClickInfo={handleMapClick}
      />
    </div>
  );
}
export default MapSection;
