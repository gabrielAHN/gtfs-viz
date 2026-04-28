import type { FormEvent } from "react";
import { ArrowLeft, Edit, LocateFixed, Trash2, X } from "lucide-react";

import { rgbToHex } from "@/components/colorUtil";
import PathwayConnectionForm from "@/components/forms/PathwayConnectionForm";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { Button } from "@/components/ui/button";
import { getPathwayColor } from "@/components/style";

import type {
  DetachedConnectionEndpointFocus,
  EdgeFormValues,
  EdgeOptionalFieldKey,
} from "../core/types";
import {
  FlowPopupPanel,
  getConnectionDirectionSummary,
  getConnectionId,
  getPathwayTypeLabel,
  isModifiedConnectionStatus,
} from "../core/shared";

type ComboboxOption = {
  value: string;
  label: string;
  color?: string;
  searchLabel?: string;
};

type PathwayFlowEdgePanelProps = {
  theme: string;
  edgePanelMode: "list" | "create" | "edit";
  edgePanelEdge: any;
  potentialEdge: any;
  editingPathwayConnection: any;
  selectedConnectionId: string | null;
  edgePanelConnections: any[];
  isEditingDetachedConnectionDraft: boolean;
  detachedConnectionEndpointFocus: DetachedConnectionEndpointFocus;
  edgeFormValues: EdgeFormValues;
  edgeFormDefaults: EdgeFormValues;
  edgeFormSubmitting: boolean;
  edgeFormError: string | null;
  isEdgeFormValid: boolean;
  isEdgeFormDirty: boolean;
  visibleEdgeOptionalFields: Record<EdgeOptionalFieldKey, boolean>;
  repairNodeOptions: ComboboxOption[];
  returnToAllConnections: () => void;
  focusEdgePair: (sourceId?: string | null, targetId?: string | null) => void;
  openCreatePathwayForPair: (connection: any, existingEdge?: any) => void;
  handleDeleteEdge: (edgeId: string) => void;
  closeEdgePanel: () => void;
  setSelectedConnectionId: (value: string | null) => void;
  handleEditPathway: (connection: any, existingEdge?: any) => void;
  handleDeletePathway: (connection: any) => void;
  handleEdgeFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleDetachedEndpointFocusChange: (
    focus: DetachedConnectionEndpointFocus,
  ) => void;
  handleDetachedEndpointSelection: (
    field: "from_stop_id" | "to_stop_id",
    value?: string,
  ) => void;
  handleReverseDetachedEndpoints: () => void;
  handleEdgeFormFieldChange: (
    field: keyof EdgeFormValues,
    value: string,
  ) => void;
  showEdgeOptionalField: (field: EdgeOptionalFieldKey) => void;
  setEdgeFormValues: (value: EdgeFormValues) => void;
  setEdgeFormError: (value: string | null) => void;
};

