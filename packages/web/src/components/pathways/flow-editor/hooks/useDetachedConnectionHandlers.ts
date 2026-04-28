import { useCallback } from "react";
import type React from "react";
import type { Connection, Edge, Node } from "@xyflow/react";

import { logger } from "@/lib/logger";

import type {
  DetachedConnectionDraft,
  DetachedConnectionEndpointFocus,
  EdgeFormValues,
  ViewMode,
} from "../core/types";
import {
  DETACHED_CONNECTION_MIME,
  edgeMatchesCanonicalPair,
  getConnectionHandleIds,
  getDetachedConnectionDraftConnection,
  getDetachedConnectionDraftEndpointField,
  getDetachedConnectionNodeId,
  getNextDetachedConnectionDraftEndpoints,
} from "../core/shared";

export function useDetachedConnectionHandlers({
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
}: {
  detachedConnectionDraftsByPathwayId: Map<string, DetachedConnectionDraft>;
  detachedConnectionDraftsByNodeId: Map<string, DetachedConnectionDraft>;
  editingDetachedConnectionDraft: DetachedConnectionDraft | null;
  editingPathwayConnection: any;
  edgeFormValues: EdgeFormValues;
  displayNodes: Node[];
  edges: Edge[];
  viewMode: ViewMode;
  reactFlowInstanceRef: React.MutableRefObject<any>;
  pendingSelectedConnectionIdRef: React.MutableRefObject<string | null>;
  setDetachedConnectionDrafts: React.Dispatch<
    React.SetStateAction<DetachedConnectionDraft[]>
  >;
  setDetachedConnectionEndpointFocus: (
    value:
      | DetachedConnectionEndpointFocus
      | ((
          current: DetachedConnectionEndpointFocus,
        ) => DetachedConnectionEndpointFocus),
  ) => void;
  setEdgeFormValues: React.Dispatch<React.SetStateAction<EdgeFormValues>>;
  setEdgeFormError: (value: string | null) => void;
  setNodeFormOpenValue: (value: { formType: string | null; state: boolean }) => void;
  setNodeFormClickInfo: (value: any) => void;
  setSelectedEdge: (value: any) => void;
  setSelectedNode: (value: any) => void;
  setSelectedConnectionId: (value: string | null) => void;
  setPotentialEdge: (value: any) => void;
  setEditingPathwayConnection: (value: any) => void;
  setSidebarOpen: (value: boolean) => void;
  onSelectedNodeIdChange?: (nodeId?: string) => void;
  onSelectedPathwayIdChange?: (pathwayId?: string) => void;
}) {
  const openDetachedConnectionDraftForEditing = useCallback(
    (draft: DetachedConnectionDraft) => {
      const draftConnection = getDetachedConnectionDraftConnection(draft, {
        includeOriginalEndpointFallback: false,
      });

      setNodeFormOpenValue({ formType: null, state: false });
      setNodeFormClickInfo(undefined);
      setSelectedEdge(null);
      setSelectedNode(null);
      setPotentialEdge(null);
      setEditingPathwayConnection(draftConnection);
      setSelectedConnectionId(null);
      setSidebarOpen(false);
      setEdgeFormError(null);
      setDetachedConnectionEndpointFocus(
        !draftConnection.from_stop_id
          ? "from"
          : !draftConnection.to_stop_id
            ? "to"
            : "from",
      );
    },
    [
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

  const startDetachedConnectionRepair = useCallback(
    (connection: any) => {
      const pathwayId = String(connection?.pathway_id ?? "");
      if (!pathwayId || connection?.status === "deleted") {
        return;
      }

      const existingDraft =
        detachedConnectionDraftsByPathwayId.get(pathwayId) ?? null;
      const nextDraft =
        existingDraft ??
        ({
          nodeId: getDetachedConnectionNodeId(pathwayId),
          connection,
          position: { x: 0, y: 0 },
          fromStopId: null,
          toStopId: null,
        } satisfies DetachedConnectionDraft);

      setDetachedConnectionDrafts(() => [nextDraft]);
      setDetachedConnectionEndpointFocus(
        !connection?.from_stop_id
          ? "from"
          : !connection?.to_stop_id
            ? "to"
            : "from",
      );
      openDetachedConnectionDraftForEditing(nextDraft);
    },
    [
      detachedConnectionDraftsByPathwayId,
      openDetachedConnectionDraftForEditing,
      setDetachedConnectionDrafts,
      setDetachedConnectionEndpointFocus,
    ],
  );

  const onCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes(DETACHED_CONNECTION_MIME)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onCanvasDrop = useCallback(
    (event: React.DragEvent) => {
      const serializedConnection = event.dataTransfer.getData(
        DETACHED_CONNECTION_MIME,
      );

      if (!serializedConnection || !reactFlowInstanceRef.current) {
        return;
      }

      event.preventDefault();

      try {
        const connection = JSON.parse(serializedConnection);
        const pathwayId = String(connection?.pathway_id ?? "");
        if (!pathwayId) {
          return;
        }

        const nextPosition =
          reactFlowInstanceRef.current.screenToFlowPosition?.({
            x: event.clientX,
            y: event.clientY,
          }) ??
          reactFlowInstanceRef.current.project?.({
            x: event.clientX,
            y: event.clientY,
          });

        if (!nextPosition) {
          return;
        }

        const nodeId = getDetachedConnectionNodeId(pathwayId);
        const nextDraft = {
          nodeId,
          connection,
          position: nextPosition,
          fromStopId: null,
          toStopId: null,
        } satisfies DetachedConnectionDraft;

        setDetachedConnectionDrafts(() => [nextDraft]);
        setDetachedConnectionEndpointFocus("from");
        setSelectedEdge(null);
        setSelectedNode(null);
        setSelectedConnectionId(null);
        setPotentialEdge(null);
        setEditingPathwayConnection(null);
        setSidebarOpen(false);
        openDetachedConnectionDraftForEditing(nextDraft);
      } catch (error) {
        logger.error(
          "Failed to drop disconnected connection onto canvas:",
          error,
        );
      }
    },
    [
      openDetachedConnectionDraftForEditing,
      pendingSelectedConnectionIdRef,
      reactFlowInstanceRef,
      setDetachedConnectionDrafts,
      setDetachedConnectionEndpointFocus,
      setEditingPathwayConnection,
      setPotentialEdge,
      setSelectedConnectionId,
      setSelectedEdge,
      setSelectedNode,
      setSidebarOpen,
    ],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        connection.source === connection.target
      ) {
        return;
      }

      const sourceDraft = detachedConnectionDraftsByNodeId.get(
        connection.source,
      );
      const targetDraft = detachedConnectionDraftsByNodeId.get(
        connection.target,
      );

      if (sourceDraft || targetDraft) {
        if (sourceDraft && targetDraft) {
          return;
        }

        const draft = sourceDraft ?? targetDraft;
        const attachedNodeId = sourceDraft
          ? connection.target
          : connection.source;

        if (!draft || !attachedNodeId) {
          return;
        }

        const endpointField = getDetachedConnectionDraftEndpointField(
          sourceDraft ? connection.sourceHandle : connection.targetHandle,
        );
        const nextEndpoints = getNextDetachedConnectionDraftEndpoints({
          draft,
          nextStopId: attachedNodeId,
          endpointField,
        });
        const nextDraft = {
          ...draft,
          ...nextEndpoints,
        };

        setDetachedConnectionDrafts((currentDrafts) =>
          currentDrafts.map((currentDraft) => {
            if (currentDraft.nodeId !== draft.nodeId) {
              return currentDraft;
            }

            return nextDraft;
          }),
        );

        if (
          String(editingPathwayConnection?.pathway_id ?? "") ===
          String(draft.connection.pathway_id)
        ) {
          setEdgeFormValues((current) => ({
            ...current,
            from_stop_id: nextDraft.fromStopId ?? "",
            to_stop_id: nextDraft.toStopId ?? "",
          }));
          setEdgeFormError(null);
        } else {
          openDetachedConnectionDraftForEditing(nextDraft);
        }
        return;
      }

      const sourceNode = displayNodes.find((node) => node.id === connection.source);
      const targetNode = displayNodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) {
        return;
      }

      const existingEdge =
        edges.find((edge) =>
          edgeMatchesCanonicalPair(edge, connection.source!, connection.target!),
        ) ?? null;

      setNodeFormOpenValue({ formType: null, state: false });
      setNodeFormClickInfo(undefined);
      setPotentialEdge({
        connection: {
          ...connection,
          ...getConnectionHandleIds(sourceNode, targetNode, viewMode),
        },
        sourceNode,
        targetNode,
        existingEdgeId: existingEdge?.id ?? null,
      });
      pendingSelectedConnectionIdRef.current = null;
      setSelectedEdge(existingEdge);
      setSelectedConnectionId(null);
      setSelectedNode(null);
      setEditingPathwayConnection(null);
      setEdgeFormError(null);
    },
    [
      detachedConnectionDraftsByNodeId,
      displayNodes,
      edges,
      editingPathwayConnection,
      pendingSelectedConnectionIdRef,
      openDetachedConnectionDraftForEditing,
      setDetachedConnectionDrafts,
      setEdgeFormError,
      setEdgeFormValues,
      setEditingPathwayConnection,
      setNodeFormClickInfo,
      setNodeFormOpenValue,
      setPotentialEdge,
      setSelectedConnectionId,
      setSelectedEdge,
      setSelectedNode,
      viewMode,
    ],
  );

  const handleDetachedEndpointSelection = useCallback(
    (field: "from_stop_id" | "to_stop_id", value: string | undefined) => {
      const nextValue = value ?? "";

      setEdgeFormValues((current) => ({
        ...current,
        [field]: nextValue,
      }));
      setEdgeFormError(null);

      if (!editingDetachedConnectionDraft) {
        return;
      }

      setDetachedConnectionDrafts((currentDrafts) =>
        currentDrafts.map((draft) => {
          if (draft.nodeId !== editingDetachedConnectionDraft.nodeId) {
            return draft;
          }

          return {
            ...draft,
            [field === "from_stop_id" ? "fromStopId" : "toStopId"]:
              value ?? null,
          };
        }),
      );
    },
    [
      editingDetachedConnectionDraft,
      setDetachedConnectionDrafts,
      setEdgeFormError,
      setEdgeFormValues,
    ],
  );

  const handleDetachedEndpointFocusChange = useCallback(
    (focus: DetachedConnectionEndpointFocus) => {
      setDetachedConnectionEndpointFocus(focus);
      setEdgeFormError(null);
    },
    [setDetachedConnectionEndpointFocus, setEdgeFormError],
  );

  const handleReverseDetachedEndpoints = useCallback(() => {
      const nextFromStopId = edgeFormValues.to_stop_id;
      const nextToStopId = edgeFormValues.from_stop_id;

      setEdgeFormValues((current) => ({
        ...current,
        from_stop_id: nextFromStopId,
        to_stop_id: nextToStopId,
      }));
      setEdgeFormError(null);
      setDetachedConnectionEndpointFocus((current) =>
        current === "from" ? "to" : "from",
      );

      if (!editingDetachedConnectionDraft) {
        return;
      }

      setDetachedConnectionDrafts((currentDrafts) =>
        currentDrafts.map((draft) => {
          if (draft.nodeId !== editingDetachedConnectionDraft.nodeId) {
            return draft;
          }

          return {
            ...draft,
            fromStopId: nextFromStopId || null,
            toStopId: nextToStopId || null,
          };
        }),
      );
    }, [
      edgeFormValues.from_stop_id,
      edgeFormValues.to_stop_id,
      editingDetachedConnectionDraft,
      setDetachedConnectionDrafts,
      setDetachedConnectionEndpointFocus,
      setEdgeFormError,
      setEdgeFormValues,
    ]);

  return {
    openDetachedConnectionDraftForEditing,
    startDetachedConnectionRepair,
    onCanvasDragOver,
    onCanvasDrop,
    onConnect,
    handleDetachedEndpointSelection,
    handleDetachedEndpointFocusChange,
    handleReverseDetachedEndpoints,
  };
}
