import { useState } from 'react';

import { getMapsFunction } from "@/functions/mapComponent/MapFunctions";

import MapLegend from './Components/MapLegend';
import MapSection from './Components/MapSection';
import ClickPopup from './Components/ClickPopup';

function StationsMap({ data, setOpen, ClickInfo, setClickInfo }) {
  const { CenterData, BoundBox }= getMapsFunction({ data: data });
  const [MapLayers, setMapLayers] = useState([]);
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
          setOpen={setOpen}
          />
      </div>
    )}
    <div className="relative h-full w-full border p-1 rounded-md">
      <div className="text-sm text-stone-500 m-3">
          Click a point to edit, delete, or learn more about a Station
      </div>
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