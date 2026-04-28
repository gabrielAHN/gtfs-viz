import { MarkerType } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";

import { rgbToHex } from "@/components/colorUtil";
import { getPathwayColor, getStopColor } from "@/components/style";

import type {
  ConnectionFilterGraph,
  CustomNodeData,
  EdgeLabelMode,
  FilterStats,
  FlowGraphBuildResult,
  FlowStopOption,
  PathTraversalCost,
  PathwayEdgeData,
  ViewMode,
} from "../core/types";
import {
  collectReachableNodeIds,
  comparePathTraversalCosts,
  computeShortestPathTree,
  formatPathTraversalCost,
  getCanonicalPairKey,
  getCanonicalPairNodeIds,
  getConnectionHandleIds,
  getConnectionId,
  getConnectionTypeKey,
  getEdgeLabelStyles,
  getEdgeMarkerProps,
  getMultiConnectionEdgeColor,
  getOrCreateList,
  getOrCreateSet,
  getPathwayTypeLabel,
  getShortestPathResult,
  getSortedConnectionsFromEdge,
  isBidirectionalConnection,
  isWheelchairAccessibleConnection,
  isWheelchairAccessibleStop,
  sortConnections,
} from "../core/shared";

export function buildAvailableOrphanConnections({
  disconnectedConnections,
  detachedConnectionDraftPathwayIds,
}: {
  disconnectedConnections: any[];
  detachedConnectionDraftPathwayIds: Set<string>;
}) {
  return disconnectedConnections.filter(
    (connection: any) =>
      !detachedConnectionDraftPathwayIds.has(String(connection.pathway_id)),
  );
}

