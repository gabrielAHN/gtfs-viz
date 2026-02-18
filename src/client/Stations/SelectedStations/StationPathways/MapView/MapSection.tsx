import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { getMapsFunction } from "@/functions/mapComponent/MapFunctions";
import { ScatterplotLayer, ArcLayer, ColumnLayer } from "@deck.gl/layers";
import { hexToRgb, hslToRgb } from "@/components/colorUtil";
import { getStopColor, getConnectionTypeColor } from "@/components/style";
import { useThemeContext } from "@/context/theme.client";
import DeckglMap from "@/components/maps/DeckglMap.lazy";
import {
  createPointOutline,
  createArcOutline,
  createColumnOutline,
} from "@/components/maps/MapOutlineHelpers";

function MapSection({
  Data = { connections: [], stops: [] },
  setClickInfo,
  ClickInfo,
  ConnectionType,
  timeIntervalRanges,
  viewState: parentViewState,
  setViewState: parentSetViewState,
}) {
  const { theme } = useThemeContext();
  const [MapLayers, setMapLayers] = useState([]);
  const [localViewState, setLocalViewState] = useState(null);
  const [BoundBox, setBoundBox] = useState(null);
  const [HoverInfo, setHoverInfo] = useState(null);

  const viewState =
    parentViewState !== undefined ? parentViewState : localViewState;
  const setViewState =
    parentSetViewState !== undefined ? parentSetViewState : setLocalViewState;

  const setColorArcs = (d) => {
    if (ConnectionType === "timeInterval") {
      const value = d.timeInterval;

      let color = theme === "dark" ? [160, 160, 160] : [100, 100, 100];

      if (value !== null && value !== undefined) {
        for (const range of timeIntervalRanges) {
          if (value >= range.min && value <= range.max) {
            if (range.color.startsWith("hsl")) {
              color = hslToRgb(range.color);
            } else if (range.color.startsWith("#")) {
              color = hexToRgb(range.color);
            }
            break;
          }
        }
      }
      return color;
    } else {
      return getConnectionTypeColor(d, ConnectionType, theme);
    }
  };

  useEffect(() => {
    if (!Data || !Data.stops || Data.stops.length === 0) {
      return;
    }
    if (viewState && BoundBox) return;

    const result = getMapsFunction({
      data: Data.stops,
    });

    if (!result.CenterData || !result.BoundBox) {
      return;
    }

    const { CenterData, BoundBox: mapBoundBox } = result;

    if (!CenterData || !CenterData.lon || !CenterData.lat) {
      return;
    }

    setViewState({
      longitude: CenterData.lon,
      latitude: CenterData.lat,
      zoom: 17,
      pitch: 60,
      bearing: 0,
    });

    setBoundBox(mapBoundBox);
  }, [Data, viewState, BoundBox]);

  useEffect(() => {
    if (!Data || !Data.stops || Data.stops.length === 0) {
      return;
    }

    const ArcData = (Data.connections || [])
      .filter((row) => {
        
        return (
          row.from_lat !== null &&
          row.from_lat !== undefined &&
          row.from_lon !== null &&
          row.from_lon !== undefined &&
          row.to_lat !== null &&
          row.to_lat !== undefined &&
          row.to_lon !== null &&
          row.to_lon !== undefined &&
          !isNaN(row.from_lat) &&
          !isNaN(row.from_lon) &&
          !isNaN(row.to_lat) &&
          !isNaN(row.to_lon)
        );
      })
      .map((row) => {
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

    const mapPoints = Data.stops.filter(
      (row) => row.stop_lon !== null && row.stop_lat !== null,
    );

    const PointLayer = new ScatterplotLayer({
      id: "TableView",
      data: mapPoints,
      getFillColor: (row) => {
        return getStopColor(row.location_type_name, theme);
      },
      pickable: true,
      getLineWidth: 0.025,
      stroked: true,
      radiusUnits: "pixels",
      radiusMinPixels: 4,
      getPosition: (row) => [Number(row.stop_lon), Number(row.stop_lat)],
    });

    const layers = [PointLayer];

    if (
      HoverInfo?.layer?.id === "TableView" &&
      HoverInfo?.object &&
      (!ClickInfo?.object ||
        HoverInfo.object.stop_id !== ClickInfo.object.stop_id)
    ) {
      const hoverOutline = createPointOutline({
        id: "hover-stop-point",
        data: [HoverInfo.object],
        theme,
        state: "hover",
      });
      layers.push(hoverOutline);
    }

    if (ClickInfo?.layer?.id === "TableView" && ClickInfo?.object) {
      const selectedOutline = createPointOutline({
        id: "selected-stop-point",
        data: [ClickInfo.object],
        theme,
        state: "selected",
      });
      layers.push(selectedOutline);
    }

    if (ArcData.length > 0) {
      const ArcLayerData = ArcData.filter(
        (row) =>
          row.from_coord != row.to_coord ||
          row.from_coord != row.to_coord ||
          row.to_coord != row.from_coord,
      );
      const PointLayerData = ArcData.filter(
        (row) =>
          row.from_coord[0] === row.to_coord[0] ||
          row.from_coord[1] === row.to_coord[1] ||
          row.to_coord[0] === row.from_coord[1] ||
          row.to_coord[1] === row.from_coord[0],
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
          getWidth: 3,
          pickable: true,
        });

        layers.unshift(ConnectionLayer);

        const getArcSourceColor = (row) => {
          if (ConnectionType === "directional") {
            const color = setColorArcs(row);
            if (color.from) {
              return color.from;
            } else {
              return color;
            }
          } else {
            return setColorArcs(row);
          }
        };

        const getArcTargetColor = (row) => {
          if (ConnectionType === "directional") {
            const color = setColorArcs(row);
            if (color.to) {
              return color.to;
            } else {
              return color;
            }
          } else {
            return setColorArcs(row);
          }
        };

        if (
          HoverInfo?.layer?.id === "ArcLayer" &&
          HoverInfo?.object &&
          (!ClickInfo?.object || HoverInfo.object.id !== ClickInfo.object.id)
        ) {
          const [hoverOutlineArc, hoverOriginalArc] = createArcOutline({
            id: "hover-arc",
            data: [HoverInfo.object],
            theme,
            state: "hover",
            getSourceColorFn: getArcSourceColor,
            getTargetColorFn: getArcTargetColor,
          });
          layers.push(hoverOutlineArc, hoverOriginalArc);
        }

        if (ClickInfo?.layer?.id === "ArcLayer" && ClickInfo?.object) {
          const [selectedOutlineArc, selectedOriginalArc] = createArcOutline({
            id: "selected-arc",
            data: [ClickInfo.object],
            theme,
            state: "selected",
            getSourceColorFn: getArcSourceColor,
            getTargetColorFn: getArcTargetColor,
          });
          layers.push(selectedOutlineArc, selectedOriginalArc);
        }
      }
      if (PointLayerData.length > 0) {
        const VerticalConnectionLayer = new ColumnLayer({
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
          radius: 1,
          getElevation: 1.5,
          radiusUnits: "meters",
          radiusMinPixels: 2,
          pickable: true,
          stroked: true,
          lineWidthMinPixels: 1,
          getLineColor:
            theme === "dark" ? [255, 255, 255, 120] : [0, 0, 0, 120],
        });
        layers.unshift(VerticalConnectionLayer);

        const getColumnFillColor = (row) => {
          if (ConnectionType === "directional") {
            return setColorArcs(row)["from"];
          } else {
            return setColorArcs(row);
          }
        };

        if (
          HoverInfo?.layer?.id === "PointLayer" &&
          HoverInfo?.object &&
          (!ClickInfo?.object || HoverInfo.object.id !== ClickInfo.object.id)
        ) {
          const [hoverOutlineColumn, hoverOriginalColumn] = createColumnOutline(
            {
              id: "hover-column",
              data: [HoverInfo.object],
              theme,
              state: "hover",
              getFillColorFn: getColumnFillColor,
            },
          );
          layers.push(hoverOutlineColumn, hoverOriginalColumn);
        }

        if (ClickInfo?.layer?.id === "PointLayer" && ClickInfo?.object) {
          const [selectedOutlineColumn, selectedOriginalColumn] =
            createColumnOutline({
              id: "selected-column",
              data: [ClickInfo.object],
              theme,
              state: "selected",
              getFillColorFn: getColumnFillColor,
            });
          layers.push(selectedOutlineColumn, selectedOriginalColumn);
        }
      }
    }

    setMapLayers(layers);
  }, [Data, ClickInfo, HoverInfo, ConnectionType, timeIntervalRanges, theme]);

  if (!viewState || !BoundBox) {
    return null;
  }

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
        setHoverInfo={setHoverInfo}
      />
    </div>
  );
}

export default MapSection;
