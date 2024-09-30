import { useState } from 'react';
import ToggleComponent from "@/components/MuiComponent/TabComponent";
import { useQuery } from "@tanstack/react-query";
import { fetchRouteData } from '@/hooks/DuckdbCalls/DataFetching/fetchRouteData';
import { useStationViewContext, useDuckDB } from "@/context/combinedContext";

import Header from './Header';
import TableCompononets from './TableCompononets/main';

function TableView() {
  const { conn } = useDuckDB();
  const { StationView } = useStationViewContext();
  const [TableView, setTableView] = useState("start");
  const [EmptyConnect, setEmptyConnect] = useState(true);
  const [StartDropdown, setStartDropdown] = useState();
  const [EndDropdown, setEndDropdown] = useState();
  const [TimeRange, setTimeRange] = useState();
  const [timeIntervalRanges, setTimeIntervalRanges] = useState([]);
  const [StartStops, setStartStops] = useState();
  const [StartStopTypesDropdown, setStartStopTypesDropdown] = useState();
  const [StartStopTypes, setStartStopTypes] = useState();
  const [EndStopTypesDropdown, setEndStopTypesDropdown] = useState();
  const [EndStopTypes, setEndStopTypes] = useState();
  const [EndStops, setEndStops] = useState();
  const { data: RouteData } = useQuery({
    queryKey: ["fetchRouteData", StationView],
    queryFn: () => fetchRouteData({ conn, StationView }),
  });

  const handleToggleChange = (value) => {
    if (value) {
      setTableView(value);
    }
  };

  return (
    <div>
      <ToggleComponent
        TabList={[
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ]}
        ToggleValue={TableView}
        setToggleValue={handleToggleChange}
        sizeTab="small"
      />
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
      <TableCompononets
        TableView={TableView}
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