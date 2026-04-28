import { Fragment, type ReactNode } from "react";
import {
  BaseEdge,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  EdgeTypes,
  Handle,
  MarkerType,
  Node,
  NodeTypes,
  Position,
  getBezierPath,
} from "@xyflow/react";
import { Edit, Plus } from "lucide-react";

import { EditIndicator } from "@/components/ui/EditIndicator";

import type {
  CustomNodeData,
  DetachedConnectionDraft,
  EdgeFormValues,
  EdgeLabelMode,
  EdgeOptionalFieldKey,
  FlowHandleId,
  PathTraversalCost,
  PathTraversalEdge,
  PathwayEdgeData,
  ViewMode,
} from "./types";

export const DETACHED_CONNECTION_MIME =
  "application/gtfs-pathway-detached-connection";

export const getDetachedConnectionNodeId = (pathwayId: string) =>
  `detached-connection-${pathwayId}`;

export const getDetachedConnectionDraftAttachedNodeIds = (
  draft: DetachedConnectionDraft,
) =>
  [draft.fromStopId, draft.toStopId].filter((stopId): stopId is string =>
    Boolean(stopId),
  );

export const getDetachedConnectionDraftEndpointCount = (
  draft: DetachedConnectionDraft,
) => getDetachedConnectionDraftAttachedNodeIds(draft).length;

export const getDetachedConnectionDraftEndpointField = (
  handleId?: string | null,
): "fromStopId" | "toStopId" | null => {
  switch (handleId) {
    case "left":
    case "top":
      return "fromStopId";
    case "right":
    case "bottom":
      return "toStopId";
    default:
      return null;
  }
};

export const getNextDetachedConnectionDraftEndpoints = ({
  draft,
  nextStopId,
  endpointField,
}: {
  draft: DetachedConnectionDraft;
  nextStopId: string | null;
  endpointField?: "fromStopId" | "toStopId" | null;
}) => {
  let fromStopId = draft.fromStopId;
  let toStopId = draft.toStopId;

  if (endpointField === "fromStopId") {
    fromStopId = nextStopId;
  } else if (endpointField === "toStopId") {
    toStopId = nextStopId;
  } else if (fromStopId == null) {
    fromStopId = nextStopId;
  } else {
    toStopId = nextStopId;
  }

  return { fromStopId, toStopId };
};

export const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const editableAncestor = target.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );

  return Boolean(editableAncestor);
};

export const getOrCreateSet = <T,>(map: Map<string, Set<T>>, key: string) => {
  let current = map.get(key);
  if (!current) {
    current = new Set<T>();
    map.set(key, current);
  }
  return current;
};

export const getOrCreateList = <T,>(map: Map<string, T[]>, key: string) => {
  let current = map.get(key);
  if (!current) {
    current = [];
    map.set(key, current);
  }
  return current;
};

export const createInitialPathTraversalCost = (): PathTraversalCost => ({
  hasCompleteTraversalTime: true,
  totalTraversalTime: 0,
  hopCount: 0,
});

const getNextPathTraversalCost = (
  currentCost: PathTraversalCost,
  connection: any,
): PathTraversalCost => {
  const rawTraversalTime = connection?.traversal_time;
  const hasExplicitTraversalTime =
    rawTraversalTime !== null &&
    rawTraversalTime !== undefined &&
    rawTraversalTime !== "";
  const traversalTime = hasExplicitTraversalTime
    ? Number(rawTraversalTime)
    : Number.NaN;
  const hasTraversalTime = Number.isFinite(traversalTime) && traversalTime >= 0;
  const hasCompleteTraversalTime =
    currentCost.hasCompleteTraversalTime && hasTraversalTime;

  return {
    hasCompleteTraversalTime,
    totalTraversalTime: hasCompleteTraversalTime
      ? currentCost.totalTraversalTime + traversalTime
      : 0,
    hopCount: currentCost.hopCount + 1,
  };
};

export const comparePathTraversalCosts = (
  left: PathTraversalCost,
  right: PathTraversalCost,
) => {
  if (left.hasCompleteTraversalTime !== right.hasCompleteTraversalTime) {
    return left.hasCompleteTraversalTime ? -1 : 1;
  }

  if (left.hasCompleteTraversalTime) {
    if (left.totalTraversalTime !== right.totalTraversalTime) {
      return left.totalTraversalTime - right.totalTraversalTime;
    }
  }

  if (left.hopCount !== right.hopCount) {
    return left.hopCount - right.hopCount;
  }

  return 0;
};

export const formatPathTraversalCost = (cost?: PathTraversalCost | null) => {
  if (!cost) {
    return null;
  }

  if (cost.hasCompleteTraversalTime) {
    return `${cost.totalTraversalTime}s`;
  }

  return `${cost.hopCount} hop${cost.hopCount === 1 ? "" : "s"}`;
};

