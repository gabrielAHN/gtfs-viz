import type { FormEvent } from "react";
import { ArrowLeftRight } from "lucide-react";

import Combobox from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DetachedConnectionEndpointFocus,
  EdgeFormValues,
  EdgeOptionalFieldKey,
} from "@/components/pathways/flow-editor/core/types";
import {
  DIRECTION_OPTIONS,
  EDGE_OPTIONAL_FIELDS,
  PATHWAY_MODE_OPTIONS,
} from "@/components/pathways/flow-editor/core/shared";

type ComboboxOption = {
  value: string;
  label: string;
  color?: string;
  searchLabel?: string;
};

type PathwayConnectionFormProps = {
  edgePanelMode: "list" | "create" | "edit";
  isEditingDetachedConnectionDraft: boolean;
  detachedConnectionEndpointFocus: DetachedConnectionEndpointFocus;
  edgeFormValues: EdgeFormValues;
  edgeFormDefaults: EdgeFormValues;
  edgeFormSubmitting: boolean;
  edgeFormError: string | null;
  isEdgeFormValid: boolean;
  isEdgeFormDirty: boolean;
  editingPathwayConnection: any;
  potentialEdge: any;
  panelSourceId: string;
  panelTargetId: string;
  visibleEdgeOptionalFields: Record<EdgeOptionalFieldKey, boolean>;
  repairNodeOptions: ComboboxOption[];
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

const CORE_EDGE_FORM_FIELDS = [
  {
    key: "traversal_time" as const,
    label: "Traversal Time (sec)",
    type: "number",
    min: "0",
    step: "1",
  },
  {
    key: "length" as const,
    label: "Length (m)",
    type: "text",
    min: "0",
    step: "0.01",
    inputMode: "decimal" as const,
  },
];

function DetachedConnectionEndsSection({
  detachedConnectionEndpointFocus,
  edgeFormSubmitting,
  edgeFormValues,
  repairNodeOptions,
  handleDetachedEndpointFocusChange,
  handleDetachedEndpointSelection,
  handleReverseDetachedEndpoints,
  handleEdgeFormFieldChange,
  editingPathwayConnection,
}: {
  detachedConnectionEndpointFocus: DetachedConnectionEndpointFocus;
  edgeFormSubmitting: boolean;
  edgeFormValues: EdgeFormValues;
  repairNodeOptions: ComboboxOption[];
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
  editingPathwayConnection: any;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium">Connection Ends</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={
                detachedConnectionEndpointFocus === "from"
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handleDetachedEndpointFocusChange("from")}
              disabled={edgeFormSubmitting}
              className="h-8 px-2 text-xs"
            >
              Pick From
            </Button>
            <Button
              type="button"
              variant={
                detachedConnectionEndpointFocus === "to"
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handleDetachedEndpointFocusChange("to")}
              disabled={edgeFormSubmitting}
              className="h-8 px-2 text-xs"
            >
              Pick To
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
          <div className="space-y-1.5">
            <div className="text-xs font-medium">From Node</div>
            <Combobox
              Message="Select source node"
              value={edgeFormValues.from_stop_id || undefined}
              setValue={(value) =>
                handleDetachedEndpointSelection("from_stop_id", value)
              }
              options={repairNodeOptions}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReverseDetachedEndpoints}
            disabled={edgeFormSubmitting}
            className="h-10 px-3 md:mb-0.5"
            title="Reverse from and to nodes"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
            Reverse
          </Button>
          <div className="space-y-1.5">
            <div className="text-xs font-medium">To Node</div>
            <Combobox
              Message="Select target node"
              value={edgeFormValues.to_stop_id || undefined}
              setValue={(value) =>
                handleDetachedEndpointSelection("to_stop_id", value)
              }
              options={repairNodeOptions}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium">Direction</div>
          <Select
            value={edgeFormValues.is_bidirectional}
            onValueChange={(value) =>
              handleEdgeFormFieldChange("is_bidirectional", value)
            }
            disabled={edgeFormSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Choose nodes here or click `Pick From` or `Pick To`, then select a
          node on the canvas.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium">Pathway ID</div>
        <div className="rounded border bg-background/80 px-2 py-2 font-mono font-semibold text-[10px]">
          {editingPathwayConnection?.pathway_id}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Drag the orphan node, click nodes on the canvas, or choose nodes here
        before saving.
      </p>
    </div>
  );
}

function ConnectionSummarySection({
  edgePanelMode,
  potentialEdge,
  editingPathwayConnection,
  panelSourceId,
  panelTargetId,
}: {
  edgePanelMode: "list" | "create" | "edit";
  potentialEdge: any;
  editingPathwayConnection: any;
  panelSourceId: string;
  panelTargetId: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div className="text-muted-foreground">From:</div>
      <div className="font-mono text-[10px]">{panelSourceId}</div>

      <div className="text-muted-foreground">To:</div>
      <div className="font-mono text-[10px]">{panelTargetId}</div>

      {edgePanelMode === "create" ? (
        <>
          <div className="text-muted-foreground">Source Type:</div>
          <div className="font-semibold text-[10px]">
            {String(potentialEdge?.sourceNode.data?.locationType ?? "Unknown")}
          </div>

          <div className="text-muted-foreground">Target Type:</div>
          <div className="font-semibold text-[10px]">
            {String(potentialEdge?.targetNode.data?.locationType ?? "Unknown")}
          </div>
        </>
      ) : (
        <>
          <div className="text-muted-foreground">Pathway ID:</div>
          <div className="font-mono font-semibold text-[10px]">
            {editingPathwayConnection?.pathway_id}
          </div>
        </>
      )}
    </div>
  );
}

