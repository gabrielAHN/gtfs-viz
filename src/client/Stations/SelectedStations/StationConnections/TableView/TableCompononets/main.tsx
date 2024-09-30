import { useMemo, useEffect } from "react";
import StartTable from "./tables/StartTable";
import EndTable from "./tables/EndTable";
import { Skeleton } from "@mui/material";

import { doesRowPassInitialFilters } from "@/functions/stations/filters/initialFilters";
import { doesRowPassStopTypesFilters } from "@/functions/stations/filters/stopTypesFilters";
import { processFilteredData } from "@/functions/stations/filters/processFilteredData";
import { computeTimeIntervalRanges } from "@/functions/stations/filters/computeTimeIntervalRanges";

function TableComponents({
  RouteData,
  StartDropdown,
  EndDropdown,
  EmptyConnect,
  StartStopTypesDropdown,
  setStartStopTypes,
  EndStopTypesDropdown,
  setEndStopTypes,
  TimeRange,
  TableView,
  setStartStops,
  setEndStops,
  timeIntervalRanges,
  setTimeIntervalRanges,
}) {
  const isStartView = TableView === "start";

  const primaryKey = isStartView ? "start_stop" : "end_stop";
  const secondaryKey = isStartView ? "end_stop" : "start_stop";
  const secondaryStopsKey = isStartView ? "endStops" : "startStops";

  const {
    rows,
    uniqueStartStops,
    uniqueEndStops,
    uniqueStartStopTypes,
    uniqueEndStopTypes,
    uniqueShortestTimes,
  } = useMemo(() => {
    if (!RouteData || !Array.isArray(RouteData)) {
      return {
        rows: [],
        uniqueStartStops: [],
        uniqueEndStops: [],
        uniqueStartStopTypes: [],
        uniqueEndStopTypes: [],
        uniqueShortestTimes: [],
      };
    }

    const initialFilteredData = RouteData.filter((row) =>
      doesRowPassInitialFilters({
        row,
        StartDropdown,
        EndDropdown,
        EmptyConnect,
      })
    );

    const startStopTypesSet = new Set();
    const endStopTypesSet = new Set();
    initialFilteredData.forEach((row) => {
      const startType = row.from_location_type_name || "Unknown";
      const endType = row.to_location_type_name || "Unknown";
      startStopTypesSet.add(startType);
      endStopTypesSet.add(endType);
    });
    const uniqueStartStopTypes = Array.from(startStopTypesSet).sort();
    const uniqueEndStopTypes = Array.from(endStopTypesSet).sort();

    const finalFilteredData = initialFilteredData.filter((row) =>
      doesRowPassStopTypesFilters({
        row,
        StartStopTypesDropdown,
        EndStopTypesDropdown,
      })
    );

    const processedData = processFilteredData({
      filteredData: finalFilteredData,
      primaryKey,
      secondaryKey,
      secondaryStopsKey,
      StartStopTypesDropdown,
      EndStopTypesDropdown,
      TimeRange,
    });

    const uniqueShortestTimesSet = new Set();
    finalFilteredData.forEach((row) => {
      if (typeof row.shortest_time === "number") {
        uniqueShortestTimesSet.add(row.shortest_time);
      }
    });
    const uniqueShortestTimes = Array.from(uniqueShortestTimesSet).sort(
      (a, b) => a - b
    );

    return {
      rows: processedData.rows,
      uniqueStartStops: processedData.uniqueStartStops,
      uniqueEndStops: processedData.uniqueEndStops,
      uniqueStartStopTypes,
      uniqueEndStopTypes,
      uniqueShortestTimes,
    };
  }, [
    RouteData,
    StartDropdown,
    EndDropdown,
    EmptyConnect,
    StartStopTypesDropdown,
    EndStopTypesDropdown,
    TimeRange,
    TableView,
    primaryKey,
    secondaryKey,
    secondaryStopsKey,
  ]);

  useEffect(() => {
    const ranges = computeTimeIntervalRanges(uniqueShortestTimes);
    setTimeIntervalRanges(ranges);
  }, [uniqueShortestTimes]);

  useEffect(() => {
    if (setStartStops) {
      setStartStops(uniqueStartStops);
    }

    if (setEndStops) {
      setEndStops(uniqueEndStops);
    }

    if (setStartStopTypes) {
      setStartStopTypes(uniqueStartStopTypes);
    }

    if (setEndStopTypes) {
      setEndStopTypes(uniqueEndStopTypes);
    }
  }, [
    uniqueStartStops,
    uniqueEndStops,
    uniqueStartStopTypes,
    uniqueEndStopTypes,
    setStartStops,
    setEndStops,
    setStartStopTypes,
    setEndStopTypes,
  ]);

  if (!RouteData || !Array.isArray(RouteData)) {
    return <Skeleton variant="rounded" height={400} />;
  }

  return (
    <div className="mt-5">
      {rows.length === 0 ? (
        <div className="flex justify-center items-center h-96">
          <h2 className="text-xl font-semibold text-gray-500">
            No connections found
          </h2>
        </div>
      ) : isStartView ? (
        <StartTable rows={rows} timeIntervalRanges={timeIntervalRanges} />
      ) : (
        <EndTable rows={rows} timeIntervalRanges={timeIntervalRanges} />
      )}
    </div>
  );
}

export default TableComponents;