function ConnectionSummaryCard({
  connection,
  index,
  edgePanelEdge,
  selectedConnectionId,
  theme,
  setSelectedConnectionId,
  handleEditPathway,
  handleDeletePathway,
}: {
  connection: any;
  index: number;
  edgePanelEdge: any;
  selectedConnectionId: string | null;
  theme: string;
  setSelectedConnectionId: (value: string | null) => void;
  handleEditPathway: (connection: any, existingEdge?: any) => void;
  handleDeletePathway: (connection: any) => void;
}) {
  const connectionId = getConnectionId(connection);
  const isSelected = selectedConnectionId === connectionId;
  const connectionTypeLabel = getPathwayTypeLabel(connection);
  const directionSummary = getConnectionDirectionSummary(connection);
  const connectionColor = rgbToHex(
    getPathwayColor(connectionTypeLabel, theme),
  );

  return (
    <div
      className={`p-3 rounded border cursor-pointer transition-all ${
        isSelected
          ? "border-2 bg-background shadow-md opacity-100"
          : "border bg-muted/15 opacity-70 hover:opacity-100 hover:bg-muted/30"
      }`}
      style={{
        borderColor: isSelected ? connectionColor : `${connectionColor}66`,
      }}
      onClick={() => {
        setSelectedConnectionId(connectionId);
      }}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div className="text-muted-foreground font-semibold col-span-2 flex items-start justify-between gap-2">
          <span className="flex items-center gap-1">
            <span>Connection {index + 1}</span>
            {isModifiedConnectionStatus(connection.status) ? (
              <EditIndicator
                status={connection.status}
                className="h-3 w-3"
              />
            ) : null}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="icon"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleEditPathway(connection, edgePanelEdge);
              }}
              className="h-7 w-7"
              title="Edit Connection"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="icon"
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                handleDeletePathway(connection);
              }}
              className="h-7 w-7 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Delete Connection"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="text-muted-foreground">Pathway ID:</div>
        <div className="font-mono font-semibold text-[10px]">
          {connection.pathway_id || "N/A"}
        </div>

        <div className="text-muted-foreground">Type:</div>
        <div className="font-semibold text-[10px]">{connectionTypeLabel}</div>

        <div className="text-muted-foreground">Direction:</div>
        <div className="space-y-0.5 text-[10px]">
          <div className="font-semibold">{directionSummary.badgeLabel}</div>
          <div className="font-mono text-muted-foreground break-all">
            {directionSummary.routeLabel}
          </div>
        </div>

        {connection.traversal_time !== null &&
          connection.traversal_time !== undefined && (
            <>
              <div className="text-muted-foreground">Travel Time:</div>
              <div className="font-semibold">{connection.traversal_time}s</div>
            </>
          )}

        {connection.length !== null && connection.length !== undefined && (
          <>
            <div className="text-muted-foreground">Length:</div>
            <div className="font-semibold">{connection.length}m</div>
          </>
        )}

        {connection.stair_count !== null &&
          connection.stair_count !== undefined && (
            <>
              <div className="text-muted-foreground">Stairs:</div>
              <div className="font-semibold">{connection.stair_count}</div>
            </>
          )}

        {connection.signposted_as && (
          <>
            <div className="text-muted-foreground">Signposted As:</div>
            <div className="font-semibold">{connection.signposted_as}</div>
          </>
        )}
      </div>
    </div>
  );
}


