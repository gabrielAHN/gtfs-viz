import { ChevronLeft, ChevronRight, Filter, X } from "lucide-react";

import { rgbToHex } from "@/components/colorUtil";
import Combobox from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPathwayColor } from "@/components/style";

import {
  getDetachedConnectionDraftConnection,
  getDetachedConnectionDraftEndpointCount,
} from "../core/shared";

type OrphanConnectionsSidebarProps = {
  theme: string;
  hasOrphanConnectionsSidebar: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  availableOrphanConnections: any[];
  orphanPathwayIdFilter?: string;
  setOrphanPathwayIdFilter: (value?: string) => void;
  orphanPathwayIdOptions: Array<{ value: string; label: string }>;
  orphanPathwayTypeFilter: string;
  setOrphanPathwayTypeFilter: (value: string) => void;
  orphanPathwayTypeOptions: string[];
  filteredAvailableOrphanConnections: any[];
  activeDetachedConnectionDraftPathwayId: string | null;
  detachedConnectionDrafts: any[];
  startDetachedConnectionRepair: (connection: any) => void;
};

export function OrphanConnectionsSidebar({
  theme,
  hasOrphanConnectionsSidebar,
  sidebarOpen,
  setSidebarOpen,
  availableOrphanConnections,
  orphanPathwayIdFilter,
  setOrphanPathwayIdFilter,
  orphanPathwayIdOptions,
  orphanPathwayTypeFilter,
  setOrphanPathwayTypeFilter,
  orphanPathwayTypeOptions,
  filteredAvailableOrphanConnections,
  activeDetachedConnectionDraftPathwayId,
  detachedConnectionDrafts,
  startDetachedConnectionRepair,
}: OrphanConnectionsSidebarProps) {
  if (!hasOrphanConnectionsSidebar) {
    return null;
  }

  return (
    <>
      <div
        className={`absolute top-0 left-0 h-full bg-card/98 backdrop-blur-sm border-r shadow-lg transition-transform duration-300 z-[400] ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "280px" }}
      >
        <div className="p-3 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <h3 className="font-bold text-sm">Orphan Connections</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="h-6 w-6 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {availableOrphanConnections.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  Orphan Connections
                </div>
                <div className="grid gap-2 mb-2">
                  <Combobox
                    Message="Search pathway ID"
                    value={orphanPathwayIdFilter}
                    setValue={setOrphanPathwayIdFilter}
                    options={orphanPathwayIdOptions}
                  />
                  <Select
                    value={orphanPathwayTypeFilter}
                    onValueChange={setOrphanPathwayTypeFilter}
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="All pathway types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pathway types</SelectItem>
                      {orphanPathwayTypeOptions.map((typeLabel) => (
                        <SelectItem key={typeLabel} value={typeLabel}>
                          {typeLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[9px] text-muted-foreground mb-2">
                  Click an orphan connection to open the repair form. Once you
                  choose both nodes, the canvas shows a suggested edge before
                  you save.
                </p>
                <div className="space-y-1 max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredAvailableOrphanConnections.length === 0 ? (
                    <div className="rounded border border-dashed px-2 py-3 text-[10px] text-muted-foreground">
                      No orphan connections match the current filters.
                    </div>
                  ) : (
                    filteredAvailableOrphanConnections.map((connection: any) => {
                      const isDeleted = connection.status === "deleted";
                      const isLockedByActiveRepair =
                        activeDetachedConnectionDraftPathwayId !== null &&
                        activeDetachedConnectionDraftPathwayId !==
                          String(connection.pathway_id);
                      const color = rgbToHex(
                        getPathwayColor(
                          connection.pathway_mode_name || "❓",
                          theme,
                        ),
                      );

                      return (
                        <div
                          key={connection.pathway_id}
                          role={
                            !isDeleted && !isLockedByActiveRepair
                              ? "button"
                              : undefined
                          }
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={
                            isDeleted || isLockedByActiveRepair
                              ? undefined
                              : (event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  startDetachedConnectionRepair(connection);
                                }
                          }
                          className={`text-[10px] p-2 rounded border-2 transition-colors ${
                            isDeleted
                              ? "bg-destructive/10 cursor-default opacity-70"
                              : isLockedByActiveRepair
                                ? "cursor-not-allowed opacity-45"
                                : "cursor-pointer hover:bg-muted/40"
                          }`}
                          style={{ borderColor: color }}
                        >
                          <div
                            className={`font-mono font-semibold text-[9px] ${
                              isDeleted ? "line-through" : ""
                            }`}
                          >
                            {connection.pathway_id}
                          </div>
                          <div
                            className={`text-[8px] text-muted-foreground mt-0.5 ${
                              isDeleted ? "line-through" : ""
                            }`}
                          >
                            {connection.from_stop_id} → {connection.to_stop_id}
                          </div>
                          <div
                            className={`text-[8px] text-muted-foreground ${
                              isDeleted ? "line-through" : ""
                            }`}
                          >
                            {connection.pathway_mode_name || "❓"}
                          </div>
                          {isDeleted ? (
                            <div className="text-[8px] text-destructive mt-0.5">
                              Deleted orphan connection
                            </div>
                          ) : isLockedByActiveRepair ? (
                            <div className="text-[8px] text-muted-foreground mt-0.5">
                              Finish the active orphan repair first
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {detachedConnectionDrafts.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  Orphan Connection Repair ({detachedConnectionDrafts.length})
                </div>
                <p className="text-[9px] text-muted-foreground mb-2">
                  Only one orphan repair can be active at a time. Use the popup
                  comboboxes to choose both nodes, then review the suggested
                  edge on the canvas before saving.
                </p>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {detachedConnectionDrafts.map((draft) => {
                    const connection = getDetachedConnectionDraftConnection(draft);
                    const color = rgbToHex(
                      getPathwayColor(
                        connection.pathway_mode_name || "❓",
                        theme,
                      ),
                    );

                    return (
                      <div
                        key={connection.pathway_id}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        className="text-[10px] p-2 rounded border-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                        style={{ borderColor: color }}
                      >
                        <div className="font-mono font-semibold text-[9px]">
                          {connection.pathway_id}
                        </div>
                        <div className="text-[8px] text-muted-foreground mt-0.5">
                          {connection.from_stop_id} → {connection.to_stop_id}
                        </div>
                        <div className="text-[8px] text-muted-foreground">
                          {connection.pathway_mode_name || "❓"}
                        </div>
                        <div className="text-[8px] text-muted-foreground">
                          {getDetachedConnectionDraftEndpointCount(draft)} / 2
                          {" "}nodes selected
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!sidebarOpen && (
        <Button
          variant="default"
          size="sm"
          onClick={() => setSidebarOpen(true)}
          className="absolute top-2 left-2 z-[400] h-8 px-2 gap-1.5 shadow-lg"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="text-xs">Orphan Connections</span>
        </Button>
      )}
    </>
  );
}
