import { useState } from "react";

import { rgbToHex } from "@/components/colorUtil";
import { ConnectTypeColors, PathwayColors } from "@/components/style";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Select, SelectItem, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";


function MapLegend({
  ConnectionType,
  setConnectionType,
  timeIntervalRanges,
  setEmptyArcs,
  DirectionData,
  setDirectionTypes,
  pathwayTypeData,
  setPathwayTypes,
}) {
  const [Expanded, setExpanded] = useState(true);

  const handleExpandClick = () => {
    setExpanded(!Expanded);
  };

  const handleChange = (event) => {
    setPathwayTypes([]);
    setEmptyArcs(false);
    setDirectionTypes();
    setConnectionType(event);
  };

  return (
    <Collapsible
      open={Expanded}
      onOpenChange={handleExpandClick}
      className="absolute right-5 top-20 z-50 max-w-[200px] bg-primary-foreground shadow-md p-4 rounded-md"
    >
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <button
            className="flex items-center text-sm font-medium mr-4"
            aria-expanded={Expanded}
            aria-label="Toggle Legend"
          >
            {Expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </CollapsibleTrigger>
        <Select onValueChange={handleChange} value={ConnectionType} >
          <SelectTrigger>
            <SelectValue placeholder="Select Data Color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="directional">Directional</SelectItem>
            <SelectItem value="timeInterval">Time Interval</SelectItem>
            <SelectItem value="PathwayTypes">Pathway Types</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CollapsibleContent className="mt-4">
        {ConnectionType === "directional" && DirectionData
          ? DirectionData.map((direction, index) => {
            let colorMap = {};

            if (direction.value === "directional") {
              colorMap["From"] = rgbToHex(ConnectTypeColors.directional.from);
              colorMap["To"] = rgbToHex(ConnectTypeColors.directional.to);
            } else if (direction.value === "bidirectional") {
              colorMap["Bidirectional"] = rgbToHex(
                ConnectTypeColors.bidirectional.bidirectional
              );
            }

            return (
              <div key={index} className="flex items-center mb-2">
                {Object.keys(colorMap).map((label) => (
                  <div key={label} className="flex items-center mr-4">
                    <div
                      style={{ backgroundColor: colorMap[label] }}
                      className="w-3 h-3 rounded-full mr-2"
                    />
                    <p className="text-xs">{label}</p>
                  </div>
                ))}
              </div>
            );
          })
          : ConnectionType === "timeInterval" && timeIntervalRanges
            ? (() => {
              if (!timeIntervalRanges)
                return <Skeleton className="rounded-sm h-[5vh]" />;
              else if (timeIntervalRanges?.length === 0)
                return <>No time interval data</>;
              else {
                return (
                  <>
                    {timeIntervalRanges.map((range, index) => {
                      return (
                        <div key={index} className="flex items-center mb-2">
                          <div
                            style={{ backgroundColor: range.color }}
                            className={`w-3 h-3 rounded-full mr-2`}
                          />
                          <p>
                            {range.min} - {range.max}
                          </p>
                        </div>
                      );
                    })}
                  </>
                );
              }
            })()
            : ConnectionType === "PathwayTypes"
              ? (() => {
                return (
                  <div>
                    {pathwayTypeData &&
                      pathwayTypeData.map((arc, index) => {
                        return (
                          <div key={index} className="flex items-center mb-2">
                            <div
                              style={{
                                backgroundColor: rgbToHex(
                                  PathwayColors[arc.value]?.color
                                ),
                              }}
                              className={`w-3 h-3 rounded-full mr-2`}
                            />
                            <p>{arc.value}</p>
                          </div>
                        );
                      })}
                  </div>
                );
              })()
              : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default MapLegend;