export function PathwayFlowEdgePanel({
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
}: PathwayFlowEdgePanelProps) {
  const panelSourceId =
    potentialEdge?.connection.source ??
    (edgePanelMode === "edit"
      ? edgeFormValues.from_stop_id ||
        (editingPathwayConnection?.from_stop_id != null
          ? String(editingPathwayConnection.from_stop_id)
          : null)
      : edgePanelEdge?.source) ??
    "Unassigned";
  const panelTargetId =
    potentialEdge?.connection.target ??
    (edgePanelMode === "edit"
      ? edgeFormValues.to_stop_id ||
        (editingPathwayConnection?.to_stop_id != null
          ? String(editingPathwayConnection.to_stop_id)
          : null)
      : edgePanelEdge?.target) ??
    "Unassigned";
  const distinctTypeCount = new Set(
    edgePanelConnections.map((connection) => getPathwayTypeLabel(connection)),
  ).size;
  const panelBorderColor =
    edgePanelEdge?.style?.stroke ||
    (editingPathwayConnection
      ? rgbToHex(
          getPathwayColor(getPathwayTypeLabel(editingPathwayConnection), theme),
        )
      : "hsl(var(--primary))");
  const isListMode = edgePanelMode === "list";
  const editingConnectionIndicator =
    edgePanelMode === "edit" &&
    isModifiedConnectionStatus(editingPathwayConnection?.status) ? (
      <EditIndicator
        status={editingPathwayConnection?.status}
        className="h-3 w-3"
      />
    ) : null;
  const handlePanelClose =
    !isListMode && edgePanelEdge && !isEditingDetachedConnectionDraft
      ? returnToAllConnections
      : closeEdgePanel;

  return (
    <FlowPopupPanel
      key={`edge-panel-${edgePanelMode}-${String(
        selectedConnectionId ?? "none",
      )}-${String(panelSourceId ?? "unknown")}-${String(
        panelTargetId ?? "unknown",
      )}`}
      borderColor={panelBorderColor}
      title={
        edgePanelMode === "create" ? (
          "Create Connection"
        ) : edgePanelMode === "edit" ? (
          <span className="flex items-center gap-1">
            <span>Edit Connection</span>
            {editingConnectionIndicator}
          </span>
        ) : (
          "Pathway Connections"
        )
      }
      subtitle={`${panelSourceId} → ${panelTargetId}`}
      subtitleAccent={
        isListMode ? (
          <p
            className="text-xs font-semibold mt-1"
            style={{ color: panelBorderColor }}
          >
            {edgePanelConnections.length} connection
            {edgePanelConnections.length === 1 ? "" : "s"}
            {distinctTypeCount > 0
              ? ` across ${distinctTypeCount} type${distinctTypeCount === 1 ? "" : "s"}`
              : ""}
          </p>
        ) : undefined
      }
      headerPrefix={
        !isListMode ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={returnToAllConnections}
            className="h-7 px-2 text-[10px]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
        ) : undefined
      }
      headerActions={
        <div className="flex items-center gap-1">
          <Button
            variant="icon"
            onClick={() => focusEdgePair(panelSourceId, panelTargetId)}
            className="h-8 w-8"
            title="Focus Connection"
          >
            <LocateFixed className="h-4 w-4" />
          </Button>
          {isListMode && edgePanelEdge && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openCreatePathwayForPair(
                    {
                      source: edgePanelEdge.source,
                      target: edgePanelEdge.target,
                      sourceHandle: edgePanelEdge.sourceHandle,
                      targetHandle: edgePanelEdge.targetHandle,
                    },
                    edgePanelEdge,
                  );
                }}
                className="h-7 px-2 text-[10px]"
                title="Add connection"
              >
                Add
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDeleteEdge(edgePanelEdge.id)}
                className="h-7 px-2 text-[10px] border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete this edge group"
              >
                Delete All
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePanelClose}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      }
      fillHeight={true}
    >
      {isListMode ? (
        <div className="space-y-2 text-xs">
          {edgePanelConnections.map((connection: any, idx: number) => (
            <ConnectionSummaryCard
              key={connection.pathway_id || idx}
              connection={connection}
              index={idx}
              edgePanelEdge={edgePanelEdge}
              selectedConnectionId={selectedConnectionId}
              theme={theme}
              setSelectedConnectionId={setSelectedConnectionId}
              handleEditPathway={handleEditPathway}
              handleDeletePathway={handleDeletePathway}
            />
          ))}
        </div>
      ) : (
        <PathwayConnectionForm
          edgePanelMode={edgePanelMode}
          potentialEdge={potentialEdge}
          editingPathwayConnection={editingPathwayConnection}
          isEditingDetachedConnectionDraft={isEditingDetachedConnectionDraft}
          detachedConnectionEndpointFocus={detachedConnectionEndpointFocus}
          edgeFormValues={edgeFormValues}
          edgeFormDefaults={edgeFormDefaults}
          edgeFormSubmitting={edgeFormSubmitting}
          edgeFormError={edgeFormError}
          isEdgeFormValid={isEdgeFormValid}
          isEdgeFormDirty={isEdgeFormDirty}
          visibleEdgeOptionalFields={visibleEdgeOptionalFields}
          repairNodeOptions={repairNodeOptions}
          handleEdgeFormSubmit={handleEdgeFormSubmit}
          handleDetachedEndpointFocusChange={
            handleDetachedEndpointFocusChange
          }
          handleDetachedEndpointSelection={handleDetachedEndpointSelection}
          handleReverseDetachedEndpoints={handleReverseDetachedEndpoints}
          handleEdgeFormFieldChange={handleEdgeFormFieldChange}
          showEdgeOptionalField={showEdgeOptionalField}
          setEdgeFormValues={setEdgeFormValues}
          setEdgeFormError={setEdgeFormError}
          panelSourceId={panelSourceId}
          panelTargetId={panelTargetId}
        />
      )}
    </FlowPopupPanel>
  );
}
