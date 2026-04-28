type PathTraversalCost = {
  hasCompleteTraversalTime: boolean;
  totalTraversalTime: number;
  hopCount: number;
};

type PathTraversalEdge = {
  toNodeId: string;
  connection: any;
};

export type EndpointRouteRow = {
  start_stop: string;
  end_stop: string;
  from_location_type_name: string;
  to_location_type_name: string;
  shortest_time: number | null;
  hop_count: number | null;
};

const getEndpointRouteRowKey = (row: EndpointRouteRow) =>
  [
    row.start_stop,
    row.end_stop,
    row.shortest_time ?? "null",
    row.hop_count ?? "null",
    row.from_location_type_name,
    row.to_location_type_name,
  ].join("|");

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
  preferNullConnections = false,
) => {
  if (left.hasCompleteTraversalTime !== right.hasCompleteTraversalTime) {
    if (preferNullConnections) {
      return left.hasCompleteTraversalTime ? 1 : -1;
    }

    return left.hasCompleteTraversalTime ? -1 : 1;
  }

  if (left.hasCompleteTraversalTime && left.totalTraversalTime !== right.totalTraversalTime) {
    return left.totalTraversalTime - right.totalTraversalTime;
  }

  if (left.hopCount !== right.hopCount) {
    return left.hopCount - right.hopCount;
  }

  return 0;
};

const computeShortestPathTree = (
  startId: string,
  adjacencyByNodeId: Map<string, PathTraversalEdge[]>,
  preferNullConnections = false,
) => {
  const costByNodeId = new Map<string, PathTraversalCost>();
  const pendingNodeIds = new Set<string>([startId]);

  costByNodeId.set(startId, createInitialPathTraversalCost());

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
        comparePathTraversalCosts(
          candidateCost,
          currentNodeCost,
          preferNullConnections,
        ) < 0
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
      const nextCost = getNextPathTraversalCost(currentNodeCost!, edge.connection);
      const existingCost = costByNodeId.get(edge.toNodeId);

      if (
        !existingCost ||
        comparePathTraversalCosts(nextCost, existingCost, preferNullConnections) < 0
      ) {
        costByNodeId.set(edge.toNodeId, nextCost);
        pendingNodeIds.add(edge.toNodeId);
      }
    });
  }

  return { costByNodeId };
};

const isEntranceExitLocationType = (locationType?: string | null) =>
  locationType === "Exit/Entrance" || locationType === "Entrance/Exit";

const isPlatformLocationType = (locationType?: string | null) =>
  locationType === "Platform";

const isBidirectionalConnection = (connection: any) =>
  connection?.direction_type === "bidirectional" ||
  Number(connection?.is_bidirectional) === 1;

const isWheelchairAccessibleStop = (stop: any) => {
  const wheelchairStatus = String(stop?.wheelchair_status ?? "").trim();

  return (
    wheelchairStatus === "🟢" ||
    wheelchairStatus === "1" ||
    wheelchairStatus.toLowerCase() === "accessible"
  );
};

const isWheelchairAccessibleConnection = (connection: any) => {
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

export const buildEndpointRouteTableData = ({
  stops,
  connections,
  viewType,
  wheelchairAccessibleOnly = false,
  preferNullConnections = false,
}: {
  stops: any[];
  connections: any[];
  viewType: "start" | "end";
  wheelchairAccessibleOnly?: boolean;
  preferNullConnections?: boolean;
}): EndpointRouteRow[] => {
  if (!Array.isArray(stops) || !Array.isArray(connections)) {
    return [];
  }

  const validStops = stops.filter(
    (stop) =>
      stop?.stop_id != null &&
      stop?.status !== "deleted" &&
      stop?.location_type_name !== "Station",
  );
  const stopById = new Map(
    validStops.map((stop) => [String(stop.stop_id), stop]),
  );
  const routeStops = validStops;
  const traversalEdgesByFromNode = new Map<string, PathTraversalEdge[]>();

  connections.forEach((connection) => {
    const fromStopId = String(connection?.from_stop_id ?? "");
    const toStopId = String(connection?.to_stop_id ?? "");

    if (
      !fromStopId ||
      !toStopId ||
      fromStopId === "null" ||
      toStopId === "null" ||
      !stopById.has(fromStopId) ||
      !stopById.has(toStopId)
    ) {
      return;
    }

    if (wheelchairAccessibleOnly) {
      if (
        !isWheelchairAccessibleConnection(connection) ||
        !isWheelchairAccessibleStop(stopById.get(fromStopId)) ||
        !isWheelchairAccessibleStop(stopById.get(toStopId))
      ) {
        return;
      }
    }

    if (!traversalEdgesByFromNode.has(fromStopId)) {
      traversalEdgesByFromNode.set(fromStopId, []);
    }
    traversalEdgesByFromNode.get(fromStopId)!.push({
      toNodeId: toStopId,
      connection,
    });

    if (isBidirectionalConnection(connection)) {
      if (!traversalEdgesByFromNode.has(toStopId)) {
        traversalEdgesByFromNode.set(toStopId, []);
      }
      traversalEdgesByFromNode.get(toStopId)!.push({
        toNodeId: fromStopId,
        connection,
      });
    }
  });

  const rows: EndpointRouteRow[] = [];

  routeStops.forEach((startStop) => {
    const startStopId = String(startStop.stop_id);
    const startLocationType = String(startStop.location_type_name ?? "Unknown");
    const shortestPathTree = computeShortestPathTree(
      startStopId,
      traversalEdgesByFromNode,
      preferNullConnections,
    );

    routeStops.forEach((endStop) => {
      const endStopId = String(endStop.stop_id);
      const endLocationType = String(endStop.location_type_name ?? "Unknown");

      if (startStopId === endStopId) {
        return;
      }

      const cost = shortestPathTree.costByNodeId.get(endStopId);

      if (!cost) {
        return;
      }

      rows.push({
        start_stop: startStopId,
        end_stop: endStopId,
        from_location_type_name: startLocationType,
        to_location_type_name: endLocationType,
        shortest_time: cost.hasCompleteTraversalTime
          ? cost.totalTraversalTime
          : null,
        hop_count: cost.hopCount,
      });
    });
  });

  return rows;
};

export const mergeEndpointRouteTableData = (
  timedRows: EndpointRouteRow[],
  nullRows: EndpointRouteRow[],
) => {
  const mergedRows: EndpointRouteRow[] = [];
  const seenKeys = new Set<string>();

  [...timedRows, ...nullRows].forEach((row) => {
    const key = getEndpointRouteRowKey(row);
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    mergedRows.push(row);
  });

  return mergedRows;
};
