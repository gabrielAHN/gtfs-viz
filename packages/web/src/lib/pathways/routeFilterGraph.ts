type PathTraversalCost = {
  hasCompleteTraversalTime: boolean;
  totalTraversalTime: number;
  hopCount: number;
};

type PathTraversalEdge = {
  toNodeId: string;
  connection: any;
  connectionId: string;
};

type PathwayRouteStopOption = {
  label: string;
  value: string;
  cost: PathTraversalCost | null;
};

export type PathwayRouteFilterResult = {
  availableFromStops: { label: string; value: string }[];
  availableToStops: { label: string; value: string }[];
  filteredConnections: any[];
  filteredConnectionIds: string[];
};

const createInitialPathTraversalCost = (): PathTraversalCost => ({
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
  const hasTraversalTime =
    Number.isFinite(traversalTime) && traversalTime >= 0;
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

const comparePathTraversalCosts = (
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

const getConnectionId = (connection: any) =>
  connection?.pathway_id !== null && connection?.pathway_id !== undefined
    ? String(connection.pathway_id)
    : null;

export const isBidirectionalConnection = (connection: any) =>
  connection?.direction_type === "bidirectional" ||
  Number(connection?.is_bidirectional) === 1;

const getOrCreateSet = <T,>(map: Map<string, Set<T>>, key: string) => {
  let current = map.get(key);
  if (!current) {
    current = new Set<T>();
    map.set(key, current);
  }
  return current;
};

const getOrCreateList = <T,>(map: Map<string, T[]>, key: string) => {
  let current = map.get(key);
  if (!current) {
    current = [];
    map.set(key, current);
  }
  return current;
};

const computeShortestPathTree = (
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

const getShortestPathResult = (
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

  const connectionIds = new Set<string>();
  let currentNodeId = targetId;

  while (currentNodeId !== startId) {
    const previousStep = previousByNodeId.get(currentNodeId);
    if (!previousStep) {
      return null;
    }

    connectionIds.add(previousStep.connectionId);
    currentNodeId = previousStep.fromNodeId;
  }

  return {
    cost: targetCost,
    connectionIds,
  };
};

const collectReachableNodeIds = (
  startId: string | undefined,
  adjacency: Map<string, Set<string>>,
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

  return visited;
};

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
    .map((id) => ({
      label: id,
      value: id,
      cost: costByNodeId?.get(id) ?? null,
    }))
    .sort((left, right) => {
      if (left.cost && right.cost) {
        const costCompare = comparePathTraversalCosts(left.cost, right.cost);
        if (costCompare !== 0) {
          return costCompare;
        }
      } else if (left.cost || right.cost) {
        return left.cost ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    })
    .map(({ label, value }) => ({ label, value }));

export const getPathwayRouteFilterData = ({
  stops,
  connections,
  fromStopId,
  toStopId,
}: {
  stops: any[];
  connections: any[];
  fromStopId?: string;
  toStopId?: string;
}): PathwayRouteFilterResult => {
  const validStops = Array.isArray(stops)
    ? stops.filter(
        (stop) =>
          stop?.stop_id != null &&
          stop?.status !== "deleted" &&
          stop?.location_type_name !== "Station",
      )
    : [];
  const stopById = new Map(validStops.map((stop) => [String(stop.stop_id), stop]));

  const validConnections: any[] = [];
  const outgoingNodeIdsByNode = new Map<string, Set<string>>();
  const incomingNodeIdsByNode = new Map<string, Set<string>>();
  const traversalEdgesByFromNode = new Map<string, PathTraversalEdge[]>();
  const traversalEdgesByToNode = new Map<string, PathTraversalEdge[]>();
  const fromIds = new Set<string>();
  const toIds = new Set<string>();

  (Array.isArray(connections) ? connections : []).forEach((connection) => {
    const fromId = String(connection?.from_stop_id ?? "");
    const toId = String(connection?.to_stop_id ?? "");
    const connectionId = getConnectionId(connection);

    if (
      !fromId ||
      !toId ||
      fromId === "null" ||
      toId === "null" ||
      !stopById.has(fromId) ||
      !stopById.has(toId) ||
      !connectionId
    ) {
      return;
    }

    validConnections.push(connection);
    fromIds.add(fromId);
    toIds.add(toId);
    getOrCreateSet(outgoingNodeIdsByNode, fromId).add(toId);
    getOrCreateSet(incomingNodeIdsByNode, toId).add(fromId);
    getOrCreateList(traversalEdgesByFromNode, fromId).push({
      toNodeId: toId,
      connection,
      connectionId,
    });
    getOrCreateList(traversalEdgesByToNode, toId).push({
      toNodeId: fromId,
      connection,
      connectionId,
    });

    if (isBidirectionalConnection(connection)) {
      fromIds.add(toId);
      toIds.add(fromId);
      getOrCreateSet(outgoingNodeIdsByNode, toId).add(fromId);
      getOrCreateSet(incomingNodeIdsByNode, fromId).add(toId);
      getOrCreateList(traversalEdgesByFromNode, toId).push({
        toNodeId: fromId,
        connection,
        connectionId,
      });
      getOrCreateList(traversalEdgesByToNode, fromId).push({
        toNodeId: toId,
        connection,
        connectionId,
      });
    }
  });

  const toTargetShortestPathTree = toStopId
    ? computeShortestPathTree(toStopId, traversalEdgesByToNode)
    : null;
  const fromSourceShortestPathTree = fromStopId
    ? computeShortestPathTree(fromStopId, traversalEdgesByFromNode)
    : null;

  const availableFromStops = buildOptionList({
    ids: fromIds,
    costByNodeId: toTargetShortestPathTree?.costByNodeId,
    excludedId: toStopId,
  });
  const availableToStops = buildOptionList({
    ids: toIds,
    costByNodeId: fromSourceShortestPathTree?.costByNodeId,
    excludedId: fromStopId,
  });

  let filteredConnections = validConnections;

  if (fromStopId || toStopId) {
    if (fromStopId && toStopId) {
      const bestPathResult = getShortestPathResult(
        fromStopId,
        toStopId,
        traversalEdgesByFromNode,
      );
      filteredConnections = bestPathResult
        ? validConnections.filter((connection) =>
            bestPathResult.connectionIds.has(getConnectionId(connection) ?? ""),
          )
        : [];
    } else if (fromStopId) {
      const reachableNodeIds = collectReachableNodeIds(
        fromStopId,
        outgoingNodeIdsByNode,
      );
      filteredConnections = validConnections.filter((connection) => {
        const fromId = String(connection?.from_stop_id ?? "");
        const toId = String(connection?.to_stop_id ?? "");
        return reachableNodeIds.has(fromId) && reachableNodeIds.has(toId);
      });
    } else if (toStopId) {
      const reachableNodeIds = collectReachableNodeIds(
        toStopId,
        incomingNodeIdsByNode,
      );
      filteredConnections = validConnections.filter((connection) => {
        const fromId = String(connection?.from_stop_id ?? "");
        const toId = String(connection?.to_stop_id ?? "");
        return reachableNodeIds.has(fromId) && reachableNodeIds.has(toId);
      });
    }
  }

  return {
    availableFromStops,
    availableToStops,
    filteredConnections,
    filteredConnectionIds: filteredConnections
      .map((connection) => getConnectionId(connection))
      .filter((connectionId): connectionId is string => Boolean(connectionId)),
  };
};
