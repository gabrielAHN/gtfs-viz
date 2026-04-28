import React from "react";
import { Accessibility, Plus } from "lucide-react";
import { BiReset } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import Combobox from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";

type EdgeLabelMode = "type" | "time";

interface PathwayFlowHeaderProps {
  selectedFromStop?: string;
  onSelectedFromStopChange: (value?: string) => void;
  selectedToStop?: string;
  onSelectedToStopChange: (value?: string) => void;
  fromStopOptions: {
    id: string;
    label: string;
    color?: string;
    searchLabel?: string;
  }[];
  toStopOptions: {
    id: string;
    label: string;
    color?: string;
    searchLabel?: string;
  }[];
  wheelchairAccessibleOnly: boolean;
  onWheelchairAccessibleOnlyChange: (value: boolean) => void;
  showWheelchairAccessibleSwitch: boolean;
  edgeLabelMode: EdgeLabelMode;
  onEdgeLabelModeChange: (mode: EdgeLabelMode) => void;
  onCreateNode: () => void;
}

export const PathwayFlowHeader: React.FC<PathwayFlowHeaderProps> = ({
  selectedFromStop,
  onSelectedFromStopChange,
  selectedToStop,
  onSelectedToStopChange,
  fromStopOptions,
  toStopOptions,
  wheelchairAccessibleOnly,
  onWheelchairAccessibleOnlyChange,
  showWheelchairAccessibleSwitch,
  edgeLabelMode,
  onEdgeLabelModeChange,
  onCreateNode,
}) => {
  const hasActiveFilters =
    !!selectedFromStop || !!selectedToStop || wheelchairAccessibleOnly;

  return (
    <div className="mt-2">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!hasActiveFilters}
            onClick={() => {
              onSelectedFromStopChange(undefined);
              onSelectedToStopChange(undefined);
              onWheelchairAccessibleOnlyChange(false);
            }}
            className="h-9 w-full justify-center px-2.5 text-xs md:w-[136px]"
          >
            <BiReset className="mr-2 h-4 w-4" />
            Reset
          </Button>

          <Button
            onClick={onCreateNode}
            className="h-9 w-full justify-center px-2.5 text-xs md:w-[136px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Node
          </Button>

          {showWheelchairAccessibleSwitch ? (
            <label className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border px-2.5 text-xs font-medium shrink-0 md:w-[148px]">
              <span className="flex items-center gap-2">
                <Accessibility className="h-3.5 w-3.5" />
                Wheelchair
              </span>
              <Switch
                checked={wheelchairAccessibleOnly}
                onCheckedChange={onWheelchairAccessibleOnlyChange}
                aria-label="Wheelchair accessible"
                className="scale-90 origin-right"
              />
            </label>
          ) : null}

          <label className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border px-2.5 text-xs font-medium shrink-0 md:w-[148px]">
            <span>Edge: {edgeLabelMode === "time" ? "Time" : "Type"}</span>
            <Switch
              checked={edgeLabelMode === "time"}
              onCheckedChange={(checked) =>
                onEdgeLabelModeChange(checked ? "time" : "type")
              }
              aria-label="Edge labels"
              className="scale-90 origin-right"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="col-span-1">
            <Combobox
              Message="From Nodes"
              value={selectedFromStop}
              setValue={onSelectedFromStopChange}
              options={fromStopOptions.map((stop) => ({
                value: stop.id,
                label: stop.label,
                color: stop.color,
                searchLabel: stop.searchLabel,
              }))}
            />
          </div>

          <div className="col-span-1">
            <Combobox
              Message="To Nodes"
              value={selectedToStop}
              setValue={onSelectedToStopChange}
              options={toStopOptions.map((stop) => ({
                value: stop.id,
                label: stop.label,
                color: stop.color,
                searchLabel: stop.searchLabel,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
