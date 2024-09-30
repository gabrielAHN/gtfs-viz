import { useState } from "react";
import MapView from "./MapView/main";
import TableView from "./TableView/main";

import MapIcon from "@mui/icons-material/Map";
import TableChartIcon from "@mui/icons-material/TableChart";
import ToggleComponent from "@/components/MuiComponent/TabComponent";

function StationConnections() {
  const [PathwayView, setPathwayView] = useState("map");

  const handleToggleChange = (value) => {
    if (value) {
      setPathwayView(value);
    }
  };

  return (
    <div className="relative flex flex-col space-y-4">
      <ToggleComponent
        TabList={[
          { value: "map", label: "Map", icon: <MapIcon /> },
          { value: "table", label: "Table", icon: <TableChartIcon /> },
        ]}
        ToggleValue={PathwayView}
        setToggleValue={handleToggleChange}
        sizeTab="small"
      />
      <div className="flex-grow">
        {PathwayView === "map" ? <MapView /> : <TableView />}
      </div>
    </div>
  );
}
export default StationConnections;
