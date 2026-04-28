import { useCallback } from "react";
import type React from "react";
import type { Node } from "@xyflow/react";

import { deleteStop } from "@/lib/duckdb/DataEditing/editingFn";
import { refreshPathwayFlow } from "@/lib/duckdb/DataEditing/refreshPathwayFlow";
import { logger } from "@/lib/logger";

import type {
  CustomNodeData,
  DetachedConnectionDraft,
  DetachedConnectionEndpointFocus,
} from "../core/types";
import { getDetachedConnectionDraftConnection } from "../core/shared";

export function useNodeHandlers({
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
}: {
  conn: any;
  queryClient: any;
  nodes: Node[];
  pathwayData?: { connections: any[]; stops: any[] };
  selectedNodeId?: string;
  detachedConnectionDraftsByNodeId: Map<string, DetachedConnectionDraft>;
  editingDetachedConnectionDraft: DetachedConnectionDraft | null;
  detachedConnectionEndpointFocus: DetachedConnectionEndpointFocus;
  openDetachedConnectionDraftForEditing: (
    draft: DetachedConnectionDraft,
  ) => void;
  handleDetachedEndpointSelection: (
    field: "from_stop_id" | "to_stop_id",
    value?: string,
  ) => void;
  closeEdgePanel: () => void;
  onSetClickInfo?: (info: any) => void;
  onSelectedNodeIdChange?: (nodeId?: string) => void;
  onSelectedPathwayIdChange?: (pathwayId?: string) => void;
  setNodeFormOpenValue: (value: { formType: string | null; state: boolean }) => void;
  setNodeFormClickInfo: (value: any) => void;
  setSelectedEdge: (value: any) => void;
  setSelectedNode: (value: any) => void;
  setSelectedConnectionId: (value: string | null) => void;
  setPotentialEdge: (value: any) => void;
  setEditingPathwayConnection: (value: any) => void;
  setEdgeFormError: (value: string | null) => void;
  setSidebarOpen: (value: boolean) => void;
  setQueuedOrphanConnections: React.Dispatch<React.SetStateAction<any[]>>;
  setDetachedConnectionEndpointFocus: (
    value:
      | DetachedConnectionEndpointFocus
      | ((
          current: DetachedConnectionEndpointFocus,
        ) => DetachedConnectionEndpointFocus),
  ) => void;
}) {
  const closeNodeForm = useCallback(() => {
    setNodeFormOpenValue({ formType: null, state: false });
    setNodeFormClickInfo(undefined);
  }, [setNodeFormClickInfo, setNodeFormOpenValue]);

  const openNodeForm = useCallback(
    (formType: "add" | "edit", nodeData?: any) => {
      closeEdgePanel();

      if (formType === "add") {
        setSelectedNode(null);
        onSetClickInfo?.(undefined);
        setNodeFormClickInfo(undefined);
      } else {
        if (!nodeData?.stop_id) {
          return;
        }

        const freshNodeData =
          pathwayData?.stops?.find(
            (stop: any) => String(stop.stop_id) === String(nodeData.stop_id),
          ) ?? nodeData;
        const matchingNode = nodes.find(
          (node) => node.id === String(freshNodeData.stop_id),
        );

        if (matchingNode) {
          setSelectedNode(matchingNode);
        } else {
          setSelectedNode(null);
        }

        onSetClickInfo?.(freshNodeData);
        setNodeFormClickInfo(freshNodeData);
      }

      setNodeFormOpenValue({ formType, state: true });
    },
    [
      closeEdgePanel,
      nodes,
      onSetClickInfo,
      pathwayData?.stops,
      setNodeFormClickInfo,
      setNodeFormOpenValue,
      setSelectedNode,
    ],
  );

  const handleDeleteNode = useCallback(
    async (stopId: string) => {
      if (!conn) {
        logger.error("No database connection");
        return;
      }

      const nodeData = pathwayData?.stops?.find(
        (stop: any) => String(stop.stop_id) === stopId,
      );
      if (!nodeData) {
        logger.error("Node data not found");
        return;
      }

      const affectedConnections =
        pathwayData?.connections?.filter(
          (connection: any) =>
            connection?.status !== "deleted" &&
            (String(connection.from_stop_id) === stopId ||
              String(connection.to_stop_id) === stopId),
        ) ?? [];
      const shouldOpenOrphanConnections = affectedConnections.length > 0;

      try {
        setNodeFormOpenValue({ formType: null, state: false });
        setNodeFormClickInfo(undefined);
        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectedConnectionId(null);
        setPotentialEdge(null);
        setEditingPathwayConnection(null);
        setEdgeFormError(null);
        onSetClickInfo?.(undefined);

        await deleteStop({ conn, SelectStop: nodeData });

        if (shouldOpenOrphanConnections) {
          setQueuedOrphanConnections((currentConnections) => {
            const nextConnectionsById = new Map(
              currentConnections.map((connection: any) => [
                String(connection.pathway_id),
                connection,
              ]),
            );

            affectedConnections.forEach((connection: any) => {
              nextConnectionsById.set(String(connection.pathway_id), connection);
            });

            return Array.from(nextConnectionsById.values());
          });
          setSidebarOpen(true);
        }

        await refreshPathwayFlow({
          conn,
          queryClient,
          refreshStops: true,
        });

        if (shouldOpenOrphanConnections) {
          setSidebarOpen(true);
        }
      } catch (error) {
        logger.error("Failed to delete node:", error);
      }
    },
    [
      conn,
      onSelectedNodeIdChange,
      onSelectedPathwayIdChange,
      onSetClickInfo,
      pathwayData?.connections,
      pathwayData?.stops,
      queryClient,
      setEdgeFormError,
      setEditingPathwayConnection,
      setNodeFormClickInfo,
      setNodeFormOpenValue,
      setPotentialEdge,
      setQueuedOrphanConnections,
      setSelectedConnectionId,
      setSelectedEdge,
      setSelectedNode,
      setSidebarOpen,
    ],
  );

  const handleEditNode = useCallback(
    (stopId: string) => {
      const nodeData = pathwayData?.stops?.find(
        (stop: any) => String(stop.stop_id) === stopId,
      );
      if (nodeData) {
        openNodeForm("edit", nodeData);
      }
    },
    [openNodeForm, pathwayData?.stops],
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      if (Boolean((node.data as CustomNodeData | undefined)?.isDimmed)) {
        return;
      }

      const detachedDraft = detachedConnectionDraftsByNodeId.get(node.id);

      if (detachedDraft) {
        setNodeFormOpenValue({ formType: null, state: false });
        setNodeFormClickInfo(undefined);
        setSelectedEdge(null);
        setSelectedNode(null);
        setSelectedConnectionId(null);
        setPotentialEdge(null);
        setSidebarOpen(false);
        setEdgeFormError(null);
        onSetClickInfo?.(getDetachedConnectionDraftConnection(detachedDraft));
        openDetachedConnectionDraftForEditing(detachedDraft);
        return;
      }

      if (editingDetachedConnectionDraft) {
        const replacementField =
          detachedConnectionEndpointFocus === "to"
            ? "to_stop_id"
            : "from_stop_id";

        handleDetachedEndpointSelection(replacementField, node.id);
        setSelectedEdge(null);
        setSelectedNode(null);
        setSelectedConnectionId(null);
        setDetachedConnectionEndpointFocus(
          replacementField === "from_stop_id" ? "to" : "from",
        );
        return;
      }

      setNodeFormOpenValue({ formType: null, state: false });
      setNodeFormClickInfo(undefined);
      setSelectedEdge(null);
      setSelectedNode(node);
      setSelectedConnectionId(null);
      setPotentialEdge(null);
      setEditingPathwayConnection(null);
      setEdgeFormError(null);
      setSidebarOpen(false);
      onSetClickInfo?.(
        pathwayData?.stops?.find(
          (stop: any) => String(stop.stop_id) === node.id,
        ) ?? node.data,
      );
    },
    [
      detachedConnectionDraftsByNodeId,
      detachedConnectionEndpointFocus,
      editingDetachedConnectionDraft,
      handleDetachedEndpointSelection,
      onSetClickInfo,
      openDetachedConnectionDraftForEditing,
      pathwayData?.stops,
      setDetachedConnectionEndpointFocus,
      setEdgeFormError,
      setEditingPathwayConnection,
      setNodeFormClickInfo,
      setNodeFormOpenValue,
      setPotentialEdge,
      setSelectedConnectionId,
      setSelectedEdge,
      setSelectedNode,
      setSidebarOpen,
    ],
  );

  return {
    closeNodeForm,
    openNodeForm,
    handleDeleteNode,
    handleEditNode,
    onNodeClick,
  };
}
