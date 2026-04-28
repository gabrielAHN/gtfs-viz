import type { Edge, Node } from "@xyflow/react";

import {
  getConnectionHandleIds,
  hasUsableLatLon,
  parseCoordinate,
  resolveNodeOverlaps,
} from "../core/shared";
import type { ViewMode } from "../core/types";

export function buildLayoutedFlowGraph({
  initialNodes,
  initialEdges,
  viewMode,
  manualNodePositions,
  preserveManualPositions,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
  viewMode: ViewMode;
  manualNodePositions: Map<string, { x: number; y: number }>;
  preserveManualPositions: boolean;
}) {
  const validNodeIds = new Set(initialNodes.map((node) => node.id));
  const nextManualNodePositions = new Map(
    Array.from(manualNodePositions.entries()).filter(([nodeId]) =>
      validNodeIds.has(nodeId),
    ),
  );

  const connectionCounts = new Map<string, number>();
  initialNodes.forEach((node) => connectionCounts.set(node.id, 0));

  initialEdges.forEach((edge) => {
    connectionCounts.set(
      edge.source,
      (connectionCounts.get(edge.source) || 0) + 1,
    );
    connectionCounts.set(
      edge.target,
      (connectionCounts.get(edge.target) || 0) + 1,
    );
  });

  const entranceExits: Node[] = [];
  const platforms: Node[] = [];
  const pathwayNodes: Node[] = [];
  const others: Node[] = [];

  initialNodes.forEach((node) => {
    if (node.data.layer === 0) {
      entranceExits.push(node);
    } else if (node.data.layer === 2) {
      platforms.push(node);
    } else {
      const locationType = node.data.locationType;
      if (locationType === "Pathway Node" || locationType === "Generic Node") {
        pathwayNodes.push(node);
      } else {
        others.push(node);
      }
    }
  });

  const sortNodesByStopId = (left: Node, right: Node) =>
    String(left.id).localeCompare(String(right.id));

  const sortedEntranceExits = [...entranceExits].sort(sortNodesByStopId);
  const sortedPlatforms = [...platforms].sort(sortNodesByStopId);
  const sortedPathwayNodes = [...pathwayNodes].sort((a, b) => {
    const countA = connectionCounts.get(a.id) || 0;
    const countB = connectionCounts.get(b.id) || 0;

    if (countA !== countB) {
      return countB - countA;
    }

    return sortNodesByStopId(a, b);
  });
  const sortedOtherMiddleNodes = [...others].sort((a, b) => {
    const typeCompare = String(a.data.locationType ?? "").localeCompare(
      String(b.data.locationType ?? ""),
    );

    if (typeCompare !== 0) {
      return typeCompare;
    }

    return sortNodesByStopId(a, b);
  });

  const middleNodes = [...sortedPathwayNodes, ...sortedOtherMiddleNodes];

  const withNodeMeta = (
    node: Node,
    fallbackPosition: { x: number; y: number },
    extraData: Record<string, unknown> = {},
  ) => ({
    ...node,
    position: fallbackPosition,
    data: {
      ...node.data,
      viewMode,
      connectionCount: connectionCounts.get(node.id) || 0,
      ...extraData,
    },
  });

  let layoutedNodes: Node[] = [];

  if (viewMode === "column") {
    const startX = 100;
    const startY = 100;
    const verticalSpacing = 128;
    const leftX = startX;
    const middleStartX = startX + 360;
    const middleColumnSpacing = 220;
    const middleRowsPerColumn = 8;
    const middleColumnCount = Math.max(
      1,
      Math.ceil(middleNodes.length / middleRowsPerColumn),
    );
    const rightX =
      middleStartX + middleColumnSpacing * middleColumnCount + 180;

    sortedEntranceExits.forEach((node, index) => {
      layoutedNodes.push(
        withNodeMeta(node, {
          x: leftX,
          y: startY + index * verticalSpacing,
        }),
      );
    });

    middleNodes.forEach((node, index) => {
      const middleColumnIndex = Math.floor(index / middleRowsPerColumn);
      const rowIndex = index % middleRowsPerColumn;

      layoutedNodes.push(
        withNodeMeta(node, {
          x: middleStartX + middleColumnIndex * middleColumnSpacing,
          y: startY + rowIndex * verticalSpacing,
        }),
      );
    });

    sortedPlatforms.forEach((node, index) => {
      layoutedNodes.push(
        withNodeMeta(node, {
          x: rightX,
          y: startY + index * verticalSpacing,
        }),
      );
    });
  } else {
    const mapLeft = 100;
    const mapTop = 80;
    const mapWidth = 980;
    const mapHeight = 760;
    const sideStartX = mapLeft + mapWidth + 180;
    const sideStartY = mapTop;
    const sideColumnWidth = 210;
    const sideRowSpacing = 150;
    const nodesPerSideColumn = 5;

    const positionedNodes: Array<{
      node: Node;
      lat: number;
      lon: number;
    }> = [];
    const sideNodes: Node[] = [];

    initialNodes.forEach((node) => {
      const lat = parseCoordinate(node.data.stopLat);
      const lon = parseCoordinate(node.data.stopLon);

      if (lat !== null && lon !== null && hasUsableLatLon(lat, lon)) {
        positionedNodes.push({ node, lat, lon });
        return;
      }

      sideNodes.push(node);
    });

    if (positionedNodes.length > 0) {
      const latitudes = positionedNodes.map((entry) => entry.lat);
      const longitudes = positionedNodes.map((entry) => entry.lon);
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLon = Math.min(...longitudes);
      const maxLon = Math.max(...longitudes);
      const latSpan = maxLat - minLat;
      const lonSpan = maxLon - minLon;

      const projectedNodes = positionedNodes.map(({ node, lat, lon }) => {
        const normalizedX = lonSpan === 0 ? 0.5 : (lon - minLon) / lonSpan;
        const normalizedY = latSpan === 0 ? 0.5 : (maxLat - lat) / latSpan;

        return withNodeMeta(node, {
          x: mapLeft + normalizedX * mapWidth,
          y: mapTop + normalizedY * mapHeight,
        });
      });

      layoutedNodes.push(
        ...resolveNodeOverlaps({
          nodes: projectedNodes,
          minDistanceX: 170,
          minDistanceY: 152,
          bounds: {
            minX: mapLeft,
            maxX: mapLeft + mapWidth,
            minY: mapTop,
            maxY: mapTop + mapHeight,
          },
        }),
      );
    }

    sideNodes
      .sort((left, right) => {
        const layerCompare =
          Number(left.data.layer ?? 0) - Number(right.data.layer ?? 0);

        if (layerCompare !== 0) {
          return layerCompare;
        }

        const countCompare =
          (connectionCounts.get(right.id) || 0) -
          (connectionCounts.get(left.id) || 0);

        if (countCompare !== 0) {
          return countCompare;
        }

        return String(left.id).localeCompare(String(right.id));
      })
      .forEach((node, index) => {
        const columnIndex = Math.floor(index / nodesPerSideColumn);
        const rowIndex = index % nodesPerSideColumn;

        layoutedNodes.push(
          withNodeMeta(node, {
            x: sideStartX + columnIndex * sideColumnWidth,
            y: sideStartY + rowIndex * sideRowSpacing,
          }),
        );
      });
  }

  if (preserveManualPositions) {
    layoutedNodes = layoutedNodes.map((node) => {
      const savedPosition = nextManualNodePositions.get(node.id);

      if (!savedPosition) {
        return node;
      }

      return {
        ...node,
        position: {
          x: savedPosition.x,
          y: savedPosition.y,
        },
      };
    });
  }

  const layoutedNodeIds = new Set(layoutedNodes.map((node) => node.id));
  const layoutedNodesById = new Map(
    layoutedNodes.map((node) => [node.id, node]),
  );
  const validEdges = initialEdges
    .filter(
      (edge) =>
        layoutedNodeIds.has(edge.source) && layoutedNodeIds.has(edge.target),
    )
    .map((edge) => {
      const sourceNode = layoutedNodesById.get(edge.source);
      const targetNode = layoutedNodesById.get(edge.target);

      if (!sourceNode || !targetNode) {
        return edge;
      }

      const { sourceHandle, targetHandle } = getConnectionHandleIds(
        sourceNode,
        targetNode,
        viewMode,
      );

      return {
        ...edge,
        sourceHandle,
        targetHandle,
      };
    });

  return {
    layoutedNodes,
    validEdges,
    nextManualNodePositions,
  };
}

