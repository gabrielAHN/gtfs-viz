import { useState } from "react";
import MapSection from "./MapSection";
import ClickPopup from "./ClickPopup";

function MapView({ data, setOpen, ClickInfo, setClickInfo }) {
  const [MapLayers, setMapLayers] = useState([]);
  const [viewState, setViewState] = useState();
  const [BoundBox, setBoundBox] = useState();

  return (
    <div className="relative h-full w-full overflow-hidden">
    {ClickInfo && (
      <div className="relative h-full w-full p-1">
        <ClickPopup
          setOpen={setOpen}
          ClickInfo={ClickInfo}
          setClickInfo={setClickInfo}
          />
      </div>
    )}
    <div className="relative h-full w-full border p-1 rounded-md overflow-hidden">
      <div className="text-sm text-stone-500 m-3">
          Click a point to edit, or delete a station part.
      </div>
      <MapSection
        MapLayers={MapLayers}
        Data={data}
        setMapLayers={setMapLayers}
        ClickInfo={ClickInfo}
        setClickInfo={setClickInfo}
        viewState={viewState}
        setViewState={setViewState}
        BoundBox={BoundBox}
        setBoundBox={setBoundBox}
      />
    </div>
  </div>
  );
}

export default MapView;
