import { useState } from "react";
import { useStationViewContext } from "@/context/combinedContext";

import StationInfo from "./StationInfo/main";
import StationParts from "./StationParts/main";
import StationConnections from "./StationConnections/main";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ToggleComponent from "@/components/MuiComponent/TabComponent";

function SelectedStations() {
  const { StationView } = useStationViewContext();

  const Tablists = [
    { value: "StationInfo", label: "Info", icon: <InfoOutlinedIcon /> },
    { value: "StationParts", label: "Parts", icon: <GroupWorkIcon /> },
  ];

  const [TabView, setTabView] = useState("StationInfo");

  if (StationView.pathwayStatus == "✅") {
    Tablists.push({
      value: "StationPathways",
      label: "Pathways",
      icon: <HubOutlinedIcon />,
    });
  }

  const handleToggleChange = (value) => {
    if (value) {
      setTabView(value);
    }
  };

  return (
    <div className="p-4">
      <div className="text-4xl font-bold flex justify-center mb-2">
        {StationView.stopName}
      </div>
      <div className="mb-2">
        <ToggleComponent
          TabList={Tablists}
          ToggleValue={TabView}
          setToggleValue={handleToggleChange}
          sizeTab="small"
        />
      </div>
      {TabView === "StationInfo" ? (
        <StationInfo />
      ) : TabView === "StationParts" ? (
        <StationParts />
      ) : TabView === "StationPathways" ? (
        <StationConnections />
      ) : null}
    </div>
  );
}

export default SelectedStations;
