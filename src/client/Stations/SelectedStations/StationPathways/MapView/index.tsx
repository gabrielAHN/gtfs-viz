import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPathwaysData,
  fetchToStopsData,
  fetchfromStopsData,
  fetchDirectionTypes,
  fetchPathwayType,
  fetchtimeIntervalRanges
} from "@/hooks/DuckdbCalls/DataFetching/fetchPathwaysData";
import { useStationViewContext, useDuckDB } from "@/context/combinedContext";

import Header from "./Header";
import ClickPopup from "./ClickPopup";
import MapSection from "./MapSection";
import MapLegend from "./MapLegend";

function MapView() {
  const { StationView } = useStationViewContext();
  const { conn } = useDuckDB()

  const [ToStop, setToStop] = useState();
  const [FromStop, setFromStop] = useState();
  const [ClickInfo, setClickInfo] = useState();
  const [EmptyArcs, setEmptyArcs] = useState(true);
  const [TimeRange, setTimeRange] = useState([]);
  const [DirectionTypes, setDirectionTypes] = useState();
  const [PathwayTypes, setPathwayTypes] = useState([]);
  const [ConnectionType, setConnectionType] = useState("directional");

  const { data: ToStopsData } = useQuery({
    queryKey: ["fetchToStopsData", FromStop, TimeRange],
    queryFn: () => fetchToStopsData({ conn, table: 'pathways', StationView, FromStop, TimeRange }),
  });
  const { data: fromStopsData } = useQuery({
    queryKey: ["fetchFromStopsData", ToStop, TimeRange],
    queryFn: () => fetchfromStopsData({ conn, table: 'pathways', StationView, ToStop, TimeRange }),
  });
  const { data: DirectionData } = useQuery({
    queryKey: ["fetchdirectionTypes", ToStop, FromStop, EmptyArcs, TimeRange],
    queryFn: () => fetchDirectionTypes({ conn, table: 'pathways', StationView, ToStop, FromStop, EmptyArcs, TimeRange }),
  });
  const { data: timeIntervalRanges, isLoading: RangesIsloading } = useQuery({
    queryKey: ["fetchtimeIntervalRanges", ToStop, FromStop],
    queryFn: () => fetchtimeIntervalRanges({ conn, table: 'pathways', StationView, ToStop, FromStop }),
  });
  const { data: pathwayTypeData } = useQuery({
    queryKey: ["fetchpathwayType", ToStop, FromStop],
    queryFn: () => fetchPathwayType({ conn, table: 'pathways', StationView, ToStop, FromStop }),
  });
  const { data: PathwaysData } = useQuery({
    queryKey: ["fetchPathwaysData", ToStop, FromStop, EmptyArcs, TimeRange, DirectionTypes, PathwayTypes],
    queryFn: () => fetchPathwaysData({ conn, table: 'StopsView', StationView, ToStop, FromStop, EmptyArcs, TimeRange, DirectionTypes, PathwayTypes }),
  });

  return (
    <div className="relative h-full w-full">
      <Header
        ConnectionType={ConnectionType}
        ToStopsData={ToStopsData}
        ToStop={ToStop}
        setToStop={setToStop}
        fromStopsData={fromStopsData}
        FromStop={FromStop}
        setFromStop={setFromStop}
        EmptyArcs={EmptyArcs}
        setEmptyArcs={setEmptyArcs}
        TimeRange={TimeRange}
        setTimeRange={setTimeRange}
        DirectionData={DirectionData}
        DirectionTypes={DirectionTypes}
        setDirectionTypes={setDirectionTypes}
        timeIntervalRanges={timeIntervalRanges}
        pathwayTypeData={pathwayTypeData}
        PathwayTypes={PathwayTypes}
        setPathwayTypes={setPathwayTypes}
        RangesIsloading={RangesIsloading}
      />
      {ClickInfo && (
        <div className="relative">
          <ClickPopup ClickInfo={ClickInfo} setClickInfo={setClickInfo}
            ConnectionType={ConnectionType} timeIntervalRanges={timeIntervalRanges} />
        </div>
      )}
      <div className="relative h-full w-full border p-1 rounded-md overflow-hidden">
        <div className="text-sm text-stone-500 m-3">
          Click a Point or Arc to find out more.
        </div>
        <MapSection
          Data={PathwaysData}
          setClickInfo={setClickInfo}
          ClickInfo={ClickInfo}
          ConnectionType={ConnectionType}
          timeIntervalRanges={timeIntervalRanges}
        />
        <MapLegend
          DirectionData={DirectionData}
          setDirectionTypes={setDirectionTypes}
          pathwayTypeData={pathwayTypeData}
          setPathwayTypes={setPathwayTypes}
          timeIntervalRanges={timeIntervalRanges} setEmptyArcs={setEmptyArcs}
          ConnectionType={ConnectionType} setConnectionType={setConnectionType} />
      </div>
    </div>
  );
}
export default MapView;
