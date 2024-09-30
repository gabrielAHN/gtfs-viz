import { useState } from "react";
import MapSection from "./MapSection";
import ClickPopup from "./ClickPopup";

function MapView({ StationData }) {
  const [MapLayers, setMapLayers] = useState([]);
  const [ClickInfo, setClickInfo] = useState();
  const [viewState, setViewState] = useState();
  const [BoundBox, setBoundBox] = useState();

  return (
    <div className="relative h-full w-full">
      {ClickInfo && (
        <div className="relative">
          <ClickPopup ClickInfo={ClickInfo} setClickInfo={setClickInfo} />
        </div>
      )}
      <MapSection
        MapLayers={MapLayers}
        StationData={StationData}
        setMapLayers={setMapLayers}
        ClickInfo={ClickInfo}
        setClickInfo={setClickInfo}
        viewState={viewState}
        setViewState={setViewState}
        setBoundBox={setBoundBox}
        BoundBox={BoundBox}
      />
    </div>
  );
}

export default MapView;
