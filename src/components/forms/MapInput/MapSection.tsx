import { useEffect, useState } from "react";

import { useThemeContext } from "@/context/combinedContext";

import { getMapsFunction } from "@/functions/mapComponent/MapFunctions";
import { StopTypeColors } from "@/components/style";
import { Skeleton } from "@/components/ui/skeleton";
import { ScatterplotLayer } from "@deck.gl/layers";


import DeckglMap from "@/components/maps/DeckglMap";

interface MapSectionProps {
  Data: any[];
  lat: number | undefined;
  lon: number | undefined;
  onMapClick: (newLon: number, newLat: number) => void;
}

export default function MapSection({
  Data,
  lat,
  lon,
  onMapClick,
}) {
  const { theme } = useThemeContext();

  const [viewState, setViewState] = useState(null);
  const [MapLayers, setMapLayers] = useState([]);
  const [BoundBox, setBoundBox] = useState(null);

  useEffect(() => {
    if (!Array.isArray(Data) || Data.length === 0) {
      setMapLayers([]);
      return;
    }

    const mapPoints = Data.filter((row) => {
      const lo = parseFloat(row.stop_lon);
      const la = parseFloat(row.stop_lat);
      return !isNaN(lo) && !isNaN(la);
    });

    const { CenterData, BoundBox } = getMapsFunction({ data: mapPoints });
    
    setViewState((prev) => {
      const newZoom = prev && typeof prev.zoom === 'number' ? prev.zoom : 14;
      return {
        ...prev,
        longitude: (lat !== undefined && lon !== undefined) ? lon : CenterData.lon,
        latitude: (lat !== undefined && lon !== undefined) ? lat : CenterData.lat,
        zoom: newZoom,
      };
    });
    setBoundBox(BoundBox);

    const baseLayer = new ScatterplotLayer({
      id: "station-data",
      data: mapPoints,
      pickable: true,
      getPosition: (d) => [Number(d.stop_lon), Number(d.stop_lat)],
      getFillColor: (d) => StopTypeColors[d.location_type_name]?.color,
      radiusMinPixels: 4,
    });

    const layers = [baseLayer];
    if (lat !== undefined && lon !== undefined) {
      layers.push(
        new ScatterplotLayer({
          id: "highlight-point",
          data: [{ coordinates: [lon, lat] }],
          pickable: true,
          getPosition: (d) => d.coordinates,
          getFillColor: theme === "dark" ? [255, 255, 255] : [0, 0, 0],
          radiusMinPixels: 6,
          stroked: true,
          lineWidthMinPixels: 2,
        })
      );
    }

    setMapLayers(layers);
  }, [Data, lat, lon, theme]);

  const handleMapClick = (info: any) => {
    if (info?.coordinate) {
      const [lon, lat] = info.coordinate;
      onMapClick(lon, lat);
    }
  };
  return (
    <div className="relative h-[25vh] w-full overflow-hidden border p-1 rounded-md">
      {
        viewState && BoundBox ? (
          <DeckglMap
            MinZoom={7}
            dragRotate={false}
            MapLayers={MapLayers}
            BoundBox={BoundBox}
            viewState={viewState}
            setClickInfo={handleMapClick}
            setViewState={setViewState}
          />
        ) : (
          <Skeleton className="h-10 w-full rounded-sm" />
        )
      }
    </div>
  );
}
