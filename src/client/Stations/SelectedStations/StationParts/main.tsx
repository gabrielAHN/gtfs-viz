import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { useStationViewContext, useDuckDB } from "@/context/combinedContext";
import {
  fetchCheckStationData,
  fetchStationPartTypes,
  fetchStationStopIds,
} from "@/hooks/DuckdbCalls/DataFetching/fetchStationInfoData";

import MapIcon from "@mui/icons-material/Map";
import TableChartIcon from "@mui/icons-material/TableChart";

import Header from "./Header";
import MapView from "./MapView/main";
import TableView from "./TableView/main";
import ToggleComponent from "@/components/MuiComponent/TabComponent";

function StationParts() {
  const { conn } = useDuckDB();
  const { StationView } = useStationViewContext();
  const [StopsID, setStopsID] = useState();
  const [SearchText, setSearchText] = useState();
  const [LocationsList, setLocationsList] = useState([]);
  const [StationViewType, setStationViewType] = useState("map");

  const { data: StationLocationList } = useQuery({
    queryKey: ["fetchStationPartTypes", StationView, SearchText, StopsID],
    queryFn: () =>
      fetchStationPartTypes({ conn, StationView, SearchText, StopsID }),
  });

  const { data: StationStopIds } = useQuery({
    queryKey: ["fetchStationStopIds", StationView, SearchText, LocationsList],
    queryFn: () =>
      fetchStationStopIds({ conn, StationView, SearchText, LocationsList }),
  });

  const { data: StationData } = useQuery({
    queryKey: [
      "fetchStationInfoData",
      StationView,
      SearchText,
      LocationsList,
      StopsID,
    ],
    queryFn: () =>
      fetchCheckStationData({
        conn,
        StationView,
        SearchText,
        LocationsList,
        StopsID,
      }),
  });

  const handleToggleChange = (value) => {
    if (value) {
      setStationViewType(value);
    }
  };

  return (
    <div className="relative flex flex-col space-y-4">
      <ToggleComponent
        TabList={[
          { value: "map", label: "Map", icon: <MapIcon /> },
          { value: "table", label: "Table", icon: <TableChartIcon /> },
        ]}
        ToggleValue={StationViewType}
        setToggleValue={handleToggleChange}
        sizeTab="small"
      />
      <Header
        StationLocationList={StationLocationList}
        SearchText={SearchText}
        setSearchText={setSearchText}
        LocationsList={LocationsList}
        setLocationsList={setLocationsList}
        StationStopIds={StationStopIds}
        StopsID={StopsID}
        setStopsID={setStopsID}
      />
        <div className="flex-grow">
          {StationViewType === "map" ? (
            <MapView StationData={StationData} />
          ) : StationViewType === "table" ? (
            <TableView StationData={StationData} />
          ) 
          : null}
        </div>
    </div>
  );
}
export default StationParts;
