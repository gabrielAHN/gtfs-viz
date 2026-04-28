import type { Edge } from "@xyflow/react";

import { rgbToHex } from "@/components/colorUtil";
import { getPathwayColor } from "@/components/style";

import type {
  DetachedConnectionDraft,
  EdgeFormValues,
  PathwayEdgeData,
} from "../core/types";
import {
  createInitialEdgeFormValues,
  edgeMatchesCanonicalPair,
  getCanonicalPairKey,
  getConnectionId,
  getDetachedConnectionDraftConnection,
  getPathwayTypeLabel,
  getSortedConnectionsFromEdge,
} from "../core/shared";

export function getActiveSelectedEdge({
  selectedEdge,
  edges,
  selectedConnectionId,
  selectedPathwayId,
}: {
  selectedEdge: any;
  edges: Edge[];
  selectedConnectionId?: string | null;
  selectedPathwayId?: string;
}) {
  if (!selectedEdge) {
    return null;
  }

  const sameIdEdge = edges.find((edge) => edge.id === selectedEdge.id);
  if (sameIdEdge) {
    return sameIdEdge;
  }

  const sameConnectionEdge = edges.find((edge) =>
    getSortedConnectionsFromEdge(edge).some(
      (connection) =>
        getConnectionId(connection) ===
        (selectedConnectionId ?? selectedPathwayId ?? null),
    ),
  );

  if (sameConnectionEdge) {
    return sameConnectionEdge;
  }

  return (
    edges.find((edge) =>
      edgeMatchesCanonicalPair(edge, selectedEdge.source, selectedEdge.target),
    ) ?? null
  );
}

export function getEdgePanelEdge({
  activeSelectedEdge,
  potentialEdge,
  editingPathwayConnection,
  edges,
}: {
  activeSelectedEdge: any;
  potentialEdge: any;
  editingPathwayConnection: any;
  edges: Edge[];
}) {
  if (activeSelectedEdge) {
    return activeSelectedEdge;
  }

  if (potentialEdge?.existingEdgeId) {
    const matchingExistingEdge = edges.find(
      (edge) => edge.id === potentialEdge.existingEdgeId,
    );

    if (matchingExistingEdge) {
      return matchingExistingEdge;
    }
  }

  const panelSource =
    potentialEdge?.connection.source ??
    (editingPathwayConnection?.from_stop_id != null
      ? String(editingPathwayConnection.from_stop_id)
      : null);
  const panelTarget =
    potentialEdge?.connection.target ??
    (editingPathwayConnection?.to_stop_id != null
      ? String(editingPathwayConnection.to_stop_id)
      : null);

  if (!panelSource || !panelTarget) {
    return null;
  }

  return (
    edges.find((edge) =>
      edgeMatchesCanonicalPair(edge, panelSource, panelTarget),
    ) ?? null
  );
}

export function getSelectedKeyboardConnection({
  editingPathwayConnection,
  selectedConnectionId,
  edgePanelConnections,
  selectedEdgeConnections,
}: {
  editingPathwayConnection: any;
  selectedConnectionId: string | null;
  edgePanelConnections: any[];
  selectedEdgeConnections: any[];
}) {
  if (editingPathwayConnection) {
    return editingPathwayConnection;
  }

  if (!selectedConnectionId) {
    return null;
  }

  return (
    edgePanelConnections.find(
      (connection) => getConnectionId(connection) === selectedConnectionId,
    ) ??
    selectedEdgeConnections.find(
      (connection) => getConnectionId(connection) === selectedConnectionId,
    ) ??
    null
  );
}

export function getEditingDetachedConnectionDraft({
  editingPathwayConnection,
  detachedConnectionDraftsByPathwayId,
}: {
  editingPathwayConnection: any;
  detachedConnectionDraftsByPathwayId: Map<string, DetachedConnectionDraft>;
}) {
  if (editingPathwayConnection?.pathway_id == null) {
    return null;
  }

  return (
    detachedConnectionDraftsByPathwayId.get(
      String(editingPathwayConnection.pathway_id),
    ) ?? null
  );
}

export function getEdgeFormDefaults({
  edgePanelMode,
  editingDetachedConnectionDraft,
  editingPathwayConnection,
}: {
  edgePanelMode: "list" | "create" | "edit";
  editingDetachedConnectionDraft: DetachedConnectionDraft | null;
  editingPathwayConnection: any;
}): EdgeFormValues {
  if (edgePanelMode === "edit") {
    return createInitialEdgeFormValues(
      editingDetachedConnectionDraft
        ? getDetachedConnectionDraftConnection(editingDetachedConnectionDraft, {
            includeOriginalEndpointFallback: false,
          })
        : editingPathwayConnection,
    );
  }

  return createInitialEdgeFormValues();
}

export function getPopupEdgeSelection({
  activeBottomPanelKind,
  editingDetachedConnectionDraft,
  editingPathwayConnection,
  potentialEdge,
  edgePanelEdge,
  theme,
}: {
  activeBottomPanelKind: "nodeForm" | "edge" | "node" | null;
  editingDetachedConnectionDraft: DetachedConnectionDraft | null;
  editingPathwayConnection: any;
  potentialEdge: any;
  edgePanelEdge: any;
  theme: string;
}) {
  if (activeBottomPanelKind !== "edge") {
    return null;
  }

  if (editingDetachedConnectionDraft) {
    const connection = getDetachedConnectionDraftConnection(
      editingDetachedConnectionDraft,
      {
        includeOriginalEndpointFallback: false,
      },
    );

    return {
      edgeId: `detached-draft-preview-edge-${editingDetachedConnectionDraft.nodeId}`,
      pairKey: null,
      color: rgbToHex(getPathwayColor(getPathwayTypeLabel(connection), theme)),
    };
  }

  const sourceId =
    potentialEdge?.connection.source ??
    (editingPathwayConnection?.from_stop_id != null
      ? String(editingPathwayConnection.from_stop_id)
      : edgePanelEdge?.source ?? null);
  const targetId =
    potentialEdge?.connection.target ??
    (editingPathwayConnection?.to_stop_id != null
      ? String(editingPathwayConnection.to_stop_id)
      : edgePanelEdge?.target ?? null);

  if (!sourceId || !targetId) {
    return null;
  }

  const color =
    typeof edgePanelEdge?.style?.stroke === "string"
      ? edgePanelEdge.style.stroke
      : editingPathwayConnection
        ? rgbToHex(
            getPathwayColor(
              getPathwayTypeLabel(editingPathwayConnection),
              theme,
            ),
          )
        : "hsl(var(--primary))";

  return {
    edgeId: null,
    pairKey: getCanonicalPairKey(sourceId, targetId),
    color,
  };
}

export function isDimmedEdge(edge: Edge | null) {
  return Boolean((edge?.data as PathwayEdgeData | undefined)?.isDimmed);
}
