import { useState } from 'react';
import ClickPopup from './ClickPopup';
import MapLegend from './MapLegend';
import MapSection from './MapSection';
import { getMapsFunction } from "@/components/mapComponent/MapFunctions";

export const DATA_STATUS = {
  "✅": {
    name: "yes",
    color: [128, 255, 128],
    tailwindColor: "bg-green-300",
  },
  "❌": {
    name: "no",
    color: [255, 128, 128],
    tailwindColor: "bg-red-400",
  },
  "🟡": {
    name: "some",
    color: [255, 255, 0],
    tailwindColor: "bg-yellow-200",
  },
  "❓": {
    name: "unknown",
    color: [255, 255, 128],
    tailwindColor: "bg-gray-500",
  },
};

function StationsMap({ data }) {
  const { CenterData, BoundBox }= getMapsFunction({ data: data });
  const [MapLayers, setMapLayers] = useState([]);
  const [ClickInfo, setClickInfo] = useState();
  const [DataColor, setDataColor] = useState("pathways_status");
  const [viewState, setViewState] = useState({
    longitude: CenterData.lon,
    latitude: CenterData.lat,
    zoom: 7,
  });


  return (
    <div className="relative h-full w-full overflow-hidden">
    {ClickInfo && (
      <div className="relative h-full w-full p-1">
        <ClickPopup 
          ClickInfo={ClickInfo}
          setClickInfo={setClickInfo}
          setViewState={setViewState}
          />
      </div>
    )}
    <div className="relative h-full w-full">
      <MapSection
        MapLayers={MapLayers}
        TableData={data}
        setMapLayers={setMapLayers}
        ClickInfo={ClickInfo}
        setClickInfo={setClickInfo}
        DataColor={DataColor}
        viewState={viewState}
        setViewState={setViewState}
        BoundBox={BoundBox}
      />
      <MapLegend TableData={data} DataColor={DataColor} setDataColor={setDataColor} />
    </div>
  </div>
  );
}

export default StationsMap;