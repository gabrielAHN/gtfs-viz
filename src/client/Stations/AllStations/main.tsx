import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/combinedContext";
import { ToggleButton, ToggleButtonGroup, Skeleton } from "@mui/material";

import StationTable from "./StationTable/main";
import StationMap from "./StationsMap/main";
import Header from "./Header/main";
import TableChartIcon from "@mui/icons-material/TableChart";
import MapIcon from "@mui/icons-material/Map";
import {
  fetchStopsIdData,
  fetchStationsData,
  fetchStopsNamesData,
  fetchPathwaysStatusData,
  fetchWheelchairStatusData,
} from "@/hooks/DuckdbCalls/DataFetching/fetchGTFSData";

export const ToggleTabs = [
  { value: "table", label: "Table", icon: <TableChartIcon /> },
  { value: "map", label: "Map", icon: <MapIcon /> },
];

function AllStations() {
  const { conn } = useDuckDB();
  const [TabView, setTabView] = useState<string | null>("table");
  const [SearchText, setSearchText] = useState<string>("");
  const [StopIdDropdown, setStopIdDropdown] = useState();
  const [StopNameDropDown, setStopNameDropDown] = useState();
  const [PathwaysStatusDropDown, setPathwaysStatusDropDown] = useState([]);
  const [WheelChairStatusDropDown, setWheelChairStatusDropDown] = useState([]);

  const { data: StopsIdData } = useQuery({
    queryKey: [
      "fetchStopsIdData",
      SearchText,
      StopNameDropDown,
      PathwaysStatusDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchStopsIdData({
        conn,
        SearchText,
        StopNameDropDown,
        PathwaysStatusDropDown,
      }),
  });

  const { data: StopsNameData } = useQuery({
    queryKey: [
      "fetchStopsNamesData",
      SearchText,
      StopIdDropdown,
      PathwaysStatusDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchStopsNamesData({
        conn,
        SearchText,
        StopIdDropdown,
        PathwaysStatusDropDown,
      }),
  });

  const { data: PathwaysStatusData } = useQuery({
    queryKey: [
      "fetchPathwaysStatusData",
      SearchText,
      StopIdDropdown,
      StopNameDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchPathwaysStatusData({
        conn,
        SearchText,
        StopIdDropdown,
        StopNameDropDown,
      }),
  });

  const { data: WheelchairStatusData } = useQuery({
    queryKey: [
      "WheelchairStatusData",
      SearchText,
      StopIdDropdown,
      StopNameDropDown,
      PathwaysStatusDropDown,
    ],
    queryFn: () =>
      fetchWheelchairStatusData({
        conn,
        SearchText,
        StopIdDropdown,
        StopNameDropDown,
        PathwaysStatusDropDown,
      }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "fetchStationsData",
      SearchText,
      StopIdDropdown,
      StopNameDropDown,
      PathwaysStatusDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchStationsData({
        conn,
        SearchText,
        StopIdDropdown,
        StopNameDropDown,
        PathwaysStatusDropDown,
        WheelChairStatusDropDown,
      }),
  });

  const changeView = useCallback((event, newView) => {
    if (newView) {
      setTabView(newView);
    }
  }, []);

  const memoizedData = useMemo(() => data, [data]);

  return (
    <div className="p-4">
      <div className="flex mb-1">
        <ToggleButtonGroup
          className="mb-2"
          value={TabView}
          exclusive
          onChange={changeView}
        >
          {ToggleTabs.map((tab, index) => (
            <ToggleButton key={tab.value} size="small" value={tab.value}>
              {tab.icon}
              <p className="ml-2">{tab.label}</p>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <Header
        SearchText={SearchText}
        setSearchText={setSearchText}
        StopIdDropdown={StopIdDropdown}
        setStopIdDropdown={setStopIdDropdown}
        StopsIdData={StopsIdData}
        PathwaysStatusData={PathwaysStatusData}
        WheelchairStatusData={WheelchairStatusData}
        StopsNameData={StopsNameData}
        StopNameDropDown={StopNameDropDown}
        setStopNameDropDown={setStopNameDropDown}
        PathwaysStatusDropDown={PathwaysStatusDropDown}
        setPathwaysStatusDropDown={setPathwaysStatusDropDown}
        setWheelChairStatusDropDown={setWheelChairStatusDropDown}
        WheelChairStatusDropDown={WheelChairStatusDropDown}
      />
      {isLoading ? (
        <Skeleton variant="rounded" height={400} />
      ) : TabView === "table" ? (
        <StationTable data={memoizedData} />
      ) : TabView === "map" ? (
        <StationMap data={memoizedData} />
      ) : null}
    </div>
  );
}

export default AllStations;
