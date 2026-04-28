import { useEffect, useState, useCallback, useRef } from "react";

import { ScatterplotLayer } from "@deck.gl/layers";
import { getStopColor, WHEELCHAIR_STATUS } from "@/components/style";
import { useThemeContext } from "@/context/theme.client";
import { getMapsFunction } from "@/functions/mapComponent/MapFunctions";
import DeckglMap from "@/components/maps/DeckglMap.lazy";
import { createPointOutline } from "@/components/maps/MapOutlineHelpers"

function MapSection({
  MapLayers,
  Data,
  setMapLayers,
  DataColor = "location_type_name",
  ClickInfo,
  setClickInfo,
  viewState,
  setViewState,
  setBoundBox,
  BoundBox,
}) {
  const { theme } = useThemeContext();
  const [HoverInfo, setHoverInfo] = useState(null);
  const lastAutoZoomedStopId = useRef(null);

  const handleClick = useCallback((event) => {
    if (!setClickInfo) return;

    if (event.object) {
      
      setClickInfo(event);
    } else {
      
      setClickInfo(undefined);
    }
  }, [setClickInfo]);

  useEffect(() => {
    if (!Data || Data.length === 0) return;
    if (viewState && BoundBox) return; 
    if (!setViewState || !setBoundBox) return; 

    const mapPoints = Data.filter(
      (row) => row.stop_lon !== null && row.stop_lat !== null
    );

    if (mapPoints.length === 0) return;

    const { CenterData, BoundBox: mapBoundBox } = getMapsFunction({
      data: mapPoints,
    });

    setViewState({
      longitude: CenterData.lon,
      latitude: CenterData.lat,
      zoom: 17,
      pitch: 0,
      bearing: 0,
    });

    setBoundBox(mapBoundBox);
  }, [Data, viewState, BoundBox, setViewState, setBoundBox]);

  useEffect(() => {
    if (!ClickInfo || !setViewState) return;

    const clickData = ClickInfo?.object || ClickInfo;

    if (clickData?.stop_lon && clickData?.stop_lat && clickData?.stop_id) {
      
      if (lastAutoZoomedStopId.current === clickData.stop_id) {
        return;
      }

      const isMapClick = ClickInfo?.layer?.id === "station-table-view";

      if (!isMapClick) {
        
        setViewState((prev) => ({
          ...prev,
          longitude: clickData.stop_lon,
          latitude: clickData.stop_lat,
          zoom: 17,
        }));
        lastAutoZoomedStopId.current = clickData.stop_id;
      }
    }
  }, [ClickInfo, setViewState]);

  useEffect(() => {
    if (!Data || Data.length === 0) {
      setMapLayers([]);
      return;
    }

    const mapPoints = Data.filter(
      (row) => row.stop_lon !== null && row.stop_lat !== null
    );

    if (mapPoints.length === 0) {
      setMapLayers([]);
      return;
    }

    const baseLayer = new ScatterplotLayer({
      id: "station-table-view",
      data: mapPoints,
      getFillColor: (row) => {
        if (DataColor === "wheelchair_status") {
          return WHEELCHAIR_STATUS[row.wheelchair_status]?.color || [128, 128, 128];
        }
        return getStopColor(row.location_type_name, theme);
      },
      pickable: true,
      getLineWidth: 0.025,
      stroked: true,
      radiusUnits: "pixels",
      radiusMinPixels: 4,
      getPosition: (row) => [Number(row.stop_lon), Number(row.stop_lat)],
    });

    const layers = [baseLayer];

    const clickData = ClickInfo?.object || ClickInfo;
    const hoverData = HoverInfo?.object || HoverInfo;

    if (HoverInfo?.layer?.id === "station-table-view" && hoverData &&
        (!clickData || hoverData.stop_id !== clickData.stop_id)) {
      const hoverOutline = createPointOutline({
        id: "hover-part-point",
        data: [hoverData],
        theme,
        state: 'hover',
      });
      layers.push(hoverOutline);
    }

    if (clickData && clickData.stop_id) {
      const selectedOutline = createPointOutline({
        id: "selected-part-point",
        data: [clickData],
        theme,
        state: 'selected',
      });
      layers.push(selectedOutline);
    }

    setMapLayers(layers);
  }, [Data, DataColor, ClickInfo, HoverInfo, theme]);

  if (!viewState || !BoundBox) return null;

  return (
    <DeckglMap
      MinZoom={10}
      dragRotate={false}
      maxPitch={0}
      MapLayers={MapLayers}
      BoundBox={BoundBox}
      viewState={viewState}
      setViewState={setViewState}
      setClickInfo={handleClick}
      setHoverInfo={setHoverInfo}
    />
  );
}
export default MapSection;
