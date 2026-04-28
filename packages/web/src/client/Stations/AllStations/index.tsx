import { useState, useMemo } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createStationsTable } from "@/lib/extensions";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";
import { Skeleton } from "@/components/ui/skeleton";

import StationTable from "./StationTable";
import StationMap from "./StationsMap";
import Header from "./Header";

import { BiMap, BiTable } from "react-icons/bi";
import {
  fetchStopsIdData,
  fetchStationsData,
  fetchStopsNamesData,
  fetchPathwaysStatusData,
  fetchWheelchairStatusData,
} from "@/lib/duckdb/DataFetching/fetchGTFSData";
import StopStationForm from "@/components/forms/StopStationForms";

export const ToggleTabs = [
  { value: "table", label: "Table", icon: <BiTable /> },
  { value: "map", label: "Map", icon: <BiMap /> },
];

function AllStations() {
  const { conn } = useDuckDB();
  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();
  const [StopIdDropdown, setStopIdDropdown] = useState();
  const [StopNameDropDown, setStopNameDropDown] = useState();
  const [PathwaysStatusDropDown, setPathwaysStatusDropDown] = useState([]);
  const [WheelChairStatusDropDown, setWheelChairStatusDropDown] = useState([]);
  const [EditStatusDropDown, setEditStatusDropDown] = useState([]);

  const { isLoading: StationTableLoad, isFetching: StationTableFetching } =
    useQuery({
      queryKey: ["createStationTable"],
      queryFn: () => createStationsTable(conn),
    });

  const { data: StopsIdData } = useQuery({
    queryKey: [
      "fetchStopsIdData",
      "StationsTable",
      StopNameDropDown,
      PathwaysStatusDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchStopsIdData({
        conn,
        table: "StationsTable",
        StopNameDropDown,
        PathwaysStatusDropDown,
        WheelChairStatusDropDown,
      }),
  });

  const { data: StopsNameData } = useQuery({
    queryKey: [
      "fetchStopsNamesData",
      "StationsTable",
      StopIdDropdown,
      PathwaysStatusDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchStopsNamesData({
        conn,
        table: "StationsTable",
        StopIdDropdown,
        PathwaysStatusDropDown,
      }),
  });

  const { data: PathwaysStatusData } = useQuery({
    queryKey: [
      "fetchPathwaysStatusData",
      "StationsTable",
      StopIdDropdown,
      StopNameDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchPathwaysStatusData({
        conn,
        table: "StationsTable",
        StopIdDropdown,
        StopNameDropDown,
      }),
  });

  const { data: WheelchairStatusData } = useQuery({
    queryKey: [
      "WheelchairStatusData",
      "StationsTable",
      StopIdDropdown,
      StopNameDropDown,
      PathwaysStatusDropDown,
    ],
    queryFn: () =>
      fetchWheelchairStatusData({
        conn,
        table: "StationsTable",
        StopIdDropdown,
        StopNameDropDown,
        PathwaysStatusDropDown,
      }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "fetchStationsData",
      "StationsTable",
      StopIdDropdown,
      StopNameDropDown,
      PathwaysStatusDropDown,
      WheelChairStatusDropDown,
    ],
    queryFn: () =>
      fetchStationsData({
        conn,
        table: "StationsTable",
        StopIdDropdown,
        StopNameDropDown,
        PathwaysStatusDropDown,
        WheelChairStatusDropDown,
      }),
  });

  const memoizedData = useMemo(() => {
    if (!data) return data;

    if (EditStatusDropDown && EditStatusDropDown.length > 0) {
      return data.filter((item) => {
        const hasEditStatus = item.status && item.status !== '';
        const isEdited = EditStatusDropDown.includes("edited");
        const isNotEdited = EditStatusDropDown.includes("not_edited");

        if (isEdited && isNotEdited) return true;
        if (isEdited) return hasEditStatus;
        if (isNotEdited) return !hasEditStatus;
        return true;
      });
    }

    return data;
  }, [data, EditStatusDropDown]);

  const hasEditedItems = useMemo(() => {
    if (!data || !Array.isArray(data)) return false;
    return data.some((station: any) => station.status && station.status !== '');
  }, [data]);

  return (
    <Tabs defaultValue="table">
      <TabsList className="h-[2.8em] mb-2">
        {ToggleTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.icon}
            <span className="ml-2"> {tab.label} </span>
          </TabsTrigger>
        ))}
      </TabsList>
      <Header
        setOpen={setOpen}
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
        EditStatusDropDown={EditStatusDropDown}
        setEditStatusDropDown={setEditStatusDropDown}
        hasEditedItems={hasEditedItems}
      />
      {isLoading || StationTableLoad || StationTableFetching ? (
        <Skeleton className="h-40 w-full mt-2" />
      ) : (
        <>
          <StopStationForm
            Data={data}
            OpenValue={Open}
            setOpenValue={setOpen}
            ClickInfo={ClickInfo}
            setClickInfo={setClickInfo}
            type="station"
          />
          <TabsContent value="table">
            <StationTable
              data={memoizedData}
              setOpen={setOpen}
              ClickInfo={ClickInfo}
              setClickInfo={setClickInfo}
            />
          </TabsContent>
          <TabsContent value="map">
            <StationMap
              data={memoizedData}
              setOpen={setOpen}
              ClickInfo={ClickInfo}
              setClickInfo={setClickInfo}
            />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}

export default AllStations;
