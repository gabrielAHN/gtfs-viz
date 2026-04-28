import { useCallback } from "react";
import type React from "react";
import type { Edge } from "@xyflow/react";
import { flushSync } from "react-dom";

import {
  deletePathway,
  generatePathwayId,
  insertPathway,
  updatePathway,
} from "@/lib/duckdb/DataEditing/editPathways";
import { refreshPathwayFlow } from "@/lib/duckdb/DataEditing/refreshPathwayFlow";
import { logger } from "@/lib/logger";

import type {
  DetachedConnectionDraft,
  DetachedConnectionEndpointFocus,
  EdgeFormValues,
} from "../core/types";
import {
  getConnectionId,
  getSortedConnectionsFromEdge,
  normalizeOptionalInteger,
  normalizeOptionalNumber,
  normalizeOptionalString,
} from "../core/shared";

export function useEdgeHandlers({
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
}: {
  conn: any;
  queryClient: any;
  edges: Edge[];
  edgePanelEdge: any;
  edgePanelMode: "list" | "create" | "edit";
  selectedConnectionId: string | null;
  editingPathwayConnection: any;
  isEditingDetachedConnectionDraft: boolean;
  edgeFormValues: EdgeFormValues;
  potentialEdge: any;
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
  setNodeFormOpenValue: (value: { formType: string | null; state: boolean }) => void;
  setNodeFormClickInfo: (value: any) => void;
  setSelectedNode: (value: any) => void;
  setSelectedEdge: (value: any) => void;
  setSelectedConnectionId: (value: string | null) => void;
  setPotentialEdge: (value: any) => void;
  setEditingPathwayConnection: (value: any) => void;
  setEdgeFormError: (value: string | null) => void;
  setEdgeFormSubmitting: (value: boolean) => void;
  onSelectedNodeIdChange?: (nodeId?: string) => void;
  onSelectedPathwayIdChange?: (pathwayId?: string) => void;
}) {
  const handleDeletePathway = useCallback(
    async (connection: any) => {
      if (!conn) {
        logger.error("No database connection");
        return;
      }

      try {
        await deletePathway({ conn, SelectPathway: connection });
        await refreshPathwayFlow({ conn, queryClient });

        if (getConnectionId(connection) === selectedConnectionId) {
          setSelectedConnectionId(null);
        }

        setDetachedConnectionDrafts((currentDrafts) =>
          currentDrafts.filter(
            (draft) =>
              String(draft.connection.pathway_id) !==
              String(connection.pathway_id),
          ),
        );
        setEditingPathwayConnection((current: any) =>
          current?.pathway_id === connection.pathway_id ? null : current,
        );
      } catch (error) {
        logger.error("Failed to delete pathway:", error);
        alert("Failed to delete pathway. Please try again.");
      }
    },
    [
      conn,
      queryClient,
      selectedConnectionId,
      setDetachedConnectionDrafts,
      setEditingPathwayConnection,
      setSelectedConnectionId,
    ],
  );

  const handleEditPathway = useCallback(
    (connection: any, existingEdge?: Edge | null) => {
      const connectionId = getConnectionId(connection);
      const matchingEdge =
        existingEdge ??
        edges.find((edge) =>
          getSortedConnectionsFromEdge(edge).some(
            (edgeConnection) =>
              getConnectionId(edgeConnection) === connectionId,
          ),
        ) ??
        null;

      flushSync(() => {
        setNodeFormOpenValue({ formType: null, state: false });
        setNodeFormClickInfo(undefined);
        setSelectedNode(null);
        setPotentialEdge(null);
        pendingSelectedConnectionIdRef.current = connectionId;
        setSelectedEdge(matchingEdge);
        setSelectedConnectionId(connectionId);
        setEditingPathwayConnection(connection);
        setEdgeFormError(null);
      });
    },
    [
      edges,
      pendingSelectedConnectionIdRef,
      setEditingPathwayConnection,
      setEdgeFormError,
      setNodeFormClickInfo,
      setNodeFormOpenValue,
      setPotentialEdge,
      setSelectedConnectionId,
      setSelectedEdge,
      setSelectedNode,
    ],
  );

  const openPathwayEditForm = useCallback(
    (connection: any, existingEdge?: Edge | null) => {
      handleEditPathway(connection, existingEdge);
    },
    [handleEditPathway],
  );

  const closeEdgePanel = useCallback(() => {
    const detachedDraftPathwayId =
      editingPathwayConnection?.pathway_id != null
        ? String(editingPathwayConnection.pathway_id)
        : null;

    if (detachedDraftPathwayId) {
      setDetachedConnectionDrafts((currentDrafts) =>
        currentDrafts.filter(
          (draft) =>
            String(draft.connection.pathway_id) !== detachedDraftPathwayId,
        ),
      );
    }

    flushSync(() => {
      setPotentialEdge(null);
      setEditingPathwayConnection(null);
      setEdgeFormError(null);
      setSelectedEdge(null);
      setSelectedConnectionId(null);
      setDetachedConnectionEndpointFocus("from");
    });
  }, [
    editingPathwayConnection,
    setDetachedConnectionDrafts,
    setDetachedConnectionEndpointFocus,
    setEditingPathwayConnection,
    setEdgeFormError,
    setPotentialEdge,
    setSelectedConnectionId,
    setSelectedEdge,
  ]);

  const returnToAllConnections = useCallback(() => {
    if (isEditingDetachedConnectionDraft || !edgePanelEdge) {
      closeEdgePanel();
      return;
    }

    const nextConnections = getSortedConnectionsFromEdge(edgePanelEdge);
    const nextSelectedId =
      selectedConnectionId &&
      nextConnections.some(
        (connection) => getConnectionId(connection) === selectedConnectionId,
      )
        ? selectedConnectionId
        : getConnectionId(nextConnections[0]);

    flushSync(() => {
      setPotentialEdge(null);
      setEditingPathwayConnection(null);
      setEdgeFormError(null);
      setSelectedEdge(edgePanelEdge);
      setSelectedConnectionId(nextSelectedId);
    });
  }, [
    closeEdgePanel,
    edgePanelEdge,
    isEditingDetachedConnectionDraft,
    selectedConnectionId,
    setEditingPathwayConnection,
    setEdgeFormError,
    setPotentialEdge,
    setSelectedConnectionId,
    setSelectedEdge,
  ]);

  const handleEdgeFormSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!conn) {
        setEdgeFormError("No pathway connection available");
        return;
      }

      setEdgeFormSubmitting(true);
      setEdgeFormError(null);

      const normalizedFromStopId = normalizeOptionalString(
        edgeFormValues.from_stop_id,
      );
      const normalizedToStopId = normalizeOptionalString(
        edgeFormValues.to_stop_id,
      );
      const fallbackCreateFromStopId = normalizeOptionalString(
        potentialEdge?.connection.source,
      );
      const fallbackCreateToStopId = normalizeOptionalString(
        potentialEdge?.connection.target,
      );
      const resolvedFromStopId =
        normalizedFromStopId ?? fallbackCreateFromStopId;
      const resolvedToStopId = normalizedToStopId ?? fallbackCreateToStopId;

      if (!resolvedFromStopId || !resolvedToStopId) {
        setEdgeFormSubmitting(false);
        setEdgeFormError("Select both nodes for this connection");
        return;
      }

      if (resolvedFromStopId === resolvedToStopId) {
        setEdgeFormSubmitting(false);
        setEdgeFormError("From and To nodes must be different");
        return;
      }

      const normalizedFormData = {
        from_stop_id: resolvedFromStopId,
        to_stop_id: resolvedToStopId,
        pathway_mode: parseInt(edgeFormValues.pathway_mode, 10),
        is_bidirectional: parseInt(edgeFormValues.is_bidirectional, 10),
        traversal_time: normalizeOptionalInteger(edgeFormValues.traversal_time),
        length: normalizeOptionalNumber(edgeFormValues.length),
        stair_count: normalizeOptionalInteger(edgeFormValues.stair_count),
        max_slope: normalizeOptionalNumber(edgeFormValues.max_slope),
        min_width: normalizeOptionalNumber(edgeFormValues.min_width),
        signposted_as: normalizeOptionalString(edgeFormValues.signposted_as),
        reversed_signposted_as: normalizeOptionalString(
          edgeFormValues.reversed_signposted_as,
        ),
      };

      try {
        if (edgePanelMode === "create") {
          if (!potentialEdge) {
            throw new Error("No pathway connection selected");
          }

          const pathwayId = await generatePathwayId({ conn });
          await insertPathway({
            conn,
            pathway_id: pathwayId,
            ...normalizedFormData,
          });

          await refreshPathwayFlow({ conn, queryClient });
          pendingSelectedConnectionIdRef.current = String(pathwayId);
          setPotentialEdge(null);
          return;
        }

        if (edgePanelMode === "edit") {
          if (!editingPathwayConnection) {
            throw new Error("No pathway connection selected");
          }

          await updatePathway({
            conn,
            SelectPathway: editingPathwayConnection,
            formData: normalizedFormData,
          });

          await refreshPathwayFlow({ conn, queryClient });
          pendingSelectedConnectionIdRef.current = String(
            editingPathwayConnection.pathway_id,
          );
          setDetachedConnectionDrafts((currentDrafts) =>
            currentDrafts.filter(
              (draft) =>
                String(draft.connection.pathway_id) !==
                String(editingPathwayConnection.pathway_id),
            ),
          );
          setEditingPathwayConnection(null);
        }
      } catch (error: any) {
        logger.error("Failed to save pathway connection:", error);
        setEdgeFormError(error?.message ?? "Failed to save pathway connection");
      } finally {
        setEdgeFormSubmitting(false);
      }
    },
    [
      conn,
      edgeFormValues,
      edgePanelMode,
      editingPathwayConnection,
      pendingSelectedConnectionIdRef,
      potentialEdge,
      queryClient,
      setDetachedConnectionDrafts,
      setEdgeFormError,
      setEdgeFormSubmitting,
      setEditingPathwayConnection,
      setPotentialEdge,
    ],
  );

  const handleDeleteEdge = useCallback(
    async (edgeId: string) => {
      if (!conn) {
        logger.error("No database connection");
        return;
      }

      const edge = edges.find((item) => item.id === edgeId);
      if (!edge || !edge.data?.connections) {
        logger.error("Edge or connections not found");
        return;
      }

      const connections = edge.data.connections as any[];

      try {
        for (const connection of connections) {
          await deletePathway({ conn, SelectPathway: connection });
        }

        await refreshPathwayFlow({ conn, queryClient });
        setSelectedEdge(null);
        setSelectedConnectionId(null);
      } catch (error) {
        logger.error("Failed to delete pathway(s):", error);
        alert("Failed to delete pathway(s). Please try again.");
      }
    },
    [
      conn,
      edges,
      queryClient,
      setSelectedConnectionId,
      setSelectedEdge,
    ],
  );

  return {
    handleDeletePathway,
    handleEditPathway,
    openPathwayEditForm,
    closeEdgePanel,
    returnToAllConnections,
    handleEdgeFormSubmit,
    handleDeleteEdge,
  };
}
