import type { RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type LegendItem = {
  label: string;
  color: string;
};

type FlowLegendPanelProps = {
  legendRef: RefObject<HTMLDivElement | null>;
  legendOpen: boolean;
  setLegendOpen: (value: boolean) => void;
  pathwayLegendItems: LegendItem[];
  stopLegendItems: LegendItem[];
};

export function FlowLegendPanel({
  legendRef,
  legendOpen,
  setLegendOpen,
  pathwayLegendItems,
  stopLegendItems,
}: FlowLegendPanelProps) {
  return (
    <div
      ref={legendRef}
      className="absolute top-2 right-2 z-[400] max-h-[calc(100%-16px)]"
    >
      {legendOpen ? (
        <div className="bg-card/98 backdrop-blur-sm border rounded-md shadow-lg p-2.5 max-w-[240px] text-xs">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-semibold text-[9px] uppercase tracking-wide">
              Legend
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLegendOpen(false)}
              className="h-6 px-2 text-[10px]"
            >
              <ChevronRight className="w-3 h-3 mr-1" />
              Hide
            </Button>
          </div>
          <div className="space-y-2.5 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
            {pathwayLegendItems.length > 0 && (
              <div>
                <h4 className="font-semibold text-[9px] mb-1 uppercase tracking-wide">
                  Pathway Types
                </h4>
                <div className="space-y-0.5">
                  {pathwayLegendItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-1.5 text-[8px]"
                    >
                      <div
                        className="w-5 h-[2px] rounded flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stopLegendItems.length > 0 && (
              <div
                className={pathwayLegendItems.length > 0 ? "border-t pt-2" : ""}
              >
                <h4 className="font-semibold text-[9px] mb-1 uppercase tracking-wide">
                  Stop Types
                </h4>
                <div className="space-y-0.5">
                  {stopLegendItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-1.5 text-[8px]"
                    >
                      <div
                        className="w-2 h-2 rounded-sm border flex-shrink-0"
                        style={{
                          backgroundColor: item.color,
                          borderColor: item.color,
                        }}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLegendOpen(true)}
          className="h-8 bg-card/98 backdrop-blur-sm shadow-lg text-[10px]"
        >
          <ChevronLeft className="w-3 h-3 mr-1" />
          Legend
        </Button>
      )}
    </div>
  );
}
