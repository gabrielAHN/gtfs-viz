import React, { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  reconnectEdge,
  applyNodeChanges,
} from "@xyflow/react";
import { flushSync } from "react-dom";
import "@xyflow/react/dist/style.css";
import { getStopColor, getPathwayColor } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";
import { logger } from "@/lib/logger";
import { useDuckDB } from "@/context/duckdb.client";
import {
  deletePathway,
  insertPathway,
  generatePathwayId,
} from "@/lib/duckdb/DataEditing/editPathways";
import { refreshPathwayFlow } from "@/lib/duckdb/DataEditing/refreshPathwayFlow";
import { useQueryClient } from "@tanstack/react-query";
import { PathwayFlowHeader } from "@/client/Stations/SelectedStations/StationPathways/FlowView/Header";
import { useEdgeHandlers } from "@/components/pathways/flow-editor/hooks/useEdgeHandlers";
import { useNodeHandlers } from "@/components/pathways/flow-editor/hooks/useNodeHandlers";
import { FlowCanvasPane } from "@/components/pathways/flow-editor/canvas/FlowCanvasPane";
import { PathwayFlowSelectionPopup } from "@/components/pathways/flow-editor/panels/SelectionPopup";
import type {
  ConnectionFilterGraph,
  CustomNodeData,
  DetachedConnectionDraft,
  DetachedConnectionEndpointFocus,
  EdgeFormValues,
  EdgeLabelMode,
  EdgeOptionalFieldKey,
  FilterStats,
  FlowStopOption,
  PathwayEdgeData,
  ViewMode,
} from "@/components/pathways/flow-editor/core/types";
import {
  buildAvailableOrphanConnections,
  buildConnectionFilterGraph,
  buildDetachedDraftEdges,
  buildDisplayEdges,
  buildFilterStats,
  buildFlowGraph,
  buildLocalRouteStopOptions,
  buildOrphanPathwayIdOptions,
  buildOrphanPathwayTypeOptions,
  buildRepairNodeOptions,
  filterAvailableOrphanConnections,
} from "@/components/pathways/flow-editor/graph/connections";
import { useDetachedConnectionHandlers } from "@/components/pathways/flow-editor/hooks/useDetachedConnectionHandlers";
import {
  getActiveSelectedEdge,
  getEdgeFormDefaults,
  getEdgePanelEdge,
  getEditingDetachedConnectionDraft,
  getPopupEdgeSelection,
  getSelectedKeyboardConnection,
  isDimmedEdge,
} from "@/components/pathways/flow-editor/state/edge-state";
import {
  getActiveNodeFormClickInfo,
  getPopupNodeSelection,
  getSelectedNodeDetails,
  getSelectedNodePanelColor,
} from "@/components/pathways/flow-editor/state/node-state";
import {
  buildLayoutedFlowGraph,
  focusEdgePairInFlow,
  focusNodeInFlow,
} from "@/components/pathways/flow-editor/graph/layout";
import {
  DECIMAL_EDGE_FORM_FIELDS,
  clamp,
  createInitialEdgeFormValues,
  edgeMatchesCanonicalPair,
  getCanonicalPairKey,
  getConnectionHandleIds,
  getConnectionId,
  getDetachedConnectionDraftAttachedNodeIds,
  getEdgeMarkerProps,
  getPathwayTypeLabel,
  getSortedConnectionsFromEdge,
  isEditableKeyboardTarget,
  isNewConnectionStatus,
} from "@/components/pathways/flow-editor/core/shared";

export interface PathwayFlowEditorProps {
  pathwayData: {
    connections: any[];
    stops: any[];
  };
  procedureRouteFilterData?: {
    fromStopOptions: FlowStopOption[];
    toStopOptions: FlowStopOption[];
    filteredConnectionIds: string[];
  };
  onSetClickInfo?: (info: any) => void;
  selectedNodeId?: string;
  selectedPathwayId?: string;
  onSelectedNodeIdChange?: (nodeId?: string) => void;
  onSelectedPathwayIdChange?: (pathwayId?: string) => void;
  selectedFromStop?: string;
  onSelectedFromStopChange?: (stopId?: string) => void;
  selectedToStop?: string;
  onSelectedToStopChange?: (stopId?: string) => void;
  nodeFormOpenValue: { formType: string | null; state: boolean };
  setNodeFormOpenValue: (value: { formType: string | null; state: boolean }) => void;
  nodeFormClickInfo: any;
  setNodeFormClickInfo: (value: any) => void;
  parentStationId?: string;
  requestedEditTarget?: "node" | "pathway";
  onRequestedEditTargetHandled?: () => void;
  viewMode: ViewMode;
}

