import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";

import { fetchRouteData } from '@/hooks/DuckdbCalls/DataFetching/fetchRouteData';
import { useStationViewContext, useDuckDB } from "@/context/combinedContext";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import Header from './Header';
import Table from './Components/Table';


const ToggleTabs = [
  { value: "start", label: "Start" },
  { value: "end", label: "End" }
];

function TableView() {
  const { conn } = useDuckDB();
  const { StationView } = useStationViewContext();
  const [TabValue, setTabValue] = useState("start");
  const [EmptyConnect, setEmptyConnect] = useState(true);
  const [StartDropdown, setStartDropdown] = useState();
  const [EndDropdown, setEndDropdown] = useState();
  const [TimeRange, setTimeRange] = useState();
  const [timeIntervalRanges, setTimeIntervalRanges] = useState([]);
  const [StartStops, setStartStops] = useState([]);
  const [StartStopTypesDropdown, setStartStopTypesDropdown] = useState([]);
  const [StartStopTypes, setStartStopTypes] = useState([]);
  const [EndStopTypesDropdown, setEndStopTypesDropdown] = useState([]);
  const [EndStopTypes, setEndStopTypes] = useState([]);
  const [EndStops, setEndStops] = useState([]);
  
  const { data: RouteData } = useQuery({
    queryKey: ["fetchRouteData"],
    queryFn: () => fetchRouteData({ conn, StationView }),
  });

  const TabChange = (e)=>{setTabValue(e)}

  return (
    <div>
      <Tabs value={TabValue} onValueChange={TabChange}>
        <TabsList className="h-9">
          {ToggleTabs.map((tab) => (
            <TabsTrigger className="h-7" key={tab.value} value={tab.value}>
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Header 
        StartDropdown={StartDropdown} setStartDropdown={setStartDropdown}
        setEndDropdown={setEndDropdown} RouteData={RouteData} 
        EmptyConnect={EmptyConnect} setEmptyConnect={setEmptyConnect}
        StartStops={StartStops} setStartStops={setStartStops}
        EndStops={EndStops} setEndStops={setEndStops}
        StartStopTypes={StartStopTypes} setStartStopTypes={setStartStopTypes}
        setStartStopTypesDropdown={setStartStopTypesDropdown} StartStopTypesDropdown={StartStopTypesDropdown}
        EndStopTypes={EndStopTypes} setEndStopTypes={setEndStopTypes}
        setEndStopTypesDropdown={setEndStopTypesDropdown} EndStopTypesDropdown={EndStopTypesDropdown}
        timeIntervalRanges={timeIntervalRanges}
        TimeRange={TimeRange} setTimeRange={setTimeRange}
        />
      <Table
        TabValue={TabValue}
        StartDropdown={StartDropdown}
        EndDropdown={EndDropdown} StartStopTypes={StartStopTypes}
        setStartStopTypes={setStartStopTypes} StartStopTypesDropdown={StartStopTypesDropdown}
        setStartStopTypesDropdown={setStartStopTypesDropdown}
        EndStopTypes={EndStopTypes} setEndStopTypes={setEndStopTypes}
        setEndStopTypesDropdown={setEndStopTypesDropdown} EndStopTypesDropdown={EndStopTypesDropdown}
        RouteData={RouteData} EmptyConnect={EmptyConnect}
        StartStops={StartStops} setStartStops={setStartStops}
        EndStops={EndStops} setEndStops={setEndStops} 
        TimeRange={TimeRange} setTimeIntervalRanges={setTimeIntervalRanges}
        timeIntervalRanges={timeIntervalRanges}
      />
    </div>
  );
}
export default TableView;