export function focusNodeInFlow({
  nodeId,
  reactFlowInstance,
  nodes,
}: {
  nodeId?: string | null;
  reactFlowInstance: any;
  nodes: Node[];
}) {
  if (!nodeId || !reactFlowInstance) {
    return;
  }

  const flowNode =
    reactFlowInstance.getNode?.(nodeId) ??
    nodes.find((node) => node.id === nodeId);

  if (!flowNode) {
    return;
  }

  const absolutePosition = flowNode.positionAbsolute ??
    flowNode.position ?? { x: 0, y: 0 };
  const width = flowNode.measured?.width ?? flowNode.width ?? 96;
  const height = flowNode.measured?.height ?? flowNode.height ?? 96;
  const currentZoom = reactFlowInstance.getZoom?.() ?? 1;

  reactFlowInstance.setCenter(
    absolutePosition.x + width / 2,
    absolutePosition.y + height / 2,
    {
      duration: 250,
      zoom: Math.min(Math.max(currentZoom, 1.35), 1.8),
    },
  );
}

export function focusEdgePairInFlow({
  sourceId,
  targetId,
  reactFlowInstance,
  nodes,
  focusNodeById,
}: {
  sourceId?: string | null;
  targetId?: string | null;
  reactFlowInstance: any;
  nodes: Node[];
  focusNodeById: (nodeId?: string | null) => void;
}) {
  if (!sourceId || !targetId || !reactFlowInstance) {
    return;
  }

  const flowNodes =
    reactFlowInstance.getNodes?.() ??
    nodes.filter((node) => node.id === sourceId || node.id === targetId);
  const pairNodes = flowNodes.filter(
    (node: Node) => node.id === sourceId || node.id === targetId,
  );

  if (pairNodes.length === 0) {
    return;
  }

  if (pairNodes.length === 1) {
    focusNodeById(pairNodes[0].id);
    return;
  }

  reactFlowInstance.fitView({
    duration: 250,
    maxZoom: 1.5,
    nodes: pairNodes,
    padding: 0.3,
  });
}
