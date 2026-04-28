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

const withOpacity = (color: number[], opacity: number) => [
  color[0] ?? 0,
  color[1] ?? 0,
  color[2] ?? 0,
  opacity,
];

export const createPointOutline = ({
  id,
  data,
  theme,
  state = 'selected',
  getLineColorFn,
}: {
  id: string;
  data: any[];
  theme: 'dark' | 'light';
  state?: 'hover' | 'selected';
  getLineColorFn?: (row: any) => number[];
}) => {
  const style = OutlineStyles[state];
  const outlineColor = getHighlightColor(theme);
  const colorWithOpacity = [...outlineColor, style.opacity];

  return new ScatterplotLayer({
    id,
    data,
    getFillColor: [0, 0, 0, 0], 
    getLineColor: getLineColorFn
      ? (row: any) => withOpacity(getLineColorFn(row), style.opacity)
      : colorWithOpacity,
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
  getOutlineSourceColorFn,
  getOutlineTargetColorFn,
}: {
  id: string;
  data: any[];
  theme: 'dark' | 'light';
  state?: 'hover' | 'selected';
  getSourceColorFn: (row: any) => number[];
  getTargetColorFn: (row: any) => number[];
  getOutlineSourceColorFn?: (row: any) => number[];
  getOutlineTargetColorFn?: (row: any) => number[];
}) => {
  const style = OutlineStyles[state];
  const outlineColor = getHighlightColor(theme);
  const colorWithOpacity = [...outlineColor, style.opacity];

  const outlineArc = new ArcLayer({
    id: `${id}-outline`,
    data,
    getSourcePosition: (d: any) => d.from_coord,
    getTargetPosition: (d: any) => d.to_coord,
    getSourceColor: getOutlineSourceColorFn
      ? (row: any) => withOpacity(getOutlineSourceColorFn(row), style.opacity)
      : colorWithOpacity,
    getTargetColor: getOutlineTargetColorFn
      ? (row: any) => withOpacity(getOutlineTargetColorFn(row), style.opacity)
      : colorWithOpacity,
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
  getOutlineFillColorFn,
  getOutlineLineColorFn,
}: {
  id: string;
  data: any[];
  theme: 'dark' | 'light';
  state?: 'hover' | 'selected';
  getFillColorFn: (row: any) => number[];
  getOutlineFillColorFn?: (row: any) => number[];
  getOutlineLineColorFn?: (row: any) => number[];
}) => {
  const style = OutlineStyles[state];
  const outlineColor = getHighlightColor(theme);
  const colorWithOpacity = [...outlineColor, style.opacity];

  const outlineColumn = new ColumnLayer({
    id: `${id}-outline`,
    data,
    diskResolution: 12,
    getPosition: (row: any) => row.from_coord,
    getFillColor: getOutlineFillColorFn
      ? (row: any) => withOpacity(getOutlineFillColorFn(row), style.opacity)
      : colorWithOpacity,
    radius: 1.2,
    getElevation: 1.5,
    radiusUnits: "meters",
    radiusMinPixels: 2,
    stroked: true,
    lineWidthMinPixels: 2,
    getLineColor: getOutlineLineColorFn
      ? (row: any) => withOpacity(getOutlineLineColorFn(row), style.opacity)
      : outlineColor,
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
