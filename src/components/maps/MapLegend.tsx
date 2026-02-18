import { useState } from "react";
import { BiChevronDown, BiChevronUp } from "react-icons/bi";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface LegendItem {
  label: string;
  color: string;
}

interface MapLegendProps {
  title: string;
  items: LegendItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children?: React.ReactNode;
}

function MapLegend({
  title,
  items,
  collapsible = true,
  defaultExpanded = true,
  children,
}: MapLegendProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!collapsible) {
    return (
      <div className="bg-background border rounded shadow-lg p-2 max-w-[200px]">
        <h3 className="font-semibold text-xs mb-1">{title}</h3>
        {children}
        <div className="space-y-0.5">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="bg-background border rounded shadow-lg p-2 max-w-[200px]"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-xs">{title}</h3>
        <CollapsibleTrigger asChild>
          <button
            className="p-0.5 hover:bg-accent rounded"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <BiChevronUp className="h-3 w-3" />
            ) : (
              <BiChevronDown className="h-3 w-3" />
            )}
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        {children}
        <div className="space-y-0.5 mt-1">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default MapLegend;
