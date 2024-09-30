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
  const { conn } = useDuckDB();
  const { StationView } = useStationViewContext();
  const [ToStop, setToStop] = useState();
  const [FromStop, setFromStop] = useState();
  const [ClickInfo, setClickInfo] = useState();
  const [EmptyArcs, setEmptyArcs] = useState(false);
  const [TimeRange, setTimeRange] = useState([]);
  const [DirectionTypes, setDirectionTypes] = useState();
  const [PathwayTypes, setPathwayTypes] = useState([]);
  const [ConnectionType, setConnectionType] = useState("directional");

  const { data: ToStopsData } = useQuery({
    queryKey: ["fetchToStopsData", StationView, FromStop, TimeRange],
    queryFn: () => fetchToStopsData({ conn, StationView, FromStop, TimeRange }),
  });
  const { data: fromStopsData } = useQuery({
    queryKey: ["fetchFromStopsData", StationView, ToStop, TimeRange],
    queryFn: () => fetchfromStopsData({ conn, StationView, ToStop, TimeRange }),
  });
  const { data: DirectionData } = useQuery({
    queryKey: ["fetchdirectionTypes", StationView, ToStop, FromStop, EmptyArcs, TimeRange],
    queryFn: () => fetchDirectionTypes({ conn, StationView, ToStop, FromStop, EmptyArcs, TimeRange }),
  });
  const { data: timeIntervalRanges, isLoading: RangesIsloading } = useQuery({
    queryKey: ["fetchtimeIntervalRanges", StationView, ToStop, FromStop],
    queryFn: () => fetchtimeIntervalRanges({ conn, StationView, ToStop, FromStop }),
  });

  const { data: pathwayTypeData } = useQuery({
    queryKey: ["fetchpathwayType", StationView, ToStop, FromStop],
    queryFn: () => fetchPathwayType({ conn, StationView, ToStop, FromStop }),
  });
  const { data: PathwaysData } = useQuery({
    queryKey: ["fetchPathwaysData", StationView, ToStop, FromStop, EmptyArcs, TimeRange, DirectionTypes, PathwayTypes],
    queryFn: () => fetchPathwaysData({ conn, StationView, ToStop, FromStop, EmptyArcs, TimeRange, DirectionTypes, PathwayTypes }),
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
          ConnectionType={ConnectionType} timeIntervalRanges={timeIntervalRanges}/>
        </div>
      )}
      <div className="relative h-full w-full">
        <MapSection
          PathwaysData={PathwaysData}
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