export const PathwayFlowEditor: React.FC<PathwayFlowEditorProps> = ({
  pathwayData,
  procedureRouteFilterData,
  onSetClickInfo,
  selectedNodeId,
  selectedPathwayId,
  onSelectedNodeIdChange,
  onSelectedPathwayIdChange,
  selectedFromStop,
  onSelectedFromStopChange,
  selectedToStop,
  onSelectedToStopChange,
  nodeFormOpenValue,
  setNodeFormOpenValue,
  nodeFormClickInfo,
  setNodeFormClickInfo,
  parentStationId,
  requestedEditTarget,
  onRequestedEditTargetHandled,
  viewMode,
}) => {
  const { theme } = useThemeContext();
  const { conn } = useDuckDB();
  const queryClient = useQueryClient();

  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isLayouting, setIsLayouting] = useState(false);
  const [edgeLabelMode, setEdgeLabelMode] = useState<EdgeLabelMode>("type");
  const [wheelchairAccessibleOnly, setWheelchairAccessibleOnly] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingPathwayConnection, setEditingPathwayConnection] = useState<any | null>(null);
  const [potentialEdge, setPotentialEdge] = useState<{
    connection: Connection;
    sourceNode: Node;
    targetNode: Node;
    existingEdgeId?: string | null;
  } | null>(null);
  const [edgeFormValues, setEdgeFormValues] = useState<EdgeFormValues>(
    createInitialEdgeFormValues(),
  );
  const [edgeFormSubmitting, setEdgeFormSubmitting] = useState(false);
  const [edgeFormError, setEdgeFormError] = useState<string | null>(null);
  const [isFlowReady, setIsFlowReady] = useState(false);
  const [visibleEdgeOptionalFields, setVisibleEdgeOptionalFields] = useState<
    Record<EdgeOptionalFieldKey, boolean>
  >({
    stair_count: false,
    max_slope: false,
    min_width: false,
    signposted_as: false,
    reversed_signposted_as: false,
  });
  const manualNodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const previousViewModeRef = useRef<ViewMode | null>(null);
  const reactFlowInstanceRef = useRef<any>(null);
  const bottomPanelsRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const hasAutoFitRef = useRef(false);
  const pendingSelectedConnectionIdRef = useRef<string | null>(null);
  const lastHandledRouteNodeIdRef = useRef<string | null>(null);
  const lastFocusedRouteNodeIdRef = useRef<string | null>(null);
  const lastHandledRoutePathwayIdRef = useRef<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [detachedConnectionDrafts, setDetachedConnectionDrafts] = useState<
    DetachedConnectionDraft[]
  >([]);
  const [detachedConnectionEndpointFocus, setDetachedConnectionEndpointFocus] =
    useState<DetachedConnectionEndpointFocus>("from");
  const [queuedOrphanConnections, setQueuedOrphanConnections] = useState<any[]>([]);
  const [orphanPathwayIdFilter, setOrphanPathwayIdFilter] = useState<string | undefined>(undefined);
  const [orphanPathwayTypeFilter, setOrphanPathwayTypeFilter] = useState<string>("all");
  const activeDetachedConnectionDraft = detachedConnectionDrafts[0] ?? null;
  const activeDetachedConnectionDraftPathwayId = activeDetachedConnectionDraft
    ? String(activeDetachedConnectionDraft.connection.pathway_id)
    : null;

  const activeStopIds = useMemo(
    () =>
      new Set(
        pathwayData?.stops
          ?.filter((stop: any) => stop.status !== "deleted")
          .map((stop: any) => String(stop.stop_id)) ?? [],
      ),
    [pathwayData?.stops],
  );

  const disconnectedConnections = useMemo(
    () =>
      pathwayData?.connections?.filter(
        (connection: any) =>
          !activeStopIds.has(String(connection.from_stop_id)) ||
          !activeStopIds.has(String(connection.to_stop_id)),
      ) ?? [],
    [activeStopIds, pathwayData?.connections],
  );

  useEffect(() => {
    setQueuedOrphanConnections((currentConnections) =>
      currentConnections.filter((connection: any) => {
        const liveConnection =
          pathwayData?.connections?.find(
            (item: any) => getConnectionId(item) === getConnectionId(connection),
          ) ?? connection;

        const fromStopId = String(liveConnection?.from_stop_id ?? "");
        const toStopId = String(liveConnection?.to_stop_id ?? "");

        if (!fromStopId || !toStopId) {
          return false;
        }

        return !activeStopIds.has(fromStopId) || !activeStopIds.has(toStopId);
      }),
    );
  }, [activeStopIds, pathwayData?.connections]);

  const orphanConnectionCandidates = useMemo(() => {
    const orphanConnectionsById = new Map<string, any>();

    queuedOrphanConnections.forEach((connection: any) => {
      const connectionId = getConnectionId(connection);
      if (connectionId) {
        orphanConnectionsById.set(connectionId, connection);
      }
    });

    disconnectedConnections.forEach((connection: any) => {
      const connectionId = getConnectionId(connection);
      if (connectionId) {
        orphanConnectionsById.set(connectionId, connection);
      }
    });

    return Array.from(orphanConnectionsById.values());
  }, [disconnectedConnections, queuedOrphanConnections]);

  const disconnectedConnectionsByPathwayId = useMemo(
    () =>
      new Map(
        orphanConnectionCandidates.map((connection: any) => [
          String(connection.pathway_id),
          connection,
        ]),
      ),
    [orphanConnectionCandidates],
  );

  useEffect(() => {
    setDetachedConnectionDrafts((currentDrafts) =>
      currentDrafts
        .filter((draft) =>
          disconnectedConnectionsByPathwayId.has(String(draft.connection.pathway_id)),
        )
        .map((draft) => ({
          ...draft,
          connection:
            disconnectedConnectionsByPathwayId.get(String(draft.connection.pathway_id)) ??
            draft.connection,
        })),
    );
  }, [disconnectedConnectionsByPathwayId]);

  const detachedConnectionDraftsByNodeId = useMemo(
    () => new Map(detachedConnectionDrafts.map((draft) => [draft.nodeId, draft])),
    [detachedConnectionDrafts],
  );

  const detachedConnectionDraftsByPathwayId = useMemo(
    () =>
      new Map(
        detachedConnectionDrafts.map((draft) => [String(draft.connection.pathway_id), draft]),
      ),
    [detachedConnectionDrafts],
  );

  const availableOrphanConnections = useMemo(
    () =>
      buildAvailableOrphanConnections({
        disconnectedConnections: orphanConnectionCandidates,
        detachedConnectionDraftPathwayIds: new Set(
          Array.from(detachedConnectionDraftsByPathwayId.keys()),
        ),
      }),
    [detachedConnectionDraftsByPathwayId, orphanConnectionCandidates],
  );

  const orphanPathwayIdOptions = useMemo(
    () => buildOrphanPathwayIdOptions(availableOrphanConnections),
    [availableOrphanConnections],
  );

  const orphanPathwayTypeOptions = useMemo(
    () => buildOrphanPathwayTypeOptions(availableOrphanConnections),
    [availableOrphanConnections],
  );

  const filteredAvailableOrphanConnections = useMemo(
    () =>
      filterAvailableOrphanConnections({
        availableOrphanConnections,
        orphanPathwayIdFilter,
        orphanPathwayTypeFilter,
      }),
    [availableOrphanConnections, orphanPathwayIdFilter, orphanPathwayTypeFilter],
  );

  const hasOrphanConnectionsSidebar =
    availableOrphanConnections.length > 0 || detachedConnectionDrafts.length > 0;

  useEffect(() => {
    if (!hasOrphanConnectionsSidebar) {
      setSidebarOpen(false);
    }
  }, [hasOrphanConnectionsSidebar]);

  useEffect(() => {
    if (
      orphanPathwayIdFilter &&
      !availableOrphanConnections.some(
        (connection: any) => String(connection.pathway_id) === orphanPathwayIdFilter,
      )
    ) {
      setOrphanPathwayIdFilter(undefined);
    }
  }, [availableOrphanConnections, orphanPathwayIdFilter]);

  useEffect(() => {
    if (
      orphanPathwayTypeFilter !== "all" &&
      !orphanPathwayTypeOptions.includes(orphanPathwayTypeFilter)
    ) {
      setOrphanPathwayTypeFilter("all");
    }
  }, [orphanPathwayTypeFilter, orphanPathwayTypeOptions]);

  const storeNodePositions = useCallback((nextNodes: Node[]) => {
    manualNodePositionsRef.current = new Map(
      nextNodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }]),
    );
  }, []);

  const connectionFilterGraph = useMemo<ConnectionFilterGraph>(
    () =>
      buildConnectionFilterGraph({
        pathwayData,
        theme,
        wheelchairAccessibleOnly,
      }),
    [pathwayData, theme, wheelchairAccessibleOnly],
  );

  const localRouteStopOptions = useMemo(() => {
    return buildLocalRouteStopOptions({
      connectionFilterGraph,
      selectedFromStop,
      selectedToStop,
    });
  }, [connectionFilterGraph, selectedFromStop, selectedToStop]);
  const fromStopOptions =
    procedureRouteFilterData?.fromStopOptions ?? localRouteStopOptions.fromStopOptions;
  const toStopOptions =
    procedureRouteFilterData?.toStopOptions ?? localRouteStopOptions.toStopOptions;

  useEffect(() => {
    if (!connectionFilterGraph.showWheelchairAccessibleSwitch && wheelchairAccessibleOnly) {
      setWheelchairAccessibleOnly(false);
    }
  }, [connectionFilterGraph.showWheelchairAccessibleSwitch, wheelchairAccessibleOnly]);

  useEffect(() => {
    if (!wheelchairAccessibleOnly) {
      return;
    }

    if (
      selectedFromStop &&
      !connectionFilterGraph.wheelchairAccessibleStopIds.has(selectedFromStop)
    ) {
      onSelectedFromStopChange?.(undefined);
    }

    if (selectedToStop && !connectionFilterGraph.wheelchairAccessibleStopIds.has(selectedToStop)) {
      onSelectedToStopChange?.(undefined);
    }
  }, [
    connectionFilterGraph.wheelchairAccessibleStopIds,
    onSelectedFromStopChange,
    onSelectedToStopChange,
    selectedFromStop,
    selectedToStop,
    wheelchairAccessibleOnly,
  ]);

  const repairNodeOptions = useMemo(
    () => buildRepairNodeOptions(connectionFilterGraph),
    [connectionFilterGraph.stopOptionById],
  );

  const hasConnectionFilters = Boolean(
    selectedFromStop || selectedToStop || wheelchairAccessibleOnly,
  );
  const hasRouteEndpointFilters = Boolean(selectedFromStop || selectedToStop);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      buildFlowGraph({
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
      }),
    [
      connectionFilterGraph,
      edgeLabelMode,
      hasConnectionFilters,
      hasRouteEndpointFilters,
      pathwayData,
      procedureRouteFilterData,
      wheelchairAccessibleOnly,
      selectedFromStop,
      selectedToStop,
      theme,
      viewMode,
    ],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const detachedFlowNodes = useMemo<Node[]>(() => [], []);

  const displayNodes = useMemo(() => nodes, [nodes]);

  const detachedDraftEdges = useMemo(
    () =>
      buildDetachedDraftEdges({
        detachedConnectionDrafts,
        nodes,
        editingPathwayConnectionPathwayId:
          editingPathwayConnection?.pathway_id != null
            ? String(editingPathwayConnection.pathway_id)
            : null,
        theme,
        viewMode,
        edgeLabelMode,
      }),
    [
      detachedConnectionDrafts,
      edgeLabelMode,
      editingPathwayConnection?.pathway_id,
      nodes,
      theme,
      viewMode,
    ],
  );

  const displayEdges = useMemo(() => {
    return buildDisplayEdges({
      edges,
      detachedDraftEdges,
      potentialEdge,
      viewMode,
    });
  }, [detachedDraftEdges, edges, potentialEdge, viewMode]);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      const detachedChanges = changes.filter((change) =>
        detachedConnectionDraftsByNodeId.has(change.id),
      );
      const regularChanges = changes.filter(
        (change) => !detachedConnectionDraftsByNodeId.has(change.id),
      );

      if (detachedChanges.length > 0) {
        setDetachedConnectionDrafts((currentDrafts) => {
          const currentDetachedNodes = currentDrafts.map((draft) => ({
            id: draft.nodeId,
            position: draft.position,
            data: {},
          })) as Node[];
          const changedDetachedNodes = applyNodeChanges(detachedChanges, currentDetachedNodes);
          const nextDetachedNodeById = new Map(changedDetachedNodes.map((node) => [node.id, node]));

          return currentDrafts
            .filter((draft) => nextDetachedNodeById.has(draft.nodeId))
            .map((draft) => ({
              ...draft,
              position: nextDetachedNodeById.get(draft.nodeId)?.position ?? draft.position,
            }));
        });
      }

      if (regularChanges.length > 0) {
        onNodesChange(regularChanges);
      }
    },
    [detachedConnectionDraftsByNodeId, onNodesChange],
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (detachedConnectionDraftsByNodeId.has(node.id)) {
        setDetachedConnectionDrafts((currentDrafts) =>
          currentDrafts.map((draft) =>
            draft.nodeId === node.id ? { ...draft, position: node.position } : draft,
          ),
        );
        return;
      }

      manualNodePositionsRef.current.set(node.id, node.position);
    },
    [detachedConnectionDraftsByNodeId],
  );

  const activeSelectedEdge = useMemo(
    () =>
      getActiveSelectedEdge({
        selectedEdge,
        edges,
        selectedConnectionId,
        selectedPathwayId,
      }),
    [edges, selectedConnectionId, selectedEdge, selectedPathwayId],
  );

  const selectedEdgeConnections = useMemo(() => {
    return getSortedConnectionsFromEdge(activeSelectedEdge);
  }, [activeSelectedEdge]);

  const edgePanelEdge = useMemo(
    () =>
      getEdgePanelEdge({
        activeSelectedEdge,
        potentialEdge,
        editingPathwayConnection,
        edges,
      }),
    [activeSelectedEdge, editingPathwayConnection, edges, potentialEdge],
  );

  const edgePanelConnections = useMemo(() => {
    return getSortedConnectionsFromEdge(edgePanelEdge);
  }, [edgePanelEdge]);

  const selectedKeyboardConnection = useMemo(
    () =>
      getSelectedKeyboardConnection({
        editingPathwayConnection,
        selectedConnectionId,
        edgePanelConnections,
        selectedEdgeConnections,
      }),
    [editingPathwayConnection, edgePanelConnections, selectedConnectionId, selectedEdgeConnections],
  );

  const editingDetachedConnectionDraft = useMemo(
    () =>
      getEditingDetachedConnectionDraft({
        editingPathwayConnection,
        detachedConnectionDraftsByPathwayId,
      }),
    [detachedConnectionDraftsByPathwayId, editingPathwayConnection],
  );

  const isEditingDetachedConnectionDraft = editingDetachedConnectionDraft !== null;

  const edgePanelMode = potentialEdge ? "create" : editingPathwayConnection ? "edit" : "list";
  const isNodeFormOpen =
    nodeFormOpenValue.state &&
    (nodeFormOpenValue.formType === "add" || nodeFormOpenValue.formType === "edit");
  const nodeFormMode = nodeFormOpenValue.formType === "edit" ? "edit" : "add";
  const activeNodeFormClickInfo = useMemo(
    () =>
      getActiveNodeFormClickInfo({
        nodeFormMode,
        nodeFormClickInfo,
        stops: pathwayData?.stops,
      }),
    [nodeFormClickInfo, nodeFormMode, pathwayData?.stops],
  );

  const selectedNodeDetails = useMemo(
    () => getSelectedNodeDetails({ selectedNode, stops: pathwayData?.stops }),
    [pathwayData?.stops, selectedNode],
  );

  const selectedNodePanelColor = useMemo(
    () =>
      getSelectedNodePanelColor({
        selectedNode,
        selectedNodeDetails,
        theme,
      }),
    [selectedNode, selectedNodeDetails, theme],
  );

  const edgeFormDefaults = useMemo(
    () =>
      getEdgeFormDefaults({
        edgePanelMode,
        editingDetachedConnectionDraft,
        editingPathwayConnection,
      }),
    [edgePanelMode, editingDetachedConnectionDraft, editingPathwayConnection],
  );

  const {
    openDetachedConnectionDraftForEditing,
    startDetachedConnectionRepair,
    onCanvasDragOver,
    onCanvasDrop,
    onConnect,
    handleDetachedEndpointSelection,
    handleDetachedEndpointFocusChange,
    handleReverseDetachedEndpoints,
  } = useDetachedConnectionHandlers({
    detachedConnectionDraftsByPathwayId,
    detachedConnectionDraftsByNodeId,
    editingDetachedConnectionDraft,
    editingPathwayConnection,
    edgeFormValues,
    displayNodes,
    edges,
    viewMode,
    reactFlowInstanceRef,
    pendingSelectedConnectionIdRef,
    setDetachedConnectionDrafts,
    setDetachedConnectionEndpointFocus,
    setEdgeFormValues,
    setEdgeFormError,
    setNodeFormOpenValue,
    setNodeFormClickInfo,
    setSelectedEdge,
    setSelectedNode,
    setSelectedConnectionId,
    setPotentialEdge,
    setEditingPathwayConnection,
    setSidebarOpen,
    onSelectedNodeIdChange,
    onSelectedPathwayIdChange,
  });

  useEffect(() => {
    if (edgePanelMode === "list") {
      setEdgeFormError(null);
      setEdgeFormSubmitting(false);
      return;
    }

    setEdgeFormValues(edgeFormDefaults);
    setVisibleEdgeOptionalFields({
      stair_count: edgeFormDefaults.stair_count !== "",
      max_slope: edgeFormDefaults.max_slope !== "",
      min_width: edgeFormDefaults.min_width !== "",
      signposted_as: edgeFormDefaults.signposted_as !== "",
      reversed_signposted_as: edgeFormDefaults.reversed_signposted_as !== "",
    });
    setEdgeFormError(null);
  }, [edgeFormDefaults, edgePanelMode]);

  useEffect(() => {
    if (!activeSelectedEdge) {
      setSelectedConnectionId(null);
      return;
    }

    if (selectedEdgeConnections.length === 0) {
      setSelectedConnectionId(null);
      pendingSelectedConnectionIdRef.current = null;
      return;
    }

    const pendingId = pendingSelectedConnectionIdRef.current;

    if (
      pendingId &&
      selectedEdgeConnections.some((connection) => getConnectionId(connection) === pendingId)
    ) {
      setSelectedConnectionId(pendingId);
      pendingSelectedConnectionIdRef.current = null;
      return;
    }

    pendingSelectedConnectionIdRef.current = null;
    setSelectedConnectionId((current) => {
      if (
        current &&
        selectedEdgeConnections.some((connection) => getConnectionId(connection) === current)
      ) {
        return current;
      }

      return getConnectionId(selectedEdgeConnections[0]);
    });
  }, [activeSelectedEdge, selectedEdgeConnections]);

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    const currentNode = nodes.find((node) => node.id === selectedNode.id);
    if (!currentNode) {
      return;
    }

    if ((currentNode.data as CustomNodeData | undefined)?.isDimmed) {
      setSelectedNode(null);
      onSelectedNodeIdChange?.(undefined);
    }
  }, [nodes, onSelectedNodeIdChange, selectedNode]);

  useEffect(() => {
    if (!activeSelectedEdge) {
      return;
    }

    if (isDimmedEdge(activeSelectedEdge)) {
      setSelectedEdge(null);
      setSelectedConnectionId(null);
      setEditingPathwayConnection(null);
      onSelectedPathwayIdChange?.(undefined);
    }
  }, [activeSelectedEdge, onSelectedPathwayIdChange]);

  const filterStats = useMemo<FilterStats>(
    () => buildFilterStats({ initialNodes, initialEdges }),
    [initialNodes, initialEdges],
  );

  useEffect(() => {
    const routeNodeId = selectedNodeId ?? null;

    if (routeNodeId === lastHandledRouteNodeIdRef.current) {
      return;
    }

    if (!routeNodeId) {
      lastHandledRouteNodeIdRef.current = null;
      return;
    }

    const node = nodes.find((item) => item.id === routeNodeId);
    if (!node) {
      return;
    }

    if ((node.data as CustomNodeData | undefined)?.isDimmed) {
      onSelectedNodeIdChange?.(undefined);
      return;
    }

    lastHandledRouteNodeIdRef.current = routeNodeId;
    setSelectedNode(node);
    onSetClickInfo?.(
      pathwayData?.stops?.find((stop: any) => String(stop.stop_id) === routeNodeId) ?? node.data,
    );
    const isEditingSelectedNode =
      isNodeFormOpen &&
      activeNodeFormClickInfo?.stop_id != null &&
      String(activeNodeFormClickInfo.stop_id) === routeNodeId;

    if (!isEditingSelectedNode) {
      setNodeFormOpenValue({ formType: null, state: false });
      setNodeFormClickInfo(undefined);
    }
    setSelectedEdge(null);
    setSelectedConnectionId(null);
    setPotentialEdge(null);
    setEditingPathwayConnection(null);
    setEdgeFormError(null);
  }, [
    activeNodeFormClickInfo,
    isNodeFormOpen,
    selectedNodeId,
    nodes,
    onSetClickInfo,
    pathwayData?.stops,
    setNodeFormClickInfo,
    setNodeFormOpenValue,
  ]);

  useEffect(() => {
    const routePathwayId = selectedPathwayId ?? null;

    if (routePathwayId === lastHandledRoutePathwayIdRef.current) {
      return;
    }

    if (
      potentialEdge ||
      !routePathwayId ||
      isNodeFormOpen ||
      Boolean(selectedNode) ||
      Boolean(selectedNodeId)
    ) {
      return;
    }

    const edge = edges.find((item) =>
      getSortedConnectionsFromEdge(item).some(
        (connection) => getConnectionId(connection) === routePathwayId,
      ),
    );

    if (edge) {
      if ((edge.data as PathwayEdgeData | undefined)?.isDimmed) {
        onSelectedPathwayIdChange?.(undefined);
        return;
      }

      const isEditingSelectedPathway =
        editingPathwayConnection != null &&
        getConnectionId(editingPathwayConnection) === routePathwayId;

      lastHandledRoutePathwayIdRef.current = routePathwayId;
      setNodeFormOpenValue({ formType: null, state: false });
      setNodeFormClickInfo(undefined);
      setSelectedEdge(edge);
      setSelectedNode(null);
      setSelectedConnectionId(routePathwayId);

      if (!isEditingSelectedPathway) {
        setPotentialEdge(null);
        setEditingPathwayConnection(null);
        setEdgeFormError(null);
      }
      return;
    }

    if (edges.length > 0 && !potentialEdge && !editingPathwayConnection) {
      lastHandledRoutePathwayIdRef.current = null;
      onSelectedPathwayIdChange?.(undefined);
    }
  }, [
    selectedPathwayId,
    edges,
    potentialEdge,
    isNodeFormOpen,
    selectedNode,
    selectedNodeId,
    editingPathwayConnection,
    onSelectedPathwayIdChange,
    setNodeFormClickInfo,
    setNodeFormOpenValue,
  ]);

  useEffect(() => {
    if (initialNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      manualNodePositionsRef.current.clear();
      return;
    }

    setIsLayouting(true);
    const viewModeChanged = previousViewModeRef.current !== viewMode;
    const previousViewport =
      !viewModeChanged && hasAutoFitRef.current
        ? (reactFlowInstanceRef.current?.getViewport?.() ?? null)
        : null;
    previousViewModeRef.current = viewMode;

    if (viewModeChanged) {
      manualNodePositionsRef.current.clear();
    }

    const { layoutedNodes, validEdges, nextManualNodePositions } = buildLayoutedFlowGraph({
      initialNodes,
      initialEdges,
      viewMode,
      manualNodePositions: manualNodePositionsRef.current,
      preserveManualPositions: !viewModeChanged,
    });

    manualNodePositionsRef.current = nextManualNodePositions;
    setNodes(layoutedNodes);
    storeNodePositions(layoutedNodes);
    setEdges(validEdges);

    if (reactFlowInstanceRef.current && (viewModeChanged || !hasAutoFitRef.current)) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          reactFlowInstanceRef.current?.fitView({
            nodes: layoutedNodes,
            padding: 0.15,
            maxZoom: 1.2,
          });
        });
      });
      hasAutoFitRef.current = true;
    } else if (previousViewport && reactFlowInstanceRef.current) {
      requestAnimationFrame(() => {
        reactFlowInstanceRef.current?.setViewport?.(previousViewport, {
          duration: 0,
        });
      });
    }

    setIsLayouting(false);
  }, [initialNodes, initialEdges, setNodes, setEdges, storeNodePositions, viewMode]);

  const onInit = useCallback((instance: any) => {
    reactFlowInstanceRef.current = instance;
    setIsFlowReady(true);
    console.log("React Flow initialized", {
      nodes: instance.getNodes().length,
      edges: instance.getEdges().length,
    });
  }, []);

  const focusNodeById = useCallback(
    (nodeId?: string | null) => {
      focusNodeInFlow({
        nodeId,
        reactFlowInstance: reactFlowInstanceRef.current,
        nodes,
      });
    },
    [nodes],
  );

  useEffect(() => {
    const routeNodeId = selectedNodeId ?? null;

    if (!routeNodeId) {
      lastFocusedRouteNodeIdRef.current = null;
      return;
    }

    if (!isFlowReady || routeNodeId === lastFocusedRouteNodeIdRef.current) {
      return;
    }

    const node = nodes.find((item) => item.id === routeNodeId);
    if (!node || Boolean((node.data as CustomNodeData | undefined)?.isDimmed)) {
      return;
    }

    lastFocusedRouteNodeIdRef.current = routeNodeId;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        focusNodeById(routeNodeId);
      });
    });
  }, [focusNodeById, isFlowReady, nodes, selectedNodeId]);

  const focusEdgePair = useCallback(
    (sourceId?: string | null, targetId?: string | null) => {
      focusEdgePairInFlow({
        sourceId,
        targetId,
        reactFlowInstance: reactFlowInstanceRef.current,
        nodes,
        focusNodeById,
      });
    },
    [focusNodeById, nodes],
  );

  const openCreatePathwayForPair = useCallback(
    (connection: Connection, existingEdge?: Edge | null) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      const sourceNode = displayNodes.find((node) => node.id === connection.source);
      const targetNode = displayNodes.find((node) => node.id === connection.target);

      if (!sourceNode || !targetNode) {
        return;
      }

      setNodeFormOpenValue({ formType: null, state: false });
      setNodeFormClickInfo(undefined);
      pendingSelectedConnectionIdRef.current = null;
      setSelectedEdge(null);
      setSelectedConnectionId(null);
      setSelectedNode(null);
      setEditingPathwayConnection(null);
      setEdgeFormError(null);

      requestAnimationFrame(() => {
        setPotentialEdge({
          connection: {
            ...connection,
            ...getConnectionHandleIds(sourceNode, targetNode, viewMode),
          },
          sourceNode,
          targetNode,
          existingEdgeId: existingEdge?.id ?? null,
        });
        setSelectedEdge(existingEdge ?? null);
      });
    },
    [displayNodes, setNodeFormClickInfo, setNodeFormOpenValue, viewMode],
  );

  const onReconnect = useCallback(
    async (oldEdge: Edge, newConnection: Connection) => {
      setEdges((els) => reconnectEdge(oldEdge, newConnection, els));

      if (!conn || !oldEdge.data?.connections) return;

      const connections = oldEdge.data.connections as any[];
      const newSource = newConnection.source!;
      const newTarget = newConnection.target!;

      try {
        for (const c of connections) {
          await deletePathway({ conn, SelectPathway: c });
          const pathwayId = await generatePathwayId({ conn });
          await insertPathway({
            conn,
            pathway_id: pathwayId,
            from_stop_id: newSource,
            to_stop_id: newTarget,
            pathway_mode: c.pathway_mode ?? 1,
            is_bidirectional: c.is_bidirectional ?? (c.direction_type === "bidirectional" ? 1 : 0),
            traversal_time: c.traversal_time,
            length: c.length,
            stair_count: c.stair_count,
          });
        }
        await refreshPathwayFlow({ conn, queryClient });
      } catch (err) {
        logger.error("Failed to reconnect pathway:", err);
        alert("Failed to reconnect. Please try again.");
        await refreshPathwayFlow({ conn, queryClient });
      }
    },
    [conn, queryClient, setEdges],
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      if (
        edge.id.startsWith("detached-draft-edge-") ||
        Boolean((edge.data as PathwayEdgeData | undefined)?.isDimmed)
      ) {
        return;
      }
      const edgeConnections = getSortedConnectionsFromEdge(edge);
      const nextPathwayId = edgeConnections.length > 0 ? getConnectionId(edgeConnections[0]) : null;
      flushSync(() => {
        setNodeFormOpenValue({ formType: null, state: false });
        setNodeFormClickInfo(undefined);
        setSelectedEdge(edge);
        setSelectedNode(null);
        pendingSelectedConnectionIdRef.current = null;
        setSelectedConnectionId(nextPathwayId);
        setSidebarOpen(false);
        setPotentialEdge(null);
        setEditingPathwayConnection(null);
        setEdgeFormError(null);
      });

      requestAnimationFrame(() => {
        lastHandledRoutePathwayIdRef.current = null;
      });
    },
    [setNodeFormClickInfo, setNodeFormOpenValue],
  );

  const onPaneClick = useCallback(() => {
    flushSync(() => {
      pendingSelectedConnectionIdRef.current = null;
      setNodeFormOpenValue({ formType: null, state: false });
      setNodeFormClickInfo(undefined);
      setSelectedEdge(null);
      setSelectedNode(null);
      setSelectedConnectionId(null);
      setPotentialEdge(null);
      setEditingPathwayConnection(null);
      setEdgeFormError(null);
    });

    requestAnimationFrame(() => {
      lastHandledRoutePathwayIdRef.current = null;
      lastHandledRouteNodeIdRef.current = null;
    });
  }, [setNodeFormClickInfo, setNodeFormOpenValue]);

  const {
    handleDeletePathway,
    handleEditPathway,
    openPathwayEditForm,
    closeEdgePanel,
    returnToAllConnections,
    handleEdgeFormSubmit,
    handleDeleteEdge,
  } = useEdgeHandlers({
    conn,
    queryClient,
    edges,
    edgePanelEdge,
    edgePanelMode,
    selectedConnectionId,
    editingPathwayConnection,
    isEditingDetachedConnectionDraft,
    edgeFormValues,
    potentialEdge,
    pendingSelectedConnectionIdRef,
    setDetachedConnectionDrafts,
    setDetachedConnectionEndpointFocus,
    setNodeFormOpenValue,
    setNodeFormClickInfo,
    setSelectedNode,
    setSelectedEdge,
    setSelectedConnectionId,
    setPotentialEdge,
    setEditingPathwayConnection,
    setEdgeFormError,
    setEdgeFormSubmitting,
    onSelectedNodeIdChange,
    onSelectedPathwayIdChange,
  });

  const { closeNodeForm, openNodeForm, handleDeleteNode, handleEditNode, onNodeClick } =
    useNodeHandlers({
      conn,
      queryClient,
      nodes,
      pathwayData,
      selectedNodeId,
      detachedConnectionDraftsByNodeId,
      editingDetachedConnectionDraft,
      detachedConnectionEndpointFocus,
      openDetachedConnectionDraftForEditing,
      handleDetachedEndpointSelection,
      closeEdgePanel,
      onSetClickInfo,
      onSelectedNodeIdChange,
      onSelectedPathwayIdChange,
      setNodeFormOpenValue,
      setNodeFormClickInfo,
      setSelectedEdge,
      setSelectedNode,
      setSelectedConnectionId,
      setPotentialEdge,
      setEditingPathwayConnection,
      setEdgeFormError,
      setSidebarOpen,
      setQueuedOrphanConnections,
      setDetachedConnectionEndpointFocus,
    });

  useEffect(() => {
    if (requestedEditTarget !== "node") {
      return;
    }

    if (!selectedNodeId) {
      onRequestedEditTargetHandled?.();
      return;
    }

    const nodeData =
      pathwayData?.stops?.find((stop: any) => String(stop.stop_id) === String(selectedNodeId)) ??
      null;

    if (!nodeData) {
      onRequestedEditTargetHandled?.();
      return;
    }

    focusNodeById(String(nodeData.stop_id));
    openNodeForm("edit", nodeData);
    onRequestedEditTargetHandled?.();
  }, [
    focusNodeById,
    onRequestedEditTargetHandled,
    openNodeForm,
    pathwayData?.stops,
    requestedEditTarget,
    selectedNodeId,
  ]);

  useEffect(() => {
    if (requestedEditTarget !== "pathway") {
      return;
    }

    if (!selectedPathwayId) {
      onRequestedEditTargetHandled?.();
      return;
    }

    const connection =
      pathwayData?.connections?.find(
        (item: any) => getConnectionId(item) === String(selectedPathwayId),
      ) ?? null;

    if (!connection) {
      onRequestedEditTargetHandled?.();
      return;
    }

    focusEdgePair(
      connection?.from_stop_id != null ? String(connection.from_stop_id) : null,
      connection?.to_stop_id != null ? String(connection.to_stop_id) : null,
    );
    openPathwayEditForm(connection);
    onRequestedEditTargetHandled?.();
  }, [
    focusEdgePair,
    onRequestedEditTargetHandled,
    openPathwayEditForm,
    pathwayData?.connections,
    requestedEditTarget,
    selectedPathwayId,
  ]);

  const handleEdgeFormFieldChange = useCallback((field: keyof EdgeFormValues, value: string) => {
    const nextValue = DECIMAL_EDGE_FORM_FIELDS.has(field)
      ? normalizeDecimalInputString(value)
      : value;

    setEdgeFormValues((current) => ({
      ...current,
      [field]: nextValue,
    }));
    setEdgeFormError(null);
  }, []);

  const showEdgeOptionalField = useCallback((field: EdgeOptionalFieldKey) => {
    setVisibleEdgeOptionalFields((current) => ({
      ...current,
      [field]: true,
    }));
  }, []);

  const selectedNodeDeleteId = selectedNode?.id ?? selectedNodeId ?? null;

  const triggerSelectedDeleteAction = useCallback(() => {
    if (selectedNodeDeleteId && !isNodeFormOpen) {
      void handleDeleteNode(selectedNodeDeleteId);
      return true;
    }

    if (selectedKeyboardConnection) {
      void handleDeletePathway(selectedKeyboardConnection);
      return true;
    }

    if (edgePanelEdge && edgePanelMode === "list") {
      void handleDeleteEdge(edgePanelEdge.id);
      return true;
    }

    return false;
  }, [
    edgePanelEdge,
    edgePanelMode,
    handleDeleteEdge,
    handleDeleteNode,
    handleDeletePathway,
    isNodeFormOpen,
    selectedKeyboardConnection,
    selectedNodeDeleteId,
  ]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        !["Delete", "Backspace"].includes(event.key) ||
        isEditableKeyboardTarget(event.target)
      ) {
        return;
      }

      const didHandleDelete = triggerSelectedDeleteAction();
      if (!didHandleDelete) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [triggerSelectedDeleteAction]);

  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          onDelete: () => handleDeleteEdge(edge.id),
        },
      })),
    );
  }, [handleDeleteEdge, setEdges]);

  const pathwayLegendItems = useMemo(() => {
    if (!pathwayData?.connections) return [];

    const pathwayTypes = new Set<string>();
    pathwayData.connections.forEach((conn: any) => {
      if (conn.pathway_mode_name) {
        pathwayTypes.add(conn.pathway_mode_name);
      }
    });

    return Array.from(pathwayTypes).map((type) => ({
      label: type,
      color: rgbToHex(getPathwayColor(type, theme)),
    }));
  }, [pathwayData?.connections, theme]);

  const stopLegendItems = useMemo(() => {
    if (!pathwayData?.stops) return [];

    const stopTypes = new Set<string>();
    pathwayData.stops.forEach((stop: any) => {
      if (stop.location_type_name) {
        stopTypes.add(stop.location_type_name);
      }
    });

    return Array.from(stopTypes).map((type) => ({
      label: type === 'Stop' ? 'Platform' : type,
      color: rgbToHex(getStopColor(type, theme)),
    }));
  }, [pathwayData?.stops, theme]);

  const hasBottomPanels = !!(
    isNodeFormOpen ||
    edgePanelEdge ||
    potentialEdge ||
    editingPathwayConnection ||
    selectedNode
  );
  const hasEdgePanel = !!edgePanelEdge || !!potentialEdge || !!editingPathwayConnection;
  const activeBottomPanelKind: "nodeForm" | "edge" | "node" | null = isNodeFormOpen
    ? "nodeForm"
    : hasEdgePanel
      ? "edge"
      : selectedNode
        ? "node"
        : null;
  const hasScrollableEdgePanel =
    hasEdgePanel && (edgePanelMode !== "list" || edgePanelConnections.length > 1);
  const hasScrollableBottomPanel =
    activeBottomPanelKind === "nodeForm" ||
    (activeBottomPanelKind === "edge" && hasScrollableEdgePanel);
  const popupNodeSelection = useMemo(
    () =>
      getPopupNodeSelection({
        isNodeFormOpen,
        nodeFormMode,
        activeNodeFormClickInfo,
        activeBottomPanelKind,
        selectedNode,
        theme,
      }),
    [
      activeBottomPanelKind,
      activeNodeFormClickInfo,
      isNodeFormOpen,
      nodeFormMode,
      selectedNode,
      theme,
    ],
  );
  const popupEdgeSelection = useMemo(
    () =>
      getPopupEdgeSelection({
        activeBottomPanelKind,
        editingDetachedConnectionDraft,
        editingPathwayConnection,
        potentialEdge,
        edgePanelEdge,
        theme,
      }),
    [
      activeBottomPanelKind,
      edgePanelEdge,
      editingDetachedConnectionDraft,
      editingPathwayConnection,
      potentialEdge,
      theme,
    ],
  );
  const isEdgeFormValid =
    edgeFormValues.pathway_mode !== "" &&
    edgeFormValues.is_bidirectional !== "" &&
    (edgePanelMode !== "edit" ||
      (edgeFormValues.from_stop_id !== "" &&
        edgeFormValues.to_stop_id !== "" &&
        edgeFormValues.from_stop_id !== edgeFormValues.to_stop_id));
  const isEdgeFormDirty = JSON.stringify(edgeFormValues) !== JSON.stringify(edgeFormDefaults);

  useEffect(() => {
    setNodes((currentNodes) => {
      let didChange = false;

      const nextNodes = currentNodes.map((node) => {
        const nodeData = node.data as CustomNodeData;
        const isPopupSelected = popupNodeSelection?.nodeId === node.id;
        const popupSelectionColor = isPopupSelected ? popupNodeSelection?.color : undefined;

        if (
          Boolean(nodeData.isPopupSelected) === isPopupSelected &&
          nodeData.popupSelectionColor === popupSelectionColor
        ) {
          return node;
        }

        didChange = true;
        return {
          ...node,
          data: {
            ...nodeData,
            isPopupSelected,
            popupSelectionColor,
          },
        };
      });

      return didChange ? nextNodes : currentNodes;
    });

    setEdges((currentEdges) => {
      let didChange = false;

      const nextEdges = currentEdges.map((edge) => {
        const edgeData = (edge.data ?? {}) as PathwayEdgeData;
        const isPopupSelected = popupEdgeSelection?.edgeId
          ? edge.id === popupEdgeSelection.edgeId
          : popupEdgeSelection?.pairKey
            ? getCanonicalPairKey(edge.source, edge.target) === popupEdgeSelection.pairKey
            : false;
        const popupSelectionColor = isPopupSelected ? popupEdgeSelection?.color : undefined;

        if (
          Boolean(edgeData.isPopupSelected) === isPopupSelected &&
          edgeData.popupSelectionColor === popupSelectionColor
        ) {
          return edge;
        }

        didChange = true;
        return {
          ...edge,
          data: {
            ...edgeData,
            isPopupSelected,
            popupSelectionColor,
          },
        };
      });

      return didChange ? nextEdges : currentEdges;
    });
  }, [popupEdgeSelection, popupNodeSelection, setEdges, setNodes]);

  const handleCanvasPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!hasBottomPanels) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (bottomPanelsRef.current?.contains(target)) {
        return;
      }

      if (legendRef.current?.contains(target)) {
        return;
      }

      if (!target.closest(".react-flow")) {
        return;
      }

      if (
        target.closest(
          ".react-flow__node, .react-flow__edge, .react-flow__handle, .react-flow__controls",
        )
      ) {
        return;
      }

      if (selectedNode) {
        setSelectedNode(null);
        onSelectedNodeIdChange?.(undefined);
      }

      if (isNodeFormOpen) {
        closeNodeForm();
      }

      if (edgePanelEdge || potentialEdge || editingPathwayConnection) {
        closeEdgePanel();
      }
    },
    [
      closeEdgePanel,
      edgePanelEdge,
      editingPathwayConnection,
      hasBottomPanels,
      isNodeFormOpen,
      closeNodeForm,
      onSelectedNodeIdChange,
      potentialEdge,
      selectedNode,
    ],
  );

  return (
    <div className="w-full space-y-3">
      <PathwayFlowHeader
        selectedFromStop={selectedFromStop}
        onSelectedFromStopChange={onSelectedFromStopChange ?? (() => undefined)}
        selectedToStop={selectedToStop}
        onSelectedToStopChange={onSelectedToStopChange ?? (() => undefined)}
        fromStopOptions={fromStopOptions}
        toStopOptions={toStopOptions}
        wheelchairAccessibleOnly={wheelchairAccessibleOnly}
        onWheelchairAccessibleOnlyChange={setWheelchairAccessibleOnly}
        showWheelchairAccessibleSwitch={connectionFilterGraph.showWheelchairAccessibleSwitch}
        edgeLabelMode={edgeLabelMode}
        onEdgeLabelModeChange={setEdgeLabelMode}
        onCreateNode={() => openNodeForm("add")}
      />

      <div className="w-full border rounded-lg bg-background relative flex flex-col md:block md:h-[calc(100vh-300px)]">
        <FlowCanvasPane
          viewMode={viewMode}
          theme={theme}
          handleCanvasPointerDownCapture={handleCanvasPointerDownCapture}
          hasOrphanConnectionsSidebar={hasOrphanConnectionsSidebar}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          availableOrphanConnections={availableOrphanConnections}
          orphanPathwayIdFilter={orphanPathwayIdFilter}
          setOrphanPathwayIdFilter={setOrphanPathwayIdFilter}
          orphanPathwayIdOptions={orphanPathwayIdOptions}
          orphanPathwayTypeFilter={orphanPathwayTypeFilter}
          setOrphanPathwayTypeFilter={setOrphanPathwayTypeFilter}
          orphanPathwayTypeOptions={orphanPathwayTypeOptions}
          filteredAvailableOrphanConnections={filteredAvailableOrphanConnections}
          activeDetachedConnectionDraftPathwayId={activeDetachedConnectionDraftPathwayId}
          detachedConnectionDrafts={detachedConnectionDrafts}
          startDetachedConnectionRepair={startDetachedConnectionRepair}
          displayNodes={displayNodes}
          displayEdges={displayEdges}
          onCanvasDragOver={onCanvasDragOver}
          onCanvasDrop={onCanvasDrop}
          handleNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={onInit}
          handleNodeDragStop={handleNodeDragStop}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onConnect={onConnect}
          onReconnect={onReconnect}
          legendRef={legendRef}
          legendOpen={legendOpen}
          setLegendOpen={setLegendOpen}
          pathwayLegendItems={pathwayLegendItems}
          stopLegendItems={stopLegendItems}
        />
        <PathwayFlowSelectionPopup
          ref={bottomPanelsRef}
          activeBottomPanelKind={activeBottomPanelKind}
          hasScrollableBottomPanel={hasScrollableBottomPanel}
          nodeFormPanelProps={{
            theme,
            nodeFormMode,
            activeNodeFormClickInfo,
            selectedNode,
            parentStationId,
            isNodeFormOpen,
            closeNodeForm,
            focusNodeById,
            pathwayStops: pathwayData?.stops || [],
            setNodeFormOpenValue,
            setNodeFormClickInfo,
          }}
          nodeInfoPanelProps={
            selectedNode && selectedNodeDetails
              ? {
                  selectedNode,
                  freshNodeData: selectedNodeDetails,
                  color: selectedNodePanelColor,
                  selectedFromStop,
                  selectedToStop,
                  setSelectedNode,
                  onSelectedFromStopChange,
                  onSelectedToStopChange,
                  openNodeForm,
                  focusNodeById,
                  handleDeleteNode,
                }
              : null
          }
          edgePanelProps={
            edgePanelEdge || potentialEdge || editingPathwayConnection
              ? {
                  theme,
                  edgePanelMode,
                  edgePanelEdge,
                  potentialEdge,
                  editingPathwayConnection,
                  selectedConnectionId,
                  edgePanelConnections,
                  isEditingDetachedConnectionDraft,
                  detachedConnectionEndpointFocus,
                  edgeFormValues,
                  edgeFormDefaults,
                  edgeFormSubmitting,
                  edgeFormError,
                  isEdgeFormValid,
                  isEdgeFormDirty,
                  visibleEdgeOptionalFields,
                  repairNodeOptions,
                  returnToAllConnections,
                  focusEdgePair,
                  openCreatePathwayForPair,
                  handleDeleteEdge,
                  closeEdgePanel,
                  setSelectedConnectionId,
                  handleEditPathway,
                  handleDeletePathway,
                  handleEdgeFormSubmit,
                  handleDetachedEndpointFocusChange,
                  handleDetachedEndpointSelection,
                  handleReverseDetachedEndpoints,
                  handleEdgeFormFieldChange,
                  showEdgeOptionalField,
                  setEdgeFormValues,
                  setEdgeFormError,
                }
              : null
          }
        />
      </div>
    </div>
  );
};
