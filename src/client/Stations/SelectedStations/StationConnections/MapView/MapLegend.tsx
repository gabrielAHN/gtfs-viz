import { useState } from "react";
import { Collapse, MenuItem, Select, Skeleton } from "@mui/material";
import { rgbToHex } from "@/util/colorUtil";
import { ConnectTypeColors, PathwayColors } from "@/util/gtfsStyling";
import { ExpandMore } from "@/components/MuiComponent/ExpandMore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

function MapLegend({ 
    ConnectionType, setConnectionType, timeIntervalRanges,
    setEmptyArcs, DirectionData, setDirectionTypes, pathwayTypeData,
    setPathwayTypes
  }) {
  const [Expanded, setExpanded] = useState(true);

  const handleExpandClick = () => {
    setExpanded(!Expanded);
  };

  const handleChange = (event) => {
    setPathwayTypes([]);
    setEmptyArcs(false);
    setDirectionTypes();
    setConnectionType(event.target.value);
  }

  return (
    <div
      className="
        flex flex-col items-start absolute top-4 right-5
        bg-white rounded-md p-2 text-xs
        shadow-md shadow-[rgba(0,0,0,0.75)] z-10
        max-w-[210px]"
    >
      <div className="flex items-center">
        <ExpandMore
          expand={Expanded}
          onClick={handleExpandClick}
          aria-expanded={Expanded}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </ExpandMore>
        <Select value={ConnectionType} onChange={handleChange}>
          <MenuItem value={"directional"}>Directional</MenuItem>
          <MenuItem value={"timeInterval"}>Time Interval</MenuItem>
          <MenuItem value={"PathwayTypes"}>Pathway Types</MenuItem>
        </Select>
      </div>
      <Collapse
        in={Expanded}
        timeout="auto"
        unmountOnExit
        className="w-full mt-2"
      >
        {
          ConnectionType === "directional" && DirectionData ? 
          DirectionData.map((direction, index) => {
            let colorMap = {};
            
            if (direction === 'directional') {
              colorMap['From'] = rgbToHex(ConnectTypeColors.directional.from);
              colorMap['To'] = rgbToHex(ConnectTypeColors.directional.to);
            } else if (direction === 'bidirectional') {
              colorMap['Bidirectional'] = rgbToHex(ConnectTypeColors.bidirectional.bidirectional);
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
          }): ConnectionType === 'timeInterval' && timeIntervalRanges ? (() => {
            if (!timeIntervalRanges) return (
              <Skeleton variant="rounded" height={100} />
            ) 
            else if (timeIntervalRanges?.length === 0) return (
              <>No time interval data</>
            ) 
            else {
            return (
              <>
                {
                  timeIntervalRanges.map((range, index) => {
                    return (
                      <div key={index} className="flex items-center mb-2">
                        <div
                          style={{ backgroundColor: range.color }}
                          className={`w-3 h-3 rounded-full mr-2`}
                        />
                        <p>{range.min} - {range.max}</p>
                      </div>
                    );
                  })
                }
              </>
            );
            }
          })() : ConnectionType === 'PathwayTypes' ? (() => {
            return (
              <div>
                {
                  pathwayTypeData && pathwayTypeData.map((arc, index) => {
                    const pathwayTypeName = arc.pathway_mode_name
                    return (
                      <div key={index} className="flex items-center mb-2">
                        <div
                          style={{ backgroundColor: rgbToHex(PathwayColors[pathwayTypeName]?.color) }}
                          className={`w-3 h-3 rounded-full mr-2`}
                        />
                        <p>{pathwayTypeName}</p>
                      </div>
                    );
                  })
                }
              </div>
            )
          })(): null
        }
      </Collapse>
    </div>
  );
}

export default MapLegend;
