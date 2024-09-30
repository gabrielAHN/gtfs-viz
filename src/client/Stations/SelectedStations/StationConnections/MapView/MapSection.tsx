import { useState, useEffect } from "react";
import { getMapsFunction } from "@/components/mapComponent/MapFunctions";
import { ScatterplotLayer, ArcLayer, ColumnLayer } from "@deck.gl/layers";
import { parseRgbString } from "@/util/colorUtil";
import {
  StopTypeColors,
  ConnectTypeColors,
  PathwayColors,
} from "@/util/gtfsStyling";
import DeckglMap from "@/components/mapComponent/DeckglMap";

function MapSection({
  PathwaysData = { connections: [], stops: [] },
  setClickInfo,
  ClickInfo,
  ConnectionType,
  timeIntervalRanges,
}) {
  const [MapLayers, setMapLayers] = useState([]);
  const [viewState, setViewState] = useState(null);
  const [BoundBox, setBoundBox] = useState(null);

  const setColorArcs = (d) => {
    if (ConnectionType === "directional") {
      const arcStatus = d?.directional ?? null;
      if (arcStatus == "directional") {
        return ConnectTypeColors[d.directional];
      }
      if (arcStatus == "bidirectional") {
        return ConnectTypeColors[arcStatus]["bidirectional"];
      } else {
        return arcStatus.bidirectional;
      }
    } else if (ConnectionType === "timeInterval") {
      const value = d.timeInterval;
      let color = [0, 0, 0];

      for (const range of timeIntervalRanges) {
        if (value >= range.min && value <= range.max) {
          color = parseRgbString(range.color);
        }
      }
      return color;
    } else if (ConnectionType === "PathwayTypes") {
      return PathwayColors[d.pathwayType].color;
    }
  };

  useEffect(() => {
    if (!PathwaysData.stops || PathwaysData.stops.length === 0) return;

    const { CenterData, BoundBox: mapBoundBox } = getMapsFunction({
      data: PathwaysData.stops,
    });

    setViewState({
      longitude: CenterData.lon,
      latitude: CenterData.lat,
      zoom: 17,
      pitch: 60,
    });
    setBoundBox(mapBoundBox);

    const ArcData = (PathwaysData.connections || []).map((row) => {
      return {
        id: row.pathway_id,
        directional: row.direction_type,
        angle: Number(row.angle),
        pathwayType: row.pathway_mode_name,
        timeInterval: row.traversal_time,
        from_name: row.from_stop_id || "Unknown",
        from_coord: [row.from_lon, row.from_lat],
        to_name: row.to_stop_id || "Unknown",
        to_coord: [row.to_lon, row.to_lat],
      };
    });

    const mapPoints = PathwaysData.stops.filter(
      (row) => row.stop_lon !== null && row.stop_lat !== null
    );

    const PointLayer = new ScatterplotLayer({
      id: "TableView",
      data: mapPoints,
      getFillColor: (row) => StopTypeColors[row["location_type_name"]]?.color,
      pickable: true,
      getLineWidth: 0.025,
      stroked: true,
      radiusUnits: "meters",
      radiusMinPixels: 7,
      getPosition: (row) => [Number(row.stop_lon), Number(row.stop_lat)],
    });

    const layers = [PointLayer];

    if (ArcData.length > 0) {
      const ArcLayerData = ArcData.filter(
        (row) =>
          row.from_coord != row.to_coord ||
          row.from_coord != row.to_coord ||
          row.to_coord != row.from_coord
      );
      const PointLayerData = ArcData.filter(
        (row) =>
          row.from_coord[0] === row.to_coord[0] ||
          row.from_coord[1] === row.to_coord[1] ||
          row.to_coord[0] === row.from_coord[1] ||
          row.to_coord[1] === row.from_coord[0]
      );

      if (ArcLayerData.length > 0) {
        const ConnectionLayer = new ArcLayer({
          id: "ArcLayer",
          data: ArcData,
          getSourcePosition: (d) => d.from_coord,
          getTargetPosition: (d) => d.to_coord,
          getSourceColor: (row) => {
            if (ConnectionType === "directional") {
              const color = setColorArcs(row);
              if (color.from) {
                return setColorArcs(row).from;
              } else {
                return color;
              }
            } else {
              return setColorArcs(row);
            }
          },
          getTargetColor: (row) => {
            if (ConnectionType === "directional") {
              const color = setColorArcs(row);
              if (color.to) {
                return setColorArcs(row).to;
              } else {
                return color;
              }
            } else {
              return setColorArcs(row);
            }
          },
          getTilt: (d) => d.angle,
          getWidth: 3,
          pickable: true,
        });

        layers.unshift(ConnectionLayer);
      }
      if (PointLayerData.length > 0) {
        const PointLayer = new ColumnLayer({
          id: "PointLayer",
          data: PointLayerData,
          diskResolution: 12,
          getPosition: (row) => row.from_coord,
          getFillColor: (row) => {
            if (ConnectionType === "directional") {
              return setColorArcs(row)["from"];
            } else {
              return setColorArcs(row);
            }
          },
          radius: 0.5,
          getElevation: 10,
          radiusUnits: "meters",
          radiusMinPixels: 0.5,
          pickable: true,
        });
        layers.unshift(PointLayer);
      }
    }

    setMapLayers(layers);
  }, [PathwaysData, ClickInfo, ConnectionType]);

  if (!viewState || !BoundBox) return null;

  return (
    <div className="relative h-[70vh] w-full overflow-hidden">
      <DeckglMap
        MinZoom={14}
        MapLayers={MapLayers}
        dragRotate={true}
        BoundBox={BoundBox}
        viewState={viewState}
        setViewState={setViewState}
        setClickInfo={setClickInfo}
      />
    </div>
  );
}

export default MapSection;
