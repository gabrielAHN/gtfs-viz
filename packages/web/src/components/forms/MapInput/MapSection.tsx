import { useEffect, useState, useMemo } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";

import { useThemeContext } from "@/context/theme.client";
import { getMapsFunction } from "@/functions/mapComponent/MapFunctions";
import { getStopColor, getHighlightColor } from "@/components/style";
import { Skeleton } from "@/components/ui/skeleton";

import MapContainer from "@/components/maps/MapContainer";
import MapLegend from "@/components/maps/MapLegend";
import DeckglMap from "@/components/maps/DeckglMap.lazy";
import { createPointOutline } from "@/components/maps/MapOutlineHelpers";

interface MapSectionProps {
  Data: any[];
  lat: number | undefined;
  lon: number | undefined;
  onMapClick: (newLon: number, newLat: number) => void;
  locationType?: string;
}

export default function MapSection({
  Data,
  lat,
  lon,
  onMapClick,
  locationType,
}: MapSectionProps) {
  const { theme } = useThemeContext();

  const [viewState, setViewState] = useState(null);
  const [MapLayers, setMapLayers] = useState([]);
  const [BoundBox, setBoundBox] = useState(null);

  const legendItems = useMemo(() => {
    if (!Array.isArray(Data) || Data.length === 0) return [];

    const uniqueTypes = new Set(
      Data.map((d) => d.location_type_name).filter(Boolean),
    );
    const items = Array.from(uniqueTypes).map((type) => {
      const color = getStopColor(type, theme);
      const rgbColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      return { label: type, color: rgbColor };
    });

    if (lat !== undefined && lon !== undefined && locationType) {
      const selectedColor = getStopColor(locationType, theme);
      const rgbSelected = `rgb(${selectedColor[0]}, ${selectedColor[1]}, ${selectedColor[2]})`;
      items.push({ label: `Selected Point (${locationType})`, color: rgbSelected });
    } else if (lat !== undefined && lon !== undefined) {
      const highlightColor = getHighlightColor(theme);
      const rgbHighlight = `rgb(${highlightColor[0]}, ${highlightColor[1]}, ${highlightColor[2]})`;
      items.push({ label: "Selected Point", color: rgbHighlight });
    }

    return items;
  }, [Data, theme, lat, lon, locationType]);

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
      const newZoom = prev && typeof prev.zoom === "number" ? prev.zoom : 14;
      return {
        ...prev,
        longitude:
          lat !== undefined && lon !== undefined ? lon : CenterData.lon,
        latitude: lat !== undefined && lon !== undefined ? lat : CenterData.lat,
        zoom: newZoom,
      };
    });
    setBoundBox(BoundBox);

    const baseLayer = new ScatterplotLayer({
      id: "station-data",
      data: mapPoints,
      pickable: true,
      getPosition: (d) => [Number(d.stop_lon), Number(d.stop_lat)],
      getFillColor: (d) => getStopColor(d.location_type_name, theme),
      radiusMinPixels: 4,
    });

    const layers = [baseLayer];

    if (lat !== undefined && lon !== undefined) {
      const selectedPointData = [{ stop_lat: lat, stop_lon: lon }];

      const outlineLayer = createPointOutline({
        id: "selected-point-outline",
        data: selectedPointData,
        theme,
        state: "selected",
      });

      const pointColor = locationType
        ? getStopColor(locationType, theme)
        : getHighlightColor(theme);

      const selectedPointLayer = new ScatterplotLayer({
        id: "selected-point",
        data: selectedPointData,
        pickable: true,
        getPosition: (d) => [Number(d.stop_lon), Number(d.stop_lat)],
        getFillColor: pointColor,
        radiusMinPixels: 8,
        stroked: false,
      });

      layers.push(outlineLayer, selectedPointLayer);
    }

    setMapLayers(layers);
  }, [Data, lat, lon, theme, locationType]);

  const handleMapClick = (info: any) => {
    if (info?.coordinate) {
      const [lon, lat] = info.coordinate;
      onMapClick(lon, lat);
    }
  };

  if (!viewState || !BoundBox) {
    return (
      <div className="relative h-40 w-full overflow-hidden rounded-md">
        <Skeleton className="h-full w-full rounded-sm" />
      </div>
    );
  }

  return (
    <div className="h-40 w-full">
      <MapContainer
        instructionText="Click on the map to select coordinates"
        showLegend={legendItems.length > 0}
        legendContent={
          <MapLegend
            title="Map Legend"
            items={legendItems}
            collapsible={true}
            defaultExpanded={false}
          />
        }
      >
        <DeckglMap
          MinZoom={7}
          dragRotate={false}
          MapLayers={MapLayers}
          BoundBox={BoundBox}
          viewState={viewState}
          setClickInfo={handleMapClick}
          setViewState={setViewState}
        />
      </MapContainer>
    </div>
  );
}
