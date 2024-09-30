import { useState } from "react";
import { Collapse, MenuItem, Select } from "@mui/material";
import { DATA_STATUS } from "./main";
import { ExpandMore } from "@/components/MuiComponent/ExpandMore";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

function MapLegend({ TableData, DataColor, setDataColor }) {
  const [Expanded, setExpanded] = useState(true);

  const handleExpandClick = () => {
    setExpanded(!Expanded);
  };

  const handleChange = (event) => {
    setDataColor(event.target.value);
  };

  const StatusList = Array.from(
    new Set(Object.entries(TableData).map(([key, value]) => value[DataColor]))
  );

  return (
    <div
      className="
        flex flex-col items-start absolute top-4 right-5
        bg-white rounded-md p-2 text-xs
        shadow-md shadow-[rgba(0,0,0,0.75)] z-10
        max-w-[200px]"
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
        <Select value={DataColor} onChange={handleChange}>
          <MenuItem value={"pathways_status"}>Pathway</MenuItem>
          <MenuItem value={"wheelchair_status"}>Wheelchair</MenuItem>
        </Select>
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
                ${DATA_STATUS[status].tailwindColor}`}
            />
            <p>{DATA_STATUS[status].name}</p>
          </div>
        ))}
      </Collapse>
    </div>
  );
}

export default MapLegend;