import { ArrowLeft, Edit, LocateFixed, Trash2, X } from "lucide-react";

import { rgbToHex } from "@/components/colorUtil";
import StopStationForm from "@/components/forms/StopStationForms";
import { getStopColor } from "@/components/style";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { Button } from "@/components/ui/button";

import { FlowPopupPanel } from "../core/shared";

type NodeFormPanelProps = {
  theme: string;
  nodeFormMode: "add" | "edit";
  activeNodeFormClickInfo: any;
  selectedNode: any;
  parentStationId?: string;
  isNodeFormOpen: boolean;
  closeNodeForm: () => void;
  focusNodeById: (nodeId: string) => void;
  pathwayStops: any[];
  setNodeFormOpenValue: (value: { formType: string | null; state: boolean }) => void;
  setNodeFormClickInfo: (value: any) => void;
};

export function PathwayFlowNodeFormPanel({
  theme,
  nodeFormMode,
  activeNodeFormClickInfo,
  selectedNode,
  parentStationId,
  isNodeFormOpen,
  closeNodeForm,
  focusNodeById,
  pathwayStops,
  setNodeFormOpenValue,
  setNodeFormClickInfo,
}: NodeFormPanelProps) {
  const nodeFormBorderColor =
    nodeFormMode === "edit" && activeNodeFormClickInfo
      ? rgbToHex(
          getStopColor(
            activeNodeFormClickInfo.location_type_name || "Unknown",
            theme,
          ),
        )
      : "hsl(var(--primary))";

  return (
    <FlowPopupPanel
      key={`node-form-${nodeFormMode}-${String(
        activeNodeFormClickInfo?.stop_id ?? parentStationId ?? "new",
      )}`}
      borderColor={nodeFormBorderColor}
      title={nodeFormMode === "edit" ? "Edit Node" : "Create Node"}
      subtitle={
        nodeFormMode === "edit"
          ? activeNodeFormClickInfo?.stop_id || "Selected node"
          : parentStationId
            ? `Parent station: ${parentStationId}`
            : "Create a new node"
      }
      subtitleAccent={
        activeNodeFormClickInfo?.location_type_name ? (
          <p
            className="text-xs font-semibold mt-1"
            style={{ color: nodeFormBorderColor }}
          >
            {activeNodeFormClickInfo.location_type_name}
          </p>
        ) : undefined
      }
      headerPrefix={
        nodeFormMode === "edit" && selectedNode ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={closeNodeForm}
            className="h-7 px-2 text-[10px]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
        ) : undefined
      }
      headerActions={
        <div className="flex items-center gap-1">
          {nodeFormMode === "edit" && activeNodeFormClickInfo?.stop_id && (
            <Button
              variant="icon"
              onClick={() => focusNodeById(String(activeNodeFormClickInfo.stop_id))}
              className="h-8 w-8"
              title="Focus Node"
            >
              <LocateFixed className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={closeNodeForm}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      }
      fillHeight={true}
    >
      <StopStationForm
        Data={pathwayStops}
        OpenValue={{
          formType: nodeFormMode,
          state: isNodeFormOpen,
        }}
        setOpenValue={(value) => {
          if (!value.state) {
            closeNodeForm();
            return;
          }

          setNodeFormOpenValue(value);
        }}
        ClickInfo={activeNodeFormClickInfo}
        setClickInfo={setNodeFormClickInfo}
        type="stop"
        parentStation={parentStationId}
        inline={true}
        hideHeader={true}
        showConversionActions={false}
        showLevelField={true}
      />
    </FlowPopupPanel>
  );
}

type NodeInfoPanelProps = {
  selectedNode: any;
  freshNodeData: any;
  color: string;
  selectedFromStop?: string;
  selectedToStop?: string;
  setSelectedNode: (value: any) => void;
  onSelectedFromStopChange?: (stopId?: string) => void;
  onSelectedToStopChange?: (stopId?: string) => void;
  openNodeForm: (mode: "add" | "edit", clickInfo?: any) => void;
  focusNodeById: (nodeId: string) => void;
  handleDeleteNode: (nodeId: string) => void;
};

export function PathwayFlowNodeInfoPanel({
  selectedNode,
  freshNodeData,
  color,
  selectedFromStop,
  selectedToStop,
  setSelectedNode,
  onSelectedFromStopChange,
  onSelectedToStopChange,
  openNodeForm,
  focusNodeById,
  handleDeleteNode,
}: NodeInfoPanelProps) {
  return (
    <FlowPopupPanel
      key={`node-info-${String(selectedNode.id)}`}
      borderColor={color}
      title="Node Information"
      subtitle={
        <span className="flex items-center gap-1">
          {freshNodeData.location_type_name || "Unknown Type"}
          {freshNodeData.status && freshNodeData.status !== "" && (
            <EditIndicator
              status={freshNodeData.status}
              className="h-3 w-3"
            />
          )}
        </span>
      }
      headerActions={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedNode(null);
          }}
          className="h-7 w-7 p-0"
          title="Close Node"
        >
          <X className="h-4 w-4" />
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div className="text-muted-foreground">Stop ID:</div>
          <div className="font-mono font-semibold text-[10px]">
            {freshNodeData.stop_id || "N/A"}
          </div>

          <div className="text-muted-foreground">Stop Name:</div>
          <div className="text-[10px]">{freshNodeData.stop_name || "N/A"}</div>

          {freshNodeData.wheelchair_status && (
            <>
              <div className="text-muted-foreground">Wheelchair:</div>
              <div className="font-semibold text-[10px]">
                {freshNodeData.wheelchair_status}
              </div>
            </>
          )}

          {freshNodeData.stop_lat != null && freshNodeData.stop_lon != null && (
            <>
              <div className="text-muted-foreground">Latitude:</div>
              <div className="font-mono text-[10px]">
                {Number(freshNodeData.stop_lat).toFixed(6)}
              </div>

              <div className="text-muted-foreground">Longitude:</div>
              <div className="font-mono text-[10px]">
                {Number(freshNodeData.stop_lon).toFixed(6)}
              </div>
            </>
          )}
        </div>

        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium">Route Ends</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={
                  selectedFromStop === String(freshNodeData.stop_id)
                    ? "default"
                    : "outline"
                }
                size="sm"
                disabled={
                  selectedFromStop === String(freshNodeData.stop_id) ||
                  selectedToStop === String(freshNodeData.stop_id)
                }
                onClick={() => {
                  onSelectedFromStopChange?.(String(freshNodeData.stop_id));
                  setSelectedNode(null);
                }}
                className="h-8 px-2 text-xs"
              >
                Pick From
              </Button>
              <Button
                type="button"
                variant={
                  selectedToStop === String(freshNodeData.stop_id)
                    ? "default"
                    : "outline"
                }
                size="sm"
                disabled={
                  selectedFromStop === String(freshNodeData.stop_id) ||
                  selectedToStop === String(freshNodeData.stop_id)
                }
                onClick={() => {
                  onSelectedToStopChange?.(String(freshNodeData.stop_id));
                  setSelectedNode(null);
                }}
                className="h-8 px-2 text-xs"
              >
                Pick To
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="icon"
              onClick={() => {
                focusNodeById(selectedNode.id);
              }}
              className="h-8 w-8"
              title="Focus Node"
            >
              <LocateFixed className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="icon"
              onClick={() => {
                openNodeForm("edit", freshNodeData);
              }}
              className="h-8 w-8"
              title="Edit Node"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="icon"
              onClick={() => {
                handleDeleteNode(selectedNode.id);
              }}
              className="h-8 w-8 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Delete Node"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </FlowPopupPanel>
  );
}
