import { useState } from "react";
import { Collapse } from "@mui/material";
import { ExpandMore } from "@/components/MuiComponent/ExpandMore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { StopTypeColors } from "@/util/gtfsStyling";

function MapLegend({ StationData }) {
  const [Expanded, setExpanded] = useState(true);

  const handleExpandClick = () => {
    setExpanded(!Expanded);
  };

  const StatusList = Array.from(
    new Set(StationData.Stops.map((value, key) => value["location_type"]))
  );

  return (
    <div
      className="
        flex flex-col items-start absolute top-4 right-5
        bg-white rounded-md p-2 text-xs
        shadow-md shadow-[rgba(0,0,0,0.75)] z-10
        max-w-[200px]"
    >
      <div className="flex items-center w-full justify-between">
        <ExpandMore
          expand={Expanded}
          onClick={handleExpandClick}
          aria-expanded={Expanded}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </ExpandMore>
        <h1 className="font-bold text-lg ml-2">Station Parts</h1>
      </div>

      <Collapse
        in={Expanded}
        timeout="auto"
        unmountOnExit
        className="w-full mt-2"
      >
        {StatusList.map((status, index) => (
          <div key={index} className="flex items-center mb-2">
            <div
              className={`w-3 h-3 rounded-full mr-2 
                ${StopTypeColors[status].tailwindColor}`}
            />
            <p>{StopTypeColors[status]?.name}</p>
          </div>
        ))}
      </Collapse>
    </div>
  );
}

export default MapLegend;