function PathwayConnectionForm({
  edgePanelMode,
  isEditingDetachedConnectionDraft,
  detachedConnectionEndpointFocus,
  edgeFormValues,
  edgeFormDefaults,
  edgeFormSubmitting,
  edgeFormError,
  isEdgeFormValid,
  isEdgeFormDirty,
  editingPathwayConnection,
  potentialEdge,
  panelSourceId,
  panelTargetId,
  visibleEdgeOptionalFields,
  repairNodeOptions,
  handleEdgeFormSubmit,
  handleDetachedEndpointFocusChange,
  handleDetachedEndpointSelection,
  handleReverseDetachedEndpoints,
  handleEdgeFormFieldChange,
  showEdgeOptionalField,
  setEdgeFormValues,
  setEdgeFormError,
}: PathwayConnectionFormProps) {
  return (
    <form onSubmit={handleEdgeFormSubmit} className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-3 text-xs">
        {isEditingDetachedConnectionDraft ? (
          <DetachedConnectionEndsSection
            detachedConnectionEndpointFocus={detachedConnectionEndpointFocus}
            edgeFormSubmitting={edgeFormSubmitting}
            edgeFormValues={edgeFormValues}
            repairNodeOptions={repairNodeOptions}
            handleDetachedEndpointFocusChange={
              handleDetachedEndpointFocusChange
            }
            handleDetachedEndpointSelection={handleDetachedEndpointSelection}
            handleReverseDetachedEndpoints={handleReverseDetachedEndpoints}
            handleEdgeFormFieldChange={handleEdgeFormFieldChange}
            editingPathwayConnection={editingPathwayConnection}
          />
        ) : (
          <ConnectionSummarySection
            edgePanelMode={edgePanelMode}
            potentialEdge={potentialEdge}
            editingPathwayConnection={editingPathwayConnection}
            panelSourceId={panelSourceId}
            panelTargetId={panelTargetId}
          />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="text-xs font-medium">Edge Type</div>
          <Select
            value={edgeFormValues.pathway_mode}
            onValueChange={(value) =>
              handleEdgeFormFieldChange("pathway_mode", value)
            }
            disabled={edgeFormSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PATHWAY_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isEditingDetachedConnectionDraft && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium">Direction</div>
            <Select
              value={edgeFormValues.is_bidirectional}
              onValueChange={(value) =>
                handleEdgeFormFieldChange("is_bidirectional", value)
              }
              disabled={edgeFormSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {CORE_EDGE_FORM_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5 md:col-span-1">
            <div className="text-xs font-medium">{field.label}</div>
            <Input
              type={field.type}
              min={field.min}
              step={field.step}
              inputMode={field.inputMode}
              placeholder="Optional"
              value={edgeFormValues[field.key]}
              onChange={(event) =>
                handleEdgeFormFieldChange(field.key, event.target.value)
              }
              disabled={edgeFormSubmitting}
            />
          </div>
        ))}
      </div>

      {EDGE_OPTIONAL_FIELDS.some(
        (field) => !visibleEdgeOptionalFields[field.key],
      ) && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Optional Fields
          </div>
          <div className="flex flex-wrap gap-2">
            {EDGE_OPTIONAL_FIELDS.filter(
              (field) => !visibleEdgeOptionalFields[field.key],
            ).map((field) => (
              <Button
                key={field.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => showEdgeOptionalField(field.key)}
                disabled={edgeFormSubmitting}
                className="h-7 text-xs"
              >
                Add {field.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {EDGE_OPTIONAL_FIELDS.filter(
        (field) => visibleEdgeOptionalFields[field.key],
      ).length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {EDGE_OPTIONAL_FIELDS.filter(
            (field) => visibleEdgeOptionalFields[field.key],
          ).map((field) => (
            <div key={field.key} className="space-y-1.5 md:col-span-1">
              <div className="text-xs font-medium">{field.label}</div>
              <Input
                type={field.type}
                min={field.min}
                step={field.step}
                inputMode={field.inputMode}
                placeholder="Optional"
                value={edgeFormValues[field.key]}
                onChange={(event) =>
                  handleEdgeFormFieldChange(field.key, event.target.value)
                }
                disabled={edgeFormSubmitting}
              />
            </div>
          ))}
        </div>
      )}

      {edgeFormError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {edgeFormError}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          variant="outline"
          disabled={
            edgeFormSubmitting ||
            !isEdgeFormValid ||
            (edgePanelMode === "edit" && !isEdgeFormDirty)
          }
          className="px-6"
        >
          {edgeFormSubmitting
            ? edgePanelMode === "create"
              ? "Creating..."
              : "Saving..."
            : edgePanelMode === "create"
              ? "Create"
              : "Save"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={edgeFormSubmitting}
          onClick={() => {
            setEdgeFormValues(edgeFormDefaults);
            setEdgeFormError(null);
          }}
          className="px-6"
        >
          Reset
        </Button>
      </div>
    </form>
  );
}

export default PathwayConnectionForm;