export function buildOrphanPathwayIdOptions(
  availableOrphanConnections: any[],
) {
  return availableOrphanConnections
    .map((connection: any) => {
      const pathwayId = String(connection.pathway_id ?? "");
      return {
        value: pathwayId,
        label: pathwayId,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildOrphanPathwayTypeOptions(
  availableOrphanConnections: any[],
) {
  return Array.from(
    new Set(
      availableOrphanConnections.map((connection: any) =>
        getPathwayTypeLabel(connection),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function filterAvailableOrphanConnections({
  availableOrphanConnections,
  orphanPathwayIdFilter,
  orphanPathwayTypeFilter,
}: {
  availableOrphanConnections: any[];
  orphanPathwayIdFilter?: string;
  orphanPathwayTypeFilter: string;
}) {
  return availableOrphanConnections.filter((connection: any) => {
    const matchesPathwayId =
      !orphanPathwayIdFilter ||
      String(connection.pathway_id) === orphanPathwayIdFilter;
    const matchesPathwayType =
      orphanPathwayTypeFilter === "all" ||
      getPathwayTypeLabel(connection) === orphanPathwayTypeFilter;

    return matchesPathwayId && matchesPathwayType;
  });
}

export function buildConnectionFilterGraph({
  pathwayData,
  theme,
  wheelchairAccessibleOnly,
}: {
  pathwayData?: { connections: any[]; stops: any[] };
  theme: string;
  wheelchairAccessibleOnly: boolean;
}): ConnectionFilterGraph {
  if (!pathwayData?.stops || !pathwayData?.connections) {
    return {
      stopOptionById: new Map<string, FlowStopOption>(),
      routeStopOptionById: new Map<string, FlowStopOption>(),
      validConnections: [],
      filterConnections: [],
      wheelchairAccessibleStopIds: new Set<string>(),
      wheelchairAccessibleConnectionIds: new Set<string>(),
      showWheelchairAccessibleSwitch: false,
      outgoingNodeIdsByNode: new Map<string, Set<string>>(),
      incomingNodeIdsByNode: new Map<string, Set<string>>(),
      traversalEdgesByFromNode: new Map(),
      traversalEdgesByToNode: new Map(),
      fromIds: new Set<string>(),
      toIds: new Set<string>(),
    };
  }

  const stopOptionById = new Map<string, FlowStopOption>();
  const wheelchairAccessibleStopOptionById = new Map<string, FlowStopOption>();
  const wheelchairAccessibleStopIds = new Set<string>();

  pathwayData.stops.forEach((stop: any) => {
    if (
      stop.location_type_name === "Station" ||
      stop.status === "deleted" ||
      stop.stop_id == null
    ) {
      return;
    }

    const stopId = String(stop.stop_id);
    const stopName =
      stop.stop_name && String(stop.stop_name) !== stopId
        ? ` · ${stop.stop_name}`
        : "";
    const locationType = String(stop.location_type_name || "Unknown");
    const locationColor = rgbToHex(getStopColor(locationType, theme));

    const stopOption = {
      id: stopId,
      label: `${stopId}${stopName} · ${locationType}`,
      color: locationColor,
      searchLabel: `${stopId}${stopName} · ${locationType}`,
    };

    stopOptionById.set(stopId, stopOption);

    if (isWheelchairAccessibleStop(stop)) {
      wheelchairAccessibleStopIds.add(stopId);
      wheelchairAccessibleStopOptionById.set(stopId, stopOption);
    }
  });

  const validConnections: any[] = [];
  const filterConnections: any[] = [];
  const wheelchairAccessibleConnectionIds = new Set<string>();
  const outgoingNodeIdsByNode = new Map<string, Set<string>>();
  const incomingNodeIdsByNode = new Map<string, Set<string>>();
  const traversalEdgesByFromNode = new Map<string, any[]>();
  const traversalEdgesByToNode = new Map<string, any[]>();
  const fromIds = new Set<string>();
  const toIds = new Set<string>();

  pathwayData.connections.forEach((connection: any) => {
    const fromStopId = String(connection?.from_stop_id ?? "");
    const toStopId = String(connection?.to_stop_id ?? "");

    if (
      !fromStopId ||
      !toStopId ||
      fromStopId === "null" ||
      toStopId === "null" ||
      !stopOptionById.has(fromStopId) ||
      !stopOptionById.has(toStopId)
    ) {
      return;
    }

    validConnections.push(connection);
    const connectionId = getConnectionId(connection);
    const isWheelchairEligibleConnection =
      isWheelchairAccessibleConnection(connection) &&
      wheelchairAccessibleStopIds.has(fromStopId) &&
      wheelchairAccessibleStopIds.has(toStopId);

    if (isWheelchairEligibleConnection && connectionId) {
      wheelchairAccessibleConnectionIds.add(connectionId);
    }

    if (wheelchairAccessibleOnly && !isWheelchairEligibleConnection) {
      return;
    }

    filterConnections.push(connection);
    fromIds.add(fromStopId);
    toIds.add(toStopId);
    getOrCreateSet(outgoingNodeIdsByNode, fromStopId).add(toStopId);
    getOrCreateSet(incomingNodeIdsByNode, toStopId).add(fromStopId);

    if (connectionId) {
      getOrCreateList(traversalEdgesByFromNode, fromStopId).push({
        toNodeId: toStopId,
        connection,
        connectionId,
      });
      getOrCreateList(traversalEdgesByToNode, toStopId).push({
        toNodeId: fromStopId,
        connection,
        connectionId,
      });
    }

    if (isBidirectionalConnection(connection)) {
      fromIds.add(toStopId);
      toIds.add(fromStopId);
      getOrCreateSet(outgoingNodeIdsByNode, toStopId).add(fromStopId);
      getOrCreateSet(incomingNodeIdsByNode, fromStopId).add(toStopId);

      if (connectionId) {
        getOrCreateList(traversalEdgesByFromNode, toStopId).push({
          toNodeId: fromStopId,
          connection,
          connectionId,
        });
        getOrCreateList(traversalEdgesByToNode, fromStopId).push({
          toNodeId: toStopId,
          connection,
          connectionId,
        });
      }
    }
  });

  return {
    stopOptionById,
    routeStopOptionById: wheelchairAccessibleOnly
      ? wheelchairAccessibleStopOptionById
      : stopOptionById,
    validConnections,
    filterConnections,
    wheelchairAccessibleStopIds,
    wheelchairAccessibleConnectionIds,
    showWheelchairAccessibleSwitch:
      wheelchairAccessibleStopIds.size > 0 &&
      wheelchairAccessibleConnectionIds.size > 0,
    outgoingNodeIdsByNode,
    incomingNodeIdsByNode,
    traversalEdgesByFromNode,
    traversalEdgesByToNode,
    fromIds,
    toIds,
  };
}

export function buildLocalRouteStopOptions({
  connectionFilterGraph,
  selectedFromStop,
  selectedToStop,
}: {
  connectionFilterGraph: ConnectionFilterGraph;
  selectedFromStop?: string;
  selectedToStop?: string;
}) {
  const toTargetShortestPathTree = selectedToStop
    ? computeShortestPathTree(
        selectedToStop,
        connectionFilterGraph.traversalEdgesByToNode,
      )
    : null;
  const fromSourceShortestPathTree = selectedFromStop
    ? computeShortestPathTree(
        selectedFromStop,
        connectionFilterGraph.traversalEdgesByFromNode,
      )
    : null;

  const buildOptionList = ({
    ids,
    costByNodeId,
    excludedId,
  }: {
    ids: Set<string>;
    costByNodeId?: Map<string, PathTraversalCost>;
    excludedId?: string;
  }) =>
    Array.from(ids)
      .filter((id) => id !== excludedId)
      .filter((id) => !costByNodeId || costByNodeId.has(id))
      .map((id) => {
        const routeOption = connectionFilterGraph.routeStopOptionById.get(id);
        if (!routeOption) {
          return null;
        }

        const costLabel = formatPathTraversalCost(costByNodeId?.get(id));

        return {
          id,
          label: routeOption.id,
          color: routeOption.color,
          searchLabel: costLabel
            ? `${routeOption.label} · ${costLabel}`
            : routeOption.label,
          sortLabel: routeOption.label,
          cost: costByNodeId?.get(id) ?? null,
        };
      })
      .filter(
        (
          option,
        ): option is {
          id: string;
          label: string;
          color?: string;
          searchLabel?: string;
          sortLabel: string;
          cost: PathTraversalCost | null;
        } => Boolean(option),
      )
      .sort((left, right) => {
        if (left.cost && right.cost) {
          const costCompare = comparePathTraversalCosts(left.cost, right.cost);
          if (costCompare !== 0) {
            return costCompare;
          }
        } else if (left.cost || right.cost) {
          return left.cost ? -1 : 1;
        }

        return left.sortLabel.localeCompare(right.sortLabel);
      })
      .map(({ id, label, color, searchLabel }) => ({
        id,
        label,
        color,
        searchLabel,
      }));

  return {
    fromStopOptions: buildOptionList({
      ids: connectionFilterGraph.fromIds,
      costByNodeId: toTargetShortestPathTree?.costByNodeId,
      excludedId: selectedToStop,
    }),
    toStopOptions: buildOptionList({
      ids: connectionFilterGraph.toIds,
      costByNodeId: fromSourceShortestPathTree?.costByNodeId,
      excludedId: selectedFromStop,
    }),
  };
}

export function buildRepairNodeOptions(
  connectionFilterGraph: ConnectionFilterGraph,
) {
  return Array.from(connectionFilterGraph.stopOptionById.values())
    .map((option) => ({
      value: option.id,
      label: option.label,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildFlowGraph({
  pathwayData,
  connectionFilterGraph,
  procedureRouteFilterData,
  hasConnectionFilters,
  hasRouteEndpointFilters,
  wheelchairAccessibleOnly,
  selectedFromStop,
  selectedToStop,
  edgeLabelMode,
  theme,
  viewMode,
}: {
  pathwayData?: { connections: any[]; stops: any[] };
  connectionFilterGraph: ConnectionFilterGraph;
  procedureRouteFilterData?: { filteredConnectionIds: string[] };
  hasConnectionFilters: boolean;
  hasRouteEndpointFilters: boolean;
  wheelchairAccessibleOnly: boolean;
  selectedFromStop?: string;
  selectedToStop?: string;
  edgeLabelMode: EdgeLabelMode;
  theme: string;
  viewMode: ViewMode;
}): FlowGraphBuildResult {
  if (!pathwayData?.stops || !pathwayData?.connections) {
    return { nodes: [], edges: [] };
  }

  const entranceExits: any[] = [];
  const pathwayNodes: any[] = [];
  const platforms: any[] = [];
  const others: any[] = [];

  pathwayData.stops.forEach((stop: any) => {
    const locationType = stop.location_type_name || "Unknown";
    if (locationType === "Station" || stop.status === "deleted") {
      return;
    }

    if (
      locationType === "Exit/Entrance" ||
      locationType === "Entrance/Exit"
    ) {
      entranceExits.push(stop);
    } else if (locationType === "Platform") {
      platforms.push(stop);
    } else if (
      locationType === "Pathway Node" ||
      locationType === "Generic Node"
    ) {
      pathwayNodes.push(stop);
    } else {
      others.push(stop);
    }
  });

  const baseNodes: Node[] = [];
  const allStops = [
    ...entranceExits.map((s) => ({ ...s, layer: 0 })),
    ...pathwayNodes.map((s) => ({ ...s, layer: 1 })),
    ...others.map((s) => ({ ...s, layer: 1 })),
    ...platforms.map((s) => ({ ...s, layer: 2 })),
  ];

  allStops.forEach((stop) => {
    const color = getStopColor(stop.location_type_name || "Unknown", theme);
    const stopId = String(stop.stop_id);
    baseNodes.push({
      id: stopId,
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: stop.stop_name || stopId,
        stopId,
        locationType: stop.location_type_name || "Unknown",
        color: rgbToHex(color),
        layer: stop.layer,
        status: stop.status || "",
        wheelchairStatus: stop.wheelchair_status || "",
        stopLat: stop.stop_lat,
        stopLon: stop.stop_lon,
        isDimmed: false,
      } satisfies CustomNodeData,
    });
  });

  const nodeById = new Map(baseNodes.map((node) => [node.id, node]));
  const validConnections = connectionFilterGraph.validConnections.filter(
    (connection) =>
      nodeById.has(String(connection.from_stop_id)) &&
      nodeById.has(String(connection.to_stop_id)),
  );
  const filterConnectionIds = new Set(
    connectionFilterGraph.filterConnections
      .map((connection) => getConnectionId(connection))
      .filter(Boolean) as string[],
  );
  const procedureFilteredConnectionIds = new Set(
    procedureRouteFilterData?.filteredConnectionIds ?? [],
  );
  const useProcedureRouteFilters =
    hasRouteEndpointFilters && procedureRouteFilterData !== undefined;
  const forwardReachableNodeIds =
    !useProcedureRouteFilters && selectedFromStop
      ? collectReachableNodeIds(
          selectedFromStop,
          connectionFilterGraph.outgoingNodeIdsByNode,
        )
      : null;
  const backwardReachableNodeIds =
    !useProcedureRouteFilters && selectedToStop
      ? collectReachableNodeIds(
          selectedToStop,
          connectionFilterGraph.incomingNodeIdsByNode,
        )
      : null;
  const bestPathResult =
    !useProcedureRouteFilters && selectedFromStop && selectedToStop
      ? getShortestPathResult(
          selectedFromStop,
          selectedToStop,
          connectionFilterGraph.traversalEdgesByFromNode,
        )
      : null;

  const matchingConnections = validConnections.filter((connection) => {
    const connectionId = getConnectionId(connection);
    const fromStopId = String(connection.from_stop_id);
    const toStopId = String(connection.to_stop_id);

    if (wheelchairAccessibleOnly) {
      if (!connectionId || !filterConnectionIds.has(connectionId)) {
        return false;
      }
    }

    if (!selectedFromStop && !selectedToStop) {
      return true;
    }

    if (useProcedureRouteFilters) {
      return Boolean(
        connectionId && procedureFilteredConnectionIds.has(connectionId),
      );
    }

    if (selectedFromStop && selectedToStop) {
      return Boolean(
        connectionId && bestPathResult?.connectionIds.has(connectionId),
      );
    }

    if (selectedFromStop) {
      return Boolean(
        forwardReachableNodeIds?.has(fromStopId) &&
          forwardReachableNodeIds?.has(toStopId),
      );
    }

    if (selectedToStop) {
      return Boolean(
        backwardReachableNodeIds?.has(fromStopId) &&
          backwardReachableNodeIds?.has(toStopId),
      );
    }

    return true;
  });

  const highlightedConnectionIds = new Set(
    matchingConnections
      .map((connection) => getConnectionId(connection))
      .filter(Boolean) as string[],
  );
  const highlightedNodeIds = new Set<string>();

  matchingConnections.forEach((connection) => {
    highlightedNodeIds.add(String(connection.from_stop_id));
    highlightedNodeIds.add(String(connection.to_stop_id));
  });

  if (wheelchairAccessibleOnly && !selectedFromStop && !selectedToStop) {
    connectionFilterGraph.wheelchairAccessibleStopIds.forEach((nodeId) => {
      highlightedNodeIds.add(nodeId);
    });
  }

  bestPathResult?.nodeIds.forEach((nodeId) => {
    highlightedNodeIds.add(nodeId);
  });

  if (
    selectedFromStop &&
    (!wheelchairAccessibleOnly ||
      connectionFilterGraph.wheelchairAccessibleStopIds.has(selectedFromStop))
  ) {
    highlightedNodeIds.add(selectedFromStop);
  }

  if (
    selectedToStop &&
    (!wheelchairAccessibleOnly ||
      connectionFilterGraph.wheelchairAccessibleStopIds.has(selectedToStop))
  ) {
    highlightedNodeIds.add(selectedToStop);
  }

  const nodes: Node[] = baseNodes.map((node) => {
    const shouldDimNode = hasConnectionFilters
      ? !highlightedNodeIds.has(node.id)
      : false;

    return {
      ...node,
      draggable: !shouldDimNode,
      selectable: !shouldDimNode,
      connectable: !shouldDimNode,
      focusable: !shouldDimNode,
      data: {
        ...(node.data as CustomNodeData),
        isDimmed: shouldDimNode,
        isSelectedFrom: node.id === selectedFromStop,
        isSelectedTo: node.id === selectedToStop,
      },
    };
  });

  const connectionGroups = new Map<
    string,
    {
      displaySourceId: string;
      displayTargetId: string;
      pairConnections: any[];
      typeGroups: Map<string, { typeLabel: string; connections: any[] }>;
    }
  >();

  validConnections.forEach((connection: any) => {
    const fromStopId = String(connection.from_stop_id);
    const toStopId = String(connection.to_stop_id);
    const [displaySourceId, displayTargetId] = getCanonicalPairNodeIds(
      fromStopId,
      toStopId,
    );
    const pairKey = getCanonicalPairKey(fromStopId, toStopId);
    const typeKey = getConnectionTypeKey(connection);
    const typeLabel = getPathwayTypeLabel(connection);

    if (!connectionGroups.has(pairKey)) {
      connectionGroups.set(pairKey, {
        displaySourceId,
        displayTargetId,
        pairConnections: [],
        typeGroups: new Map(),
      });
    }

    const pairGroup = connectionGroups.get(pairKey)!;
    pairGroup.pairConnections.push(connection);

    if (!pairGroup.typeGroups.has(typeKey)) {
      pairGroup.typeGroups.set(typeKey, {
        typeLabel,
        connections: [],
      });
    }

    pairGroup.typeGroups.get(typeKey)!.connections.push(connection);
  });

  const edges: Edge[] = [];

  connectionGroups.forEach((group, pairKey) => {
    const pairConnections = sortConnections(group.pairConnections);
    const displayedPairConnections = sortConnections(
      hasRouteEndpointFilters
        ? pairConnections.filter((connection) =>
            highlightedConnectionIds.has(getConnectionId(connection) ?? ""),
          )
        : pairConnections,
    );
    const renderPairConnections = hasRouteEndpointFilters
      ? displayedPairConnections
      : pairConnections;

    if (renderPairConnections.length === 0) {
      return;
    }

    const displayedTypeGroups = new Map<
      string,
      { typeLabel: string; connections: any[] }
    >();

    renderPairConnections.forEach((connection) => {
      const typeKey = getConnectionTypeKey(connection);
      const typeLabel = getPathwayTypeLabel(connection);

      if (!displayedTypeGroups.has(typeKey)) {
        displayedTypeGroups.set(typeKey, {
          typeLabel,
          connections: [],
        });
      }

      displayedTypeGroups.get(typeKey)!.connections.push(connection);
    });

    const typeEntries = Array.from(displayedTypeGroups.values())
      .map((typeGroup) => ({
        ...typeGroup,
        connections: sortConnections(typeGroup.connections),
      }))
      .sort((left, right) => left.typeLabel.localeCompare(right.typeLabel));

    const distinctTypeCount = typeEntries.length;
    const sourceNode = nodeById.get(group.displaySourceId);
    const targetNode = nodeById.get(group.displayTargetId);

    if (!sourceNode || !targetNode) {
      return;
    }

    const { sourceHandle, targetHandle } = getConnectionHandleIds(
      sourceNode,
      targetNode,
      viewMode,
    );
    const pairHasHighlightedConnection = renderPairConnections.some(
      (connection) =>
        highlightedConnectionIds.has(getConnectionId(connection) ?? ""),
    );

    if (renderPairConnections.length > 1) {
      const edgeId = `edge-${pairKey}-multi`;
      const edgeColor = getMultiConnectionEdgeColor(theme);
      const isDimmed = hasRouteEndpointFilters
        ? false
        : hasConnectionFilters && !pairHasHighlightedConnection;
      const { labelStyle, labelBgStyle } = getEdgeLabelStyles({ edgeColor });
      const edgeMarkers = getEdgeMarkerProps({
        edgeColor,
        connections: renderPairConnections,
        displaySourceId: group.displaySourceId,
        displayTargetId: group.displayTargetId,
      });

      edges.push({
        id: edgeId,
        source: group.displaySourceId,
        target: group.displayTargetId,
        sourceHandle,
        targetHandle,
        ...edgeMarkers,
        type: "custom",
        selectable: !isDimmed,
        focusable: !isDimmed,
        label: "",
        animated: false,
        style: {
          stroke: edgeColor,
          strokeWidth: 3,
          opacity: isDimmed ? 0.08 : 1,
          strokeOpacity: isDimmed ? 0.06 : 0.9,
        },
        labelStyle,
        labelBgStyle,
        labelBgPadding: [6, 6] as [number, number],
        data: {
          connections: renderPairConnections,
          pairConnections: renderPairConnections,
          allPairConnections: pairConnections,
          pairConnectionCount: renderPairConnections.length,
          typeLabel: undefined,
          typeConnectionCount: renderPairConnections.length,
          distinctTypeCount,
          siblingIndex: 0,
          siblingCount: 1,
          edgeId,
          isDimmed,
          edgeLabelMode,
        } satisfies PathwayEdgeData,
      });
      return;
    }

    typeEntries.forEach((typeGroup, siblingIndex) => {
      const representativeConnection = typeGroup.connections[0];
      const edgeColor = rgbToHex(getPathwayColor(typeGroup.typeLabel, theme));
      const typeConnectionCount = typeGroup.connections.length;
      const typeHasHighlightedConnection = typeGroup.connections.some(
        (connection) =>
          highlightedConnectionIds.has(getConnectionId(connection) ?? ""),
      );

      if (hasRouteEndpointFilters && !typeHasHighlightedConnection) {
        return;
      }

      const isDimmed = hasRouteEndpointFilters
        ? false
        : hasConnectionFilters && !typeHasHighlightedConnection;
      const edgeId = `edge-${pairKey}-${getConnectionTypeKey(representativeConnection).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const { labelStyle, labelBgStyle } = getEdgeLabelStyles({ edgeColor });
      const edgeMarkers = getEdgeMarkerProps({
        edgeColor,
        connections: typeGroup.connections,
        displaySourceId: group.displaySourceId,
        displayTargetId: group.displayTargetId,
      });

      edges.push({
        id: edgeId,
        source: group.displaySourceId,
        target: group.displayTargetId,
        sourceHandle,
        targetHandle,
        ...edgeMarkers,
        type: "custom",
        selectable: !isDimmed,
        focusable: !isDimmed,
        label: "",
        animated: false,
        style: {
          stroke: edgeColor,
          strokeWidth: typeConnectionCount > 1 ? 3 : 2,
          opacity: isDimmed ? 0.08 : 1,
          strokeOpacity: isDimmed ? 0.06 : 0.8,
        },
        labelStyle,
        labelBgStyle,
        labelBgPadding: [6, 6] as [number, number],
        data: {
          connections: typeGroup.connections,
          pairConnections: renderPairConnections,
          allPairConnections: pairConnections,
          pairConnectionCount: renderPairConnections.length,
          typeLabel: typeGroup.typeLabel,
          typeConnectionCount,
          distinctTypeCount,
          siblingIndex,
          siblingCount: distinctTypeCount,
          edgeId,
          isDimmed,
          edgeLabelMode,
        } satisfies PathwayEdgeData,
      });
    });
  });

  return { nodes, edges };
}

export function buildFilterStats({
  initialNodes,
  initialEdges,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
}): FilterStats {
  const nodeConnectionCounts = new Map<string, number>();
  initialNodes.forEach((n) => nodeConnectionCounts.set(n.id, 0));

  initialEdges.forEach((edge) => {
    nodeConnectionCounts.set(
      edge.source,
      (nodeConnectionCounts.get(edge.source) || 0) + 1,
    );
    nodeConnectionCounts.set(
      edge.target,
      (nodeConnectionCounts.get(edge.target) || 0) + 1,
    );
  });

  const isolatedNodes = initialNodes.filter(
    (n) => (nodeConnectionCounts.get(n.id) || 0) === 0,
  );
  const orphanedEdges = initialEdges.filter(
    (e) =>
      !initialNodes.some((n) => n.id === e.source) ||
      !initialNodes.some((n) => n.id === e.target),
  );

  return {
    totalNodes: initialNodes.length,
    totalEdges: initialEdges.length,
    isolatedNodes: isolatedNodes.length,
    orphanedEdges: orphanedEdges.length,
    isolatedNodesList: isolatedNodes,
    orphanedEdgesList: orphanedEdges,
  };
}

export function buildDetachedDraftEdges({
  detachedConnectionDrafts,
  nodes,
  editingPathwayConnectionPathwayId,
  theme,
  viewMode,
  edgeLabelMode,
}: {
  detachedConnectionDrafts: any[];
  nodes: Node[];
  editingPathwayConnectionPathwayId?: string | null;
  theme: string;
  viewMode: ViewMode;
  edgeLabelMode: EdgeLabelMode;
}): Edge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return detachedConnectionDrafts.flatMap((draft) => {
    const draftConnection = draft.connection
      ? {
          ...draft.connection,
          from_stop_id: draft.fromStopId ?? draft.connection.from_stop_id,
          to_stop_id: draft.toStopId ?? draft.connection.to_stop_id,
        }
      : null;

    if (!draftConnection) {
      return [];
    }

    const attachedNodeIds = [draft.fromStopId, draft.toStopId].filter(
      Boolean,
    ) as string[];
    const edgeColor = rgbToHex(
      getPathwayColor(getPathwayTypeLabel(draftConnection), theme),
    );

    if (attachedNodeIds.length < 2) {
      return [];
    }

    const [fromNodeId, toNodeId] = attachedNodeIds;
    const edgeMarkers = getEdgeMarkerProps({
      edgeColor,
      connections: [draftConnection],
      displaySourceId: fromNodeId,
      displayTargetId: toNodeId,
    });
    const fromNode = nodeById.get(fromNodeId);
    const toNode = nodeById.get(toNodeId);

    if (!fromNode || !toNode) {
      return [];
    }

    const { sourceHandle, targetHandle } = getConnectionHandleIds(
      fromNode,
      toNode,
      viewMode,
    );

    return [
      {
        id: `detached-draft-preview-edge-${draft.nodeId}`,
        source: fromNodeId,
        target: toNodeId,
        sourceHandle,
        targetHandle,
        ...edgeMarkers,
        type: "custom",
        label: "",
        animated: true,
        style: {
          stroke: edgeColor,
          strokeWidth: 3,
          strokeDasharray: "7 4",
          opacity: 0.95,
        },
        data: {
          connections: [draftConnection],
          pairConnections: [draftConnection],
          allPairConnections: [draftConnection],
          pairConnectionCount: 1,
          typeLabel: "Suggested",
          typeConnectionCount: 1,
          distinctTypeCount: 1,
          siblingIndex: 0,
          siblingCount: 1,
          edgeId: `detached-draft-preview-edge-${draft.nodeId}`,
          isDimmed: false,
          isPopupSelected:
            String(editingPathwayConnectionPathwayId ?? "") ===
            String(draft.connection.pathway_id),
          popupSelectionColor: edgeColor,
          edgeLabelMode,
        } satisfies PathwayEdgeData,
      } satisfies Edge,
    ];
  });
}

export function buildDisplayEdges({
  edges,
  detachedDraftEdges,
  potentialEdge,
  viewMode,
}: {
  edges: Edge[];
  detachedDraftEdges: Edge[];
  potentialEdge: any;
  viewMode: ViewMode;
}) {
  const edgePairKey = (edge: Edge) => getCanonicalPairKey(edge.source, edge.target);
  const multiPairKeys = new Set(
    edges
      .filter((edge) => {
        const edgeData = (edge.data ?? {}) as PathwayEdgeData;
        return (
          Number(edgeData.pairConnectionCount ?? 0) > 1 ||
          edge.id.endsWith("-multi")
        );
      })
      .map(edgePairKey),
  );

  const normalizedEdges = edges.filter((edge) => {
    const edgeData = (edge.data ?? {}) as PathwayEdgeData;
    const isMultiEdge =
      Number(edgeData.pairConnectionCount ?? 0) > 1 ||
      edge.id.endsWith("-multi");

    if (!multiPairKeys.has(edgePairKey(edge))) {
      return true;
    }

    return isMultiEdge;
  });

  const hasRenderedEdgeForPotentialPair =
    potentialEdge?.existingEdgeId != null ||
    (potentialEdge != null &&
      normalizedEdges.some((edge) =>
        getCanonicalPairKey(edge.source, edge.target) ===
        getCanonicalPairKey(
          potentialEdge.connection.source,
          potentialEdge.connection.target,
        ),
      ));

  const previewEdges =
    potentialEdge && !hasRenderedEdgeForPotentialPair
      ? [
          (() => {
            const fallbackHandles = getConnectionHandleIds(
              potentialEdge.sourceNode,
              potentialEdge.targetNode,
              viewMode,
            );

            return {
              id: "potential-edge",
              source: potentialEdge.connection.source!,
              target: potentialEdge.connection.target!,
              sourceHandle:
                potentialEdge.connection.sourceHandle ??
                fallbackHandles.sourceHandle,
              targetHandle:
                potentialEdge.connection.targetHandle ??
                fallbackHandles.targetHandle,
              type: "custom",
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "hsl(var(--primary))",
                width: 18,
                height: 18,
              },
              animated: true,
              style: {
                stroke: "hsl(var(--primary))",
                strokeWidth: 2,
                strokeDasharray: "5 5",
                opacity: 0.8,
              },
              data: {},
            } as Edge;
          })(),
        ]
      : [];

  return [...normalizedEdges, ...detachedDraftEdges, ...previewEdges];
}