export const computeShortestPathTree = (
  startId: string | undefined,
  adjacencyByNodeId: Map<string, PathTraversalEdge[]>,
) => {
  const costByNodeId = new Map<string, PathTraversalCost>();
  const previousByNodeId = new Map<
    string,
    { fromNodeId: string; connectionId: string }
  >();

  if (!startId) {
    return { costByNodeId, previousByNodeId };
  }

  costByNodeId.set(startId, createInitialPathTraversalCost());
  const pendingNodeIds = new Set<string>([startId]);

  while (pendingNodeIds.size > 0) {
    let currentNodeId: string | null = null;
    let currentNodeCost: PathTraversalCost | null = null;

    pendingNodeIds.forEach((nodeId) => {
      const candidateCost = costByNodeId.get(nodeId);
      if (!candidateCost) {
        return;
      }

      if (
        !currentNodeId ||
        !currentNodeCost ||
        comparePathTraversalCosts(candidateCost, currentNodeCost) < 0
      ) {
        currentNodeId = nodeId;
        currentNodeCost = candidateCost;
      }
    });

    if (!currentNodeId || !currentNodeCost) {
      break;
    }

    pendingNodeIds.delete(currentNodeId);

    (adjacencyByNodeId.get(currentNodeId) ?? []).forEach((edge) => {
      const nextCost = getNextPathTraversalCost(
        currentNodeCost!,
        edge.connection,
      );
      const existingCost = costByNodeId.get(edge.toNodeId);

      if (
        !existingCost ||
        comparePathTraversalCosts(nextCost, existingCost) < 0
      ) {
        costByNodeId.set(edge.toNodeId, nextCost);
        previousByNodeId.set(edge.toNodeId, {
          fromNodeId: currentNodeId!,
          connectionId: edge.connectionId,
        });
        pendingNodeIds.add(edge.toNodeId);
      }
    });
  }

  return { costByNodeId, previousByNodeId };
};

export const getShortestPathResult = (
  startId: string | undefined,
  targetId: string | undefined,
  adjacencyByNodeId: Map<string, PathTraversalEdge[]>,
) => {
  if (!startId || !targetId) {
    return null;
  }

  const { costByNodeId, previousByNodeId } = computeShortestPathTree(
    startId,
    adjacencyByNodeId,
  );
  const targetCost = costByNodeId.get(targetId);

  if (!targetCost) {
    return null;
  }

  const nodeIds = new Set<string>([targetId]);
  const connectionIds = new Set<string>();
  let currentNodeId = targetId;

  while (currentNodeId !== startId) {
    const previousStep = previousByNodeId.get(currentNodeId);
    if (!previousStep) {
      return null;
    }

    connectionIds.add(previousStep.connectionId);
    nodeIds.add(previousStep.fromNodeId);
    currentNodeId = previousStep.fromNodeId;
  }

  return {
    cost: targetCost,
    nodeIds,
    connectionIds,
  };
};

export const collectShortestTreeConnectionIds = (
  previousByNodeId: Map<string, { fromNodeId: string; connectionId: string }>,
) =>
  new Set(
    Array.from(previousByNodeId.values())
      .map((step) => step.connectionId)
      .filter(Boolean),
  );

export const collectReachableNodeIds = (
  startId: string | undefined,
  adjacency: Map<string, Set<string>>,
  includeStart = true,
) => {
  const visited = new Set<string>();

  if (!startId) {
    return visited;
  }

  const queue = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    adjacency.get(currentId)?.forEach((nextId) => {
      if (visited.has(nextId)) {
        return;
      }

      visited.add(nextId);
      queue.push(nextId);
    });
  }

  if (!includeStart) {
    visited.delete(startId);
  }

  return visited;
};

const isEntranceExitLocationType = (locationType?: string) =>
  locationType === "Exit/Entrance" || locationType === "Entrance/Exit";

const isPlatformLocationType = (locationType?: string) =>
  locationType === "Platform";

const isDetachedConnectionLocationType = (locationType?: string) =>
  locationType === "Detached Connection" ||
  locationType === "Orphan Connection";

export const getAvailableHandleIds = (
  locationType?: string,
  viewMode: ViewMode = "column",
): FlowHandleId[] => {
  if (isDetachedConnectionLocationType(locationType)) {
    return ["left", "right", "top", "bottom"];
  }

  if (viewMode !== "column") {
    return ["left", "right", "top", "bottom"];
  }

  if (isEntranceExitLocationType(locationType)) {
    return ["right"];
  }

  if (isPlatformLocationType(locationType)) {
    return ["left"];
  }

  return ["left", "right"];
};

export const getPreferredHandleId = (
  locationType: string | undefined,
  preferredSide: FlowHandleId,
  viewMode: ViewMode,
): FlowHandleId => {
  const availableHandles = getAvailableHandleIds(locationType, viewMode);
  return availableHandles.includes(preferredSide)
    ? preferredSide
    : availableHandles[0];
};

const getNodePosition = (node?: {
  position?: { x: number; y: number };
  positionAbsolute?: { x: number; y: number };
}) => node?.positionAbsolute ?? node?.position ?? { x: 0, y: 0 };

export const getConnectionHandleIds = (
  sourceNode?: { data?: Record<string, unknown> },
  targetNode?: { data?: Record<string, unknown> },
  viewMode: ViewMode = "column",
) => {
  const sourceData = sourceNode?.data as Partial<CustomNodeData> | undefined;
  const targetData = targetNode?.data as Partial<CustomNodeData> | undefined;

  if (viewMode !== "column") {
    const sourcePosition = getNodePosition(sourceNode as any);
    const targetPosition = getNodePosition(targetNode as any);
    const deltaX = targetPosition.x - sourcePosition.x;
    const deltaY = targetPosition.y - sourcePosition.y;
    const horizontalFlow = Math.abs(deltaX) >= Math.abs(deltaY);

    if (horizontalFlow) {
      return {
        sourceHandle: getPreferredHandleId(
          sourceData?.locationType,
          deltaX >= 0 ? "right" : "left",
          viewMode,
        ),
        targetHandle: getPreferredHandleId(
          targetData?.locationType,
          deltaX >= 0 ? "left" : "right",
          viewMode,
        ),
      };
    }

    return {
      sourceHandle: getPreferredHandleId(
        sourceData?.locationType,
        deltaY >= 0 ? "bottom" : "top",
        viewMode,
      ),
      targetHandle: getPreferredHandleId(
        targetData?.locationType,
        deltaY >= 0 ? "top" : "bottom",
        viewMode,
      ),
    };
  }

  const sourceLayer = Number(sourceData?.layer ?? 1);
  const targetLayer = Number(targetData?.layer ?? 1);
  const movesLeftToRight = sourceLayer <= targetLayer;

  return {
    sourceHandle: getPreferredHandleId(
      sourceData?.locationType,
      movesLeftToRight ? "right" : "left",
      viewMode,
    ),
    targetHandle: getPreferredHandleId(
      targetData?.locationType,
      movesLeftToRight ? "left" : "right",
      viewMode,
    ),
  };
};

