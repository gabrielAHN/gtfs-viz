import { ScatterplotLayer, ArcLayer, ColumnLayer } from "@deck.gl/layers";
import { getHighlightColor } from "@/components/style";

export const OutlineStyles = {
  hover: {
    pointRadius: 12,
    pointLineWidth: 2,
    arcWidth: 6,
    columnRadius: 0.7,
    opacity: 180,
  },
  selected: {
    pointRadius: 10,
    pointLineWidth: 3,
    arcWidth: 7,
    columnRadius: 0.8,
    opacity: 255,
  },
};

export const createPointOutline = ({
  id,
  data,
  theme,
  state = 'selected',
}: {
  id: string;
  data: any[];
  theme: 'dark' | 'light';
  state?: 'hover' | 'selected';
}) => {
  const style = OutlineStyles[state];
  const outlineColor = getHighlightColor(theme);
  const colorWithOpacity = [...outlineColor, style.opacity];

  return new ScatterplotLayer({
    id,
    data,
    getFillColor: [0, 0, 0, 0], 
    getLineColor: colorWithOpacity,
    getPosition: (row: any) => [Number(row.stop_lon), Number(row.stop_lat)],
    pickable: false,
    stroked: true,
    filled: false,
    getLineWidth: style.pointLineWidth,
    lineWidthUnits: "pixels",
    radiusUnits: state === 'hover' ? "pixels" : "meters",
    radiusMinPixels: style.pointRadius,
  });
};

export const createArcOutline = ({
  id,
  data,
  theme,
  state = 'selected',
  getSourceColorFn,
  getTargetColorFn,
}: {
  id: string;
  data: any[];
  theme: 'dark' | 'light';
  state?: 'hover' | 'selected';
  getSourceColorFn: (row: any) => number[];
  getTargetColorFn: (row: any) => number[];
}) => {
  const style = OutlineStyles[state];
  const outlineColor = getHighlightColor(theme);
  const colorWithOpacity = [...outlineColor, style.opacity];

  const outlineArc = new ArcLayer({
    id: `${id}-outline`,
    data,
    getSourcePosition: (d: any) => d.from_coord,
    getTargetPosition: (d: any) => d.to_coord,
    getSourceColor: colorWithOpacity,
    getTargetColor: colorWithOpacity,
    getWidth: style.arcWidth,
    pickable: false,
  });

  const originalArc = new ArcLayer({
    id: `${id}-original`,
    data,
    getSourcePosition: (d: any) => d.from_coord,
    getTargetPosition: (d: any) => d.to_coord,
    getSourceColor: getSourceColorFn,
    getTargetColor: getTargetColorFn,
    getWidth: 3,
    pickable: false,
  });

  return [outlineArc, originalArc];
};

export const createColumnOutline = ({
  id,
  data,
  theme,
  state = 'selected',
  getFillColorFn,
}: {
  id: string;
  data: any[];
  theme: 'dark' | 'light';
  state?: 'hover' | 'selected';
  getFillColorFn: (row: any) => number[];
}) => {
  const style = OutlineStyles[state];
  const outlineColor = getHighlightColor(theme);
  const colorWithOpacity = [...outlineColor, style.opacity];

  const outlineColumn = new ColumnLayer({
    id: `${id}-outline`,
    data,
    diskResolution: 12,
    getPosition: (row: any) => row.from_coord,
    getFillColor: colorWithOpacity,
    radius: 1.2,
    getElevation: 1.5,
    radiusUnits: "meters",
    radiusMinPixels: 2,
    stroked: true,
    lineWidthMinPixels: 2,
    getLineColor: outlineColor,
    pickable: false,
  });

  const originalColumn = new ColumnLayer({
    id: `${id}-original`,
    data,
    diskResolution: 12,
    getPosition: (row: any) => row.from_coord,
    getFillColor: getFillColorFn,
    radius: 1,
    getElevation: 1.5,
    radiusUnits: "meters",
    radiusMinPixels: 2,
    stroked: true,
    lineWidthMinPixels: 1,
    getLineColor: theme === 'dark' ? [255, 255, 255, 120] : [0, 0, 0, 120],
    pickable: false,
  });

  return [outlineColumn, originalColumn];
};
