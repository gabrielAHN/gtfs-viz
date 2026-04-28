import { rgbToHex } from "@/components/colorUtil";
import { getStopColor } from "@/components/style";

export function getActiveNodeFormClickInfo({
  nodeFormMode,
  nodeFormClickInfo,
  stops,
}: {
  nodeFormMode: "add" | "edit";
  nodeFormClickInfo: any;
  stops?: any[];
}) {
  if (nodeFormMode !== "edit") {
    return nodeFormClickInfo;
  }

  const nodeId = nodeFormClickInfo?.stop_id;
  if (!nodeId) {
    return nodeFormClickInfo;
  }

  return (
    stops?.find((stop: any) => String(stop.stop_id) === String(nodeId)) ??
    nodeFormClickInfo
  );
}

export function getSelectedNodeDetails({
  selectedNode,
  stops,
}: {
  selectedNode: any;
  stops?: any[];
}) {
  if (!selectedNode) {
    return null;
  }

  return (
    stops?.find((stop: any) => String(stop.stop_id) === selectedNode.id) ??
    null
  );
}

export function getSelectedNodePanelColor({
  selectedNode,
  selectedNodeDetails,
  theme,
}: {
  selectedNode: any;
  selectedNodeDetails: any;
  theme: string;
}) {
  if (!selectedNodeDetails) {
    return "hsl(var(--primary))";
  }

  return (
    selectedNode?.data?.color ||
    rgbToHex(
      getStopColor(selectedNodeDetails.location_type_name || "Unknown", theme),
    )
  );
}

export function getPopupNodeSelection({
  isNodeFormOpen,
  nodeFormMode,
  activeNodeFormClickInfo,
  activeBottomPanelKind,
  selectedNode,
  theme,
}: {
  isNodeFormOpen: boolean;
  nodeFormMode: "add" | "edit";
  activeNodeFormClickInfo: any;
  activeBottomPanelKind: "nodeForm" | "edge" | "node" | null;
  selectedNode: any;
  theme: string;
}) {
  if (
    isNodeFormOpen &&
    nodeFormMode === "edit" &&
    activeNodeFormClickInfo?.stop_id != null
  ) {
    return {
      nodeId: String(activeNodeFormClickInfo.stop_id),
      color: rgbToHex(
        getStopColor(
          activeNodeFormClickInfo.location_type_name || "Unknown",
          theme,
        ),
      ),
    };
  }

  if (activeBottomPanelKind === "node" && selectedNode) {
    return {
      nodeId: String(selectedNode.id),
      color:
        typeof selectedNode.data?.color === "string"
          ? selectedNode.data.color
          : rgbToHex(
              getStopColor(
                String(selectedNode.data?.locationType ?? "Unknown"),
                theme,
              ),
            ),
    };
  }

  return null;
}