const getParallelEdgeOffset = (siblingIndex: number, siblingCount: number) => {
  if (siblingCount <= 1) {
    return 0;
  }

  return (siblingIndex - (siblingCount - 1) / 2) * 24;
};

const getEdgeDirectionVector = (position?: Position) => {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Right:
      return { x: 1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
    default:
      return { x: 0, y: 0 };
  }
};

const getCubicBezierPoint = ({
  t,
  p0,
  p1,
  p2,
  p3,
}: {
  t: number;
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  p3: { x: number; y: number };
}) => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x:
      mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y:
      mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
};

const getAnchoredParallelBezierPath = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  siblingIndex,
  siblingCount,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  siblingIndex: number;
  siblingCount: number;
}) => {
  const offset = getParallelEdgeOffset(siblingIndex, siblingCount);

  if (offset === 0) {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.25,
    });

    return { edgePath, labelX, labelY };
  }

  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const vectorLength = Math.max(Math.hypot(deltaX, deltaY), 1);
  const normalX = (-deltaY / vectorLength) * offset;
  const normalY = (deltaX / vectorLength) * offset;
  const controlDistance = Math.min(Math.max(vectorLength * 0.35, 40), 160);
  const sourceDirection = getEdgeDirectionVector(sourcePosition);
  const targetDirection = getEdgeDirectionVector(targetPosition);

  const p0 = { x: sourceX, y: sourceY };
  const p1 = {
    x: sourceX + sourceDirection.x * controlDistance + normalX,
    y: sourceY + sourceDirection.y * controlDistance + normalY,
  };
  const p2 = {
    x: targetX + targetDirection.x * controlDistance + normalX,
    y: targetY + targetDirection.y * controlDistance + normalY,
  };
  const p3 = { x: targetX, y: targetY };
  const labelPoint = getCubicBezierPoint({
    t: 0.5,
    p0,
    p1,
    p2,
    p3,
  });
  const edgePath = `M ${p0.x},${p0.y} C ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;

  return {
    edgePath,
    labelX: labelPoint.x,
    labelY: labelPoint.y,
  };
};

const getEdgePillLabel = ({
  typeLabel,
  pairConnectionCount,
  siblingIndex,
  typeConnectionCount,
  edgeLabelMode,
  connection,
}: {
  typeLabel?: string;
  pairConnectionCount?: number;
  siblingIndex?: number;
  typeConnectionCount: number;
  edgeLabelMode: EdgeLabelMode;
  connection?: any | null;
}) => {
  if ((pairConnectionCount ?? 0) > 1) {
    if ((siblingIndex ?? 0) > 0) {
      return "";
    }

    return String(pairConnectionCount);
  }

  if (typeConnectionCount > 1) {
    return String(typeConnectionCount);
  }

  if (edgeLabelMode === "time") {
    const rawTraversalTime = connection?.traversal_time;

    if (
      rawTraversalTime === null ||
      rawTraversalTime === undefined ||
      rawTraversalTime === ""
    ) {
      return "None";
    }

    const traversalTime = Number(rawTraversalTime);

    return Number.isFinite(traversalTime) && traversalTime >= 0
      ? `${traversalTime}s`
      : "None";
  }

  return typeLabel ?? "";
};

const getLabelHorizontalOffset = (
  siblingIndex: number,
  siblingCount: number,
) => {
  if (siblingCount <= 1) {
    return 0;
  }

  return (siblingIndex - (siblingCount - 1) / 2) * 52;
};

const getContrastingTextColor = (hexColor: string) => {
  const normalized = hexColor.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const red = parseInt(fullHex.slice(0, 2), 16);
  const green = parseInt(fullHex.slice(2, 4), 16);
  const blue = parseInt(fullHex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.6 ? "#111111" : "#ffffff";
};

export const getEdgeLabelStyles = ({ edgeColor }: { edgeColor: string }) => ({
  labelStyle: {
    color: getContrastingTextColor(edgeColor),
    fontWeight: 700,
    fontSize: 12,
  },
  labelBgStyle: {
    backgroundColor: edgeColor,
    color: getContrastingTextColor(edgeColor),
    border: "1px solid rgba(255,255,255,0.15)",
  },
});

export const getConnectionId = (connection: any) =>
  connection?.pathway_id !== null && connection?.pathway_id !== undefined
    ? String(connection.pathway_id)
    : null;

export const isBidirectionalConnection = (connection: any) =>
  connection?.direction_type === "bidirectional" ||
  Number(connection?.is_bidirectional) === 1;

export const getEdgeMarkerProps = ({
  edgeColor,
  connections,
  displaySourceId,
  displayTargetId,
}: {
  edgeColor: string;
  connections: any[];
  displaySourceId: string;
  displayTargetId: string;
}) => {
  const marker = {
    type: MarkerType.ArrowClosed,
    color: edgeColor,
    width: 18,
    height: 18,
  };
  const hasForwardDirection = connections.some((connection) => {
    if (isBidirectionalConnection(connection)) {
      return true;
    }

    return (
      String(connection?.from_stop_id) === displaySourceId &&
      String(connection?.to_stop_id) === displayTargetId
    );
  });
  const hasReverseDirection = connections.some((connection) => {
    if (isBidirectionalConnection(connection)) {
      return true;
    }

    return (
      String(connection?.from_stop_id) === displayTargetId &&
      String(connection?.to_stop_id) === displaySourceId
    );
  });

  return {
    markerStart: hasReverseDirection ? marker : undefined,
    markerEnd: hasForwardDirection ? marker : undefined,
  };
};

export const getMultiConnectionEdgeColor = (theme: string) =>
  theme === "dark" ? "#f3b54a" : "#b66b16";

const NODE_LAYOUT_MIN_X = 148;
const NODE_LAYOUT_MIN_Y = 118;

export const parseCoordinate = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const hasUsableLatLon = (lat: unknown, lon: unknown) => {
  const parsedLat = parseCoordinate(lat);
  const parsedLon = parseCoordinate(lon);

  return (
    parsedLat !== null &&
    parsedLon !== null &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180 &&
    !(parsedLat === 0 && parsedLon === 0)
  );
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const resolveNodeOverlaps = ({
  nodes,
  minDistanceX = NODE_LAYOUT_MIN_X,
  minDistanceY = NODE_LAYOUT_MIN_Y,
  lockXAxis = false,
  bounds,
}: {
  nodes: Node[];
  minDistanceX?: number;
  minDistanceY?: number;
  lockXAxis?: boolean;
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}) => {
  const adjustedNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x,
      y: node.position.y,
    },
  }));

  const minimumDistance = Math.max(minDistanceX, minDistanceY);

  for (let iteration = 0; iteration < 48; iteration += 1) {
    let moved = false;

    for (let index = 0; index < adjustedNodes.length; index += 1) {
      for (
        let compareIndex = index + 1;
        compareIndex < adjustedNodes.length;
        compareIndex += 1
      ) {
        const firstNode = adjustedNodes[index];
        const secondNode = adjustedNodes[compareIndex];
        const deltaX = secondNode.position.x - firstNode.position.x;
        const deltaY = secondNode.position.y - firstNode.position.y;
        const distance = Math.hypot(deltaX, deltaY);

        if (lockXAxis) {
          const overlapY = minDistanceY - Math.abs(deltaY);

          if (overlapY <= 0) {
            continue;
          }

          moved = true;
          const pushY = overlapY / 2 + 6;
          const directionY = deltaY >= 0 ? 1 : -1;
          firstNode.position.y -= pushY * directionY;
          secondNode.position.y += pushY * directionY;
        } else {
          if (distance >= minimumDistance) {
            continue;
          }

          moved = true;
          const safeDistance = distance || 0.001;
          const pushDistance = (minimumDistance - safeDistance) / 2 + 8;
          const directionX = deltaX / safeDistance;
          const directionY = deltaY / safeDistance;

          firstNode.position.x -= directionX * pushDistance;
          firstNode.position.y -= directionY * pushDistance;
          secondNode.position.x += directionX * pushDistance;
          secondNode.position.y += directionY * pushDistance;
        }

        if (bounds) {
          firstNode.position.x = clamp(
            firstNode.position.x,
            bounds.minX,
            bounds.maxX,
          );
          firstNode.position.y = clamp(
            firstNode.position.y,
            bounds.minY,
            bounds.maxY,
          );
          secondNode.position.x = clamp(
            secondNode.position.x,
            bounds.minX,
            bounds.maxX,
          );
          secondNode.position.y = clamp(
            secondNode.position.y,
            bounds.minY,
            bounds.maxY,
          );
        }
      }
    }

    if (!moved) {
      break;
    }
  }

  return adjustedNodes;
};

export const PATHWAY_MODE_OPTIONS = [
  { value: 1, label: "Walkway" },
  { value: 2, label: "Stairs" },
  { value: 3, label: "Moving sidewalk/travelator" },
  { value: 4, label: "Escalator" },
  { value: 5, label: "Elevator" },
  { value: 6, label: "Fare gate" },
  { value: 7, label: "Exit gate" },
] as const;

export const DIRECTION_OPTIONS = [
  { value: 0, label: "Directional (one-way)" },
  { value: 1, label: "Bidirectional (two-way)" },
] as const;

const PATHWAY_MODE_LABELS = new Map<number, string>(
  PATHWAY_MODE_OPTIONS.map((option) => [option.value, option.label]),
);

const DECIMAL_SEPARATOR_PATTERN = /[.,،٫﹐﹒．，。､]/g;
const UNICODE_MINUS_PATTERN = /[−﹣－]/g;

export const DECIMAL_EDGE_FORM_FIELDS = new Set<keyof EdgeFormValues>([
  "length",
  "max_slope",
  "min_width",
]);

export const EDGE_OPTIONAL_FIELDS: Array<{
  key: EdgeOptionalFieldKey;
  label: string;
  type: "number" | "text";
  min?: string;
  step?: string;
  inputMode?: React.ComponentProps<"input">["inputMode"];
}> = [
  {
    key: "stair_count",
    label: "Stair Count",
    type: "number",
    step: "1",
  },
  {
    key: "max_slope",
    label: "Max Slope",
    type: "text",
    step: "0.01",
    inputMode: "decimal",
  },
  {
    key: "min_width",
    label: "Min Width",
    type: "text",
    min: "0",
    step: "0.01",
    inputMode: "decimal",
  },
  {
    key: "signposted_as",
    label: "Signposted As",
    type: "text",
  },
  {
    key: "reversed_signposted_as",
    label: "Reversed Signposted As",
    type: "text",
  },
];

export const normalizeOptionalInteger = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeDecimalInputString = (value: string) => {
  const normalized = String(value)
    .normalize("NFKC")
    .replace(UNICODE_MINUS_PATTERN, "-")
    .replace(/\s+/g, "");

  if (normalized === "") {
    return "";
  }

  const separatorMatches = Array.from(
    normalized.matchAll(DECIMAL_SEPARATOR_PATTERN),
  );
  const lastSeparatorIndex = separatorMatches.at(-1)?.index ?? -1;
  const beforeSeparator =
    lastSeparatorIndex >= 0
      ? normalized.slice(0, lastSeparatorIndex)
      : normalized;
  const afterSeparator =
    lastSeparatorIndex >= 0 ? normalized.slice(lastSeparatorIndex + 1) : "";
  const sign = beforeSeparator.trim().startsWith("-")
    ? "-"
    : beforeSeparator.trim().startsWith("+")
      ? "+"
      : "";
  const integerDigits = beforeSeparator.replace(/[^\d]/g, "");
  const fractionalDigits = afterSeparator.replace(/[^\d]/g, "");

  if (lastSeparatorIndex >= 0) {
    if (integerDigits === "" && fractionalDigits === "" && sign === "") {
      return "";
    }

    return `${sign}${integerDigits}.${fractionalDigits}`;
  }

  return `${sign}${integerDigits}`;
};

export const normalizeOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const normalizedValue = normalizeDecimalInputString(String(value));
  if (
    normalizedValue === "" ||
    normalizedValue === "." ||
    normalizedValue === "-" ||
    normalizedValue === "-."
  ) {
    return null;
  }

  const parsed = parseFloat(normalizedValue);
  return Number.isNaN(parsed) ? null : parsed;
};

export const normalizeOptionalString = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

export const createInitialEdgeFormValues = (
  connection?: any | null,
): EdgeFormValues => ({
  from_stop_id:
    connection?.from_stop_id === null || connection?.from_stop_id === undefined
      ? ""
      : String(connection.from_stop_id),
  to_stop_id:
    connection?.to_stop_id === null || connection?.to_stop_id === undefined
      ? ""
      : String(connection.to_stop_id),
  pathway_mode: String(
    connection?.pathway_mode ?? PATHWAY_MODE_OPTIONS[0].value,
  ),
  is_bidirectional: String(
    connection?.is_bidirectional ??
      (connection?.direction_type === "bidirectional"
        ? DIRECTION_OPTIONS[1].value
        : DIRECTION_OPTIONS[0].value),
  ),
  traversal_time:
    connection?.traversal_time === null ||
    connection?.traversal_time === undefined
      ? ""
      : String(connection.traversal_time),
  length:
    connection?.length === null || connection?.length === undefined
      ? ""
      : String(connection.length),
  stair_count:
    connection?.stair_count === null || connection?.stair_count === undefined
      ? ""
      : String(connection.stair_count),
  max_slope:
    connection?.max_slope === null || connection?.max_slope === undefined
      ? ""
      : String(connection.max_slope),
  min_width:
    connection?.min_width === null || connection?.min_width === undefined
      ? ""
      : String(connection.min_width),
  signposted_as: connection?.signposted_as ?? "",
  reversed_signposted_as: connection?.reversed_signposted_as ?? "",
});

export const getPathwayTypeLabel = (connection: any) => {
  if (connection?.pathway_mode_name) {
    return String(connection.pathway_mode_name);
  }

  const numericMode = Number(connection?.pathway_mode);
  return PATHWAY_MODE_LABELS.get(numericMode) ?? "❓";
};

export const getConnectionTypeKey = (connection: any) => {
  const typeLabel = getPathwayTypeLabel(connection);
  const numericMode = connection?.pathway_mode ?? "";
  return `${typeLabel}::${numericMode}`;
};

export const getCanonicalPairNodeIds = (
  firstStopId: string,
  secondStopId: string,
): [string, string] => {
  const normalizedFirstStopId = String(firstStopId);
  const normalizedSecondStopId = String(secondStopId);

  return normalizedFirstStopId.localeCompare(normalizedSecondStopId) <= 0
    ? [normalizedFirstStopId, normalizedSecondStopId]
    : [normalizedSecondStopId, normalizedFirstStopId];
};

export const getCanonicalPairKey = (firstStopId: string, secondStopId: string) => {
  const [sourceStopId, targetStopId] = getCanonicalPairNodeIds(
    firstStopId,
    secondStopId,
  );

  return `${sourceStopId}::${targetStopId}`;
};

export const sortConnections = (connections: any[]) =>
  [...connections].sort((left, right) => {
    const typeCompare = getPathwayTypeLabel(left).localeCompare(
      getPathwayTypeLabel(right),
    );

    if (typeCompare !== 0) {
      return typeCompare;
    }

    return String(left?.pathway_id ?? "").localeCompare(
      String(right?.pathway_id ?? ""),
    );
  });

export const edgeMatchesCanonicalPair = (
  edge: Edge | null | undefined,
  firstStopId?: string | null,
  secondStopId?: string | null,
) => {
  if (!edge || !firstStopId || !secondStopId) {
    return false;
  }

  return (
    getCanonicalPairKey(edge.source, edge.target) ===
    getCanonicalPairKey(firstStopId, secondStopId)
  );
};

export const isWheelchairAccessibleConnection = (connection: any) => {
  const pathwayMode = Number(connection?.pathway_mode);
  const pathwayModeName = String(
    connection?.pathway_mode_name ?? "",
  ).toLowerCase();

  if (pathwayMode === 2 || pathwayMode === 4) {
    return false;
  }

  if (
    pathwayModeName.includes("stairs") ||
    pathwayModeName.includes("escalator")
  ) {
    return false;
  }

  return true;
};

export const isWheelchairAccessibleStop = (stop: any) => {
  const wheelchairStatus = String(
    stop?.wheelchair_status ?? stop?.wheelchairStatus ?? "",
  ).trim();

  return (
    wheelchairStatus === "🟢" ||
    wheelchairStatus === "1" ||
    wheelchairStatus.toLowerCase() === "accessible"
  );
};

export const isModifiedConnectionStatus = (status?: string | null) =>
  status === "edit" || status === "new" || status === "new edit";

export const isNewConnectionStatus = (status?: string | null) =>
  status === "new" || status === "new edit";

export const getConnectionStatusLabel = (status?: string | null) => {
  switch (status) {
    case "edit":
      return "Edited Existing Connection";
    case "new":
    case "new edit":
      return "New Connection";
    default:
      return "Original";
  }
};

export const getConnectionDirectionSummary = (connection: any) => {
  const fromStopId =
    connection?.from_stop_id != null
      ? String(connection.from_stop_id)
      : "Unknown";
  const toStopId =
    connection?.to_stop_id != null ? String(connection.to_stop_id) : "Unknown";

  if (isBidirectionalConnection(connection)) {
    return {
      badgeLabel: "Bidirectional",
      routeLabel: `${fromStopId} ↔ ${toStopId}`,
    };
  }

  return {
    badgeLabel: "From → To",
    routeLabel: `${fromStopId} → ${toStopId}`,
  };
};

export const getDetachedConnectionDraftConnection = (
  draft: DetachedConnectionDraft,
  options?: {
    includeOriginalEndpointFallback?: boolean;
  },
) => {
  const includeOriginalEndpointFallback =
    options?.includeOriginalEndpointFallback ?? true;

  return {
    ...draft.connection,
    from_stop_id:
      draft.fromStopId ??
      (includeOriginalEndpointFallback ? draft.connection.from_stop_id : null),
    to_stop_id:
      draft.toStopId ??
      (includeOriginalEndpointFallback ? draft.connection.to_stop_id : null),
  };
};

export const getSortedConnectionsFromEdge = (
  edge: Edge | null | undefined,
) => {
  if (!edge) {
    return [];
  }

  const edgeData = (edge.data ?? {}) as PathwayEdgeData;
  return sortConnections(
    (edgeData.allPairConnections ??
      edgeData.pairConnections ??
      edgeData.connections ??
      []) as any[],
  );
};

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  markerStart,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  data,
}: EdgeProps) => {
  const edgeData = (data ?? {}) as PathwayEdgeData;
  const edgeConnections = (edgeData.connections ??
    edgeData.pairConnections ??
    []) as any[];
  const siblingIndex = Number(edgeData.siblingIndex ?? 0);
  const siblingCount = Number(edgeData.siblingCount ?? 1);
  const typeConnectionCount = Number(edgeData.typeConnectionCount ?? 1);
  const typeLabel =
    typeof edgeData.typeLabel === "string" ? edgeData.typeLabel : "";
  const isDimmed = Boolean(edgeData.isDimmed);
  const isPopupSelected = Boolean(edgeData.isPopupSelected);
  const popupSelectionColor =
    edgeData.popupSelectionColor ??
    (typeof style?.stroke === "string" ? style.stroke : "#2563eb");
  const edgeLabelMode = edgeData.edgeLabelMode ?? "type";
  const singleConnection =
    edgeConnections.length === 1 ? edgeConnections[0] : null;
  const primaryLabel = getEdgePillLabel({
    typeLabel,
    pairConnectionCount: edgeData.pairConnectionCount,
    siblingIndex,
    typeConnectionCount,
    edgeLabelMode,
    connection: singleConnection,
  });
  const showConnectionStatusBadge =
    Boolean(primaryLabel) &&
    Boolean(singleConnection) &&
    isModifiedConnectionStatus(singleConnection?.status);
  const isNewConnectionBadge =
    Boolean(singleConnection) &&
    isNewConnectionStatus(singleConnection?.status);
  const { edgePath, labelX, labelY } = getAnchoredParallelBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    siblingIndex,
    siblingCount,
  });
  const labelHorizontalOffset = getLabelHorizontalOffset(
    siblingIndex,
    siblingCount,
  );
  const baseStrokeWidth = Number(
    typeof style?.strokeWidth === "number" ? style.strokeWidth : 2,
  );
  const selectedEdgeStrokeWidth = baseStrokeWidth + 2;

  return (
    <>
      {isPopupSelected ? (
        <>
          <BaseEdge
            id={`${id}-selection`}
            path={edgePath}
            markerEnd={undefined}
            markerStart={undefined}
            className="pathway-flow-selected-edge-glow"
            style={{
              stroke: popupSelectionColor,
              strokeWidth: selectedEdgeStrokeWidth + 5,
              opacity: isDimmed ? 0.28 : 0.44,
              filter: "blur(3px)",
              strokeLinecap: "round",
            }}
          />
          <BaseEdge
            id={`${id}-selection-core`}
            path={edgePath}
            markerEnd={undefined}
            markerStart={undefined}
            className="pathway-flow-selected-edge-core"
            style={{
              stroke: popupSelectionColor,
              strokeWidth: selectedEdgeStrokeWidth + 2,
              opacity: isDimmed ? 0.5 : 1,
              strokeLinecap: "round",
            }}
          />
          <BaseEdge
            id={`${id}-selection-loading`}
            path={edgePath}
            markerEnd={undefined}
            markerStart={undefined}
            className="pathway-flow-selected-edge-loading"
            style={{
              stroke: popupSelectionColor,
              strokeWidth: selectedEdgeStrokeWidth + 1,
              opacity: isDimmed ? 0.58 : 1,
              strokeLinecap: "round",
              strokeDasharray: "16 6",
              animation: "selected-edge-dash 0.82s linear infinite",
            }}
          />
        </>
      ) : null}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        className={isPopupSelected ? "pathway-flow-selected-edge-main" : undefined}
        style={
          isPopupSelected
            ? {
                ...style,
                stroke: popupSelectionColor,
                strokeWidth: selectedEdgeStrokeWidth,
                opacity: isDimmed ? 0.82 : 1,
                strokeLinecap: "round",
              }
            : style
        }
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX + labelHorizontalOffset}px,${labelY}px)`,
            pointerEvents: isDimmed ? "none" : "all",
            opacity: isDimmed ? 0.08 : 1,
          }}
        >
          {primaryLabel && (
            <div
              className="text-xs font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1"
              style={{
                ...labelBgStyle,
                ...labelStyle,
                boxShadow: isPopupSelected
                  ? `0 0 0 3px ${popupSelectionColor}88, 0 0 0 8px ${popupSelectionColor}24, 0 14px 24px rgba(15, 23, 42, 0.28)`
                  : undefined,
                animation: isPopupSelected
                  ? "selected-edge-pill-pulse 1.35s ease-in-out infinite"
                  : undefined,
                backgroundColor:
                  (labelBgStyle as React.CSSProperties | undefined)
                    ?.backgroundColor ?? "hsl(var(--background))",
                padding: labelBgPadding
                  ? `${labelBgPadding[0]}px ${labelBgPadding[1]}px`
                  : "2px 8px",
              }}
            >
              <span>{primaryLabel}</span>
              {showConnectionStatusBadge ? (
                <span
                  className="text-[11px] leading-none"
                  title={getConnectionStatusLabel(singleConnection?.status)}
                  aria-label={getConnectionStatusLabel(
                    singleConnection?.status,
                  )}
                >
                  {isNewConnectionBadge ? (
                    <Plus className="h-3 w-3" />
                  ) : (
                    <Edit className="h-3 w-3" />
                  )}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const CustomNode = ({ data }: { data: CustomNodeData }) => {
  const isDetachedConnectionNode = Boolean(data.isDetachedConnectionNode);
  const isPathwayNode = data.layer === 1 && !isDetachedConnectionNode;
  const isDetachedConnectionEditing = Boolean(data.isDetachedConnectionEditing);
  const detachedTypeColor = data.detachedTypeColor ?? data.color;
  const isPopupSelected = Boolean(data.isPopupSelected);
  const popupSelectionColor = data.popupSelectionColor ?? data.color;
  const routeBadges = [
    data.isSelectedFrom
      ? {
          key: "from",
          label: "From",
          className:
            "bg-emerald-600/95 text-white border-emerald-300/60 dark:border-emerald-200/30",
        }
      : null,
    data.isSelectedTo
      ? {
          key: "to",
          label: "To",
          className:
            "bg-sky-600/95 text-white border-sky-300/60 dark:border-sky-200/30",
        }
      : null,
  ].filter(
    (badge): badge is { key: string; label: string; className: string } =>
      badge !== null,
  );
  const handleIds = getAvailableHandleIds(
    data.locationType,
    data.viewMode ?? "column",
  );
  const detachedShape =
    "polygon(14% 0, 86% 0, 100% 26%, 100% 74%, 86% 100%, 14% 100%, 0 74%, 0 26%)";

  const getHandlePosition = (handleId: FlowHandleId) => {
    switch (handleId) {
      case "left":
        return Position.Left;
      case "right":
        return Position.Right;
      case "top":
        return Position.Top;
      case "bottom":
        return Position.Bottom;
      default:
        return Position.Right;
    }
  };

  const getHandleClassName = (handleId: FlowHandleId) => {
    switch (handleId) {
      case "left":
        return "!-left-2";
      case "right":
        return "!-right-2";
      case "top":
        return "!-top-2";
      case "bottom":
        return "!-bottom-2";
      default:
        return "";
    }
  };

  return (
    <div
      className={
        isDetachedConnectionNode
          ? "detached-connection-node min-w-[7.25rem] min-h-[6.5rem] max-w-[9.5rem] relative overflow-visible cursor-grab active:cursor-grabbing"
          : "group min-w-[5.75rem] min-h-[5.75rem] max-w-[8.5rem] rounded-full shadow-md border-2 bg-card text-card-foreground flex flex-col items-center justify-center relative cursor-grab active:cursor-grabbing px-3 py-3 text-center"
      }
      style={{
        borderColor: isDetachedConnectionNode
          ? undefined
          : isPopupSelected
            ? popupSelectionColor
            : data.color,
        aspectRatio: isDetachedConnectionNode ? "1.14 / 1" : "1 / 1",
        opacity: data.isDimmed ? 0.16 : 1,
        boxShadow: isPopupSelected
          ? `0 0 0 4px ${popupSelectionColor}88, 0 0 0 10px ${popupSelectionColor}24, 0 18px 34px rgba(15, 23, 42, 0.28)`
          : undefined,
        animation: isPopupSelected
          ? "selected-node-core-pulse 1.2s ease-in-out infinite"
          : undefined,
        transition:
          "opacity 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      }}
    >
      {isPopupSelected ? (
        <>
          <div
            className="pointer-events-none absolute -inset-4 rounded-full"
            style={{
              background: `radial-gradient(circle, ${popupSelectionColor}22 0%, ${popupSelectionColor}10 48%, transparent 72%)`,
              filter: "blur(8px)",
            }}
          />
          <div
            className="pointer-events-none absolute -inset-3 rounded-full border-2"
            style={{
              borderColor: `${popupSelectionColor}cc`,
              boxShadow: `0 0 0 8px ${popupSelectionColor}20`,
              animation: "selected-node-halo 1.4s ease-out infinite",
            }}
          />
        </>
      ) : null}

      {!isDetachedConnectionNode ? (
        <div
          className={`pointer-events-none absolute -inset-2 rounded-full border-2 transition-all duration-150 ${
            isPopupSelected ? "opacity-0" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{
            borderColor: `${data.color}aa`,
            boxShadow: `0 0 0 6px ${data.color}22`,
          }}
        />
      ) : null}

      {routeBadges.length > 0 ? (
        <div className="pointer-events-none absolute -top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1">
          {routeBadges.map((badge) => (
            <span
              key={badge.key}
              className={`rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] shadow-sm ${badge.className}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {isDetachedConnectionNode ? (
        <div
          className="absolute inset-0 pointer-events-none detached-connection-shell"
          style={{
            clipPath: detachedShape,
            background:
              "linear-gradient(135deg, #f97316 0%, #fdba74 35%, #facc15 52%, #fb923c 72%, #f97316 100%)",
            backgroundSize: "220% 220%",
            animation: isDetachedConnectionEditing
              ? "detached-connection-border-shift 1.35s linear infinite"
              : "detached-connection-border-pulse 1.9s ease-in-out infinite",
          }}
        />
      ) : null}

      {handleIds.map((handleId) => {
        const sharedHandleProps = {
          position: getHandlePosition(handleId),
          id: handleId,
          isConnectableStart: true,
          isConnectableEnd: true,
          className: `!z-20 ${isDetachedConnectionNode ? "!w-5 !h-5" : "!w-4 !h-4"} ${getHandleClassName(handleId)}`,
          style: {
            background: isDetachedConnectionNode
              ? detachedTypeColor
              : data.color,
            border: "2px solid white",
            boxShadow: isDetachedConnectionNode
              ? "0 0 0 3px rgba(15, 23, 42, 0.15)"
              : undefined,
          },
        } as const;

        return (
          <Fragment key={handleId}>
            <Handle type="target" {...sharedHandleProps} />
            <Handle type="source" {...sharedHandleProps} />
          </Fragment>
        );
      })}

      <div
        className={
          isDetachedConnectionNode
            ? "absolute inset-[3px] z-10 pointer-events-none bg-card/95 text-card-foreground flex w-auto flex-col items-center justify-center gap-1 px-3 py-3 text-center"
            : "flex w-full flex-col items-center justify-center gap-0.5 px-1 text-center"
        }
        style={{
          clipPath: isDetachedConnectionNode ? detachedShape : undefined,
          border: isDetachedConnectionNode
            ? "1px solid rgba(255,255,255,0.25)"
            : undefined,
        }}
      >
        <div className="text-[8px] font-semibold text-muted-foreground uppercase tracking-tight flex items-center justify-center gap-0.5 whitespace-normal break-words leading-tight">
          {data.locationType}
          {data.status && data.status !== "" && (
            <EditIndicator status={data.status} className="h-2 w-2" />
          )}
        </div>
        {isDetachedConnectionNode ? (
          <>
            <div
              className="rounded-full px-2 py-0.5 text-[8px] font-semibold leading-tight"
              style={{
                backgroundColor: `${detachedTypeColor}22`,
                color: detachedTypeColor,
              }}
              title={data.label}
            >
              {data.label}
            </div>
            <div
              className="text-[7px] text-muted-foreground font-mono whitespace-normal break-all leading-tight max-w-full"
              title={data.stopId}
            >
              {data.stopId}
            </div>
            <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-orange-600 dark:text-orange-300">
              {isDetachedConnectionEditing
                ? "Editing Connection"
                : `${data.detachedConnectionCount ?? 0} / 2 Nodes Connected`}
            </div>
            {data.detachedEndpointSummary ? (
              <div className="text-[7px] text-muted-foreground leading-tight whitespace-normal break-words">
                {data.detachedEndpointSummary}
              </div>
            ) : null}
          </>
        ) : isPathwayNode ? (
          <div
            className="text-[9px] text-muted-foreground font-mono whitespace-normal break-all leading-tight max-w-full"
            title={data.stopId}
          >
            {data.stopId}
          </div>
        ) : (
          <>
            <div
              className="font-semibold text-[9px] leading-tight whitespace-normal break-words max-w-full"
              title={data.label}
            >
              {data.label}
            </div>
            <div
              className="text-[7px] text-muted-foreground font-mono whitespace-normal break-all leading-tight max-w-full"
              title={data.stopId}
            >
              {data.stopId}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

type FlowPopupPanelProps = {
  borderColor: string;
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleAccent?: ReactNode;
  headerPrefix?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  fillHeight?: boolean;
};

export const FlowPopupPanel = ({
  borderColor,
  title,
  subtitle,
  subtitleAccent,
  headerPrefix,
  headerActions,
  children,
  fillHeight = false,
}: FlowPopupPanelProps) => (
  <div
    className={`w-full bg-card border-2 rounded-lg shadow-xl overflow-hidden flex flex-col min-h-0 max-h-[70vh] ${
      fillHeight ? "md:h-full" : ""
    } md:max-h-full`}
    style={{ borderColor }}
  >
    <div className="flex items-start justify-between gap-2 p-4 pb-3 shrink-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {headerPrefix}
          <h3 className="font-bold text-sm">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {subtitleAccent && subtitleAccent}
      </div>
      {headerActions}
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 pr-3">
      {children}
    </div>
  </div>
);
