import { useMemo, useEffect } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import ChildTable from "@/components/table/ChildTable"
import {
  doesRowPassInitialFilters,
  doesRowPassStopTypesFilters,
  processFilteredData,
  computeTimeIntervalRanges,
} from "@/lib/duckdb/DataFetching";

function Table({
  RouteData,
  StartDropdown,
  EndDropdown,
  EmptyConnect,
  StartStopTypesDropdown,
  setStartStopTypes,
  EndStopTypesDropdown,
  setEndStopTypes,
  TimeRange,
  ExcludeTime,
  TabValue,
  setStartStops,
  setEndStops,
  timeIntervalRanges,
  setTimeIntervalRanges,
  SortBy,
  SortOrder,
  setSortBy,
  setSortOrder,
  isLoading = false,
}) {
  const isStartView = TabValue === "start";

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
      ExcludeTime,
      SortBy,
      SortOrder,
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
    ExcludeTime,
    SortBy,
    SortOrder,
    TabValue,
    primaryKey,
    secondaryKey,
    secondaryStopsKey,
  ]);

  useEffect(() => {
    if (setTimeIntervalRanges) {
      const ranges = computeTimeIntervalRanges(uniqueShortestTimes);
      
      const rangesChanged = ranges.length !== timeIntervalRanges?.length ||
        ranges.some((range, idx) =>
          range.min !== timeIntervalRanges?.[idx]?.min ||
          range.max !== timeIntervalRanges?.[idx]?.max
        );

      if (rangesChanged) {
        setTimeIntervalRanges(ranges);
      }
    }
  }, [uniqueShortestTimes, setTimeIntervalRanges, timeIntervalRanges]);

  const uniqueStartStopsStr = JSON.stringify(uniqueStartStops);
  const uniqueEndStopsStr = JSON.stringify(uniqueEndStops);
  const uniqueStartStopTypesStr = JSON.stringify(uniqueStartStopTypes);
  const uniqueEndStopTypesStr = JSON.stringify(uniqueEndStopTypes);

  useEffect(() => {
    if (setStartStops) {
      setStartStops(JSON.parse(uniqueStartStopsStr));
    }

    if (setEndStops) {
      setEndStops(JSON.parse(uniqueEndStopsStr));
    }

    if (setStartStopTypes) {
      setStartStopTypes(JSON.parse(uniqueStartStopTypesStr));
    }

    if (setEndStopTypes) {
      setEndStopTypes(JSON.parse(uniqueEndStopTypesStr));
    }
  }, [
    uniqueStartStopsStr,
    uniqueEndStopsStr,
    uniqueStartStopTypesStr,
    uniqueEndStopTypesStr,
    setStartStops,
    setEndStops,
    setStartStopTypes,
    setEndStopTypes,
  ]);

  if (isLoading || !RouteData || !Array.isArray(RouteData)) {
    return (
      <div className="mt-5">
        <ChildTable
          parentColumn={{
            label: isStartView ? 'Start Stop' : 'End Stop',
            value: isStartView ? 'start_stop' : 'end_stop',
          }}
          childColumn={{
            label: isStartView ? 'End Stop' : 'Start Stop',
            value: isStartView ? 'endStops' : 'startStops',
            childValue: isStartView ? 'end_stop' : 'start_stop'
          }}
          rows={[]}
          isLoading={true}
          sortBy={undefined}
          sortOrder={undefined}
          onSortChange={undefined}
        />
      </div>
    );
  }

  return (
    <div className="mt-5 ">
      {rows.length === 0 ? (
        <div className="flex justify-center items-center h-96">
          <h2 className="text-xl font-semibold text-gray-500">
            No connections found
          </h2>
        </div>
      ) : isStartView ? (
        <ChildTable
          parentColumn={{
            label: 'Start Stop',
            value: 'start_stop',
          }}
          childColumn={{
            label: 'End Stop',
            value: 'endStops',
            childValue: 'end_stop'
          }}
          rows={rows}
          isLoading={false}
          sortBy={SortBy}
          sortOrder={SortOrder}
          onSortChange={(newSortBy, newSortOrder) => {
            if (setSortBy) setSortBy(newSortBy);
            if (setSortOrder) setSortOrder(newSortOrder);
          }}
        />
      ) : (
        <ChildTable
          parentColumn={{
            label: 'End Stop',
            value: 'end_stop'
          }}
          childColumn={{
            label: 'Start Stop',
            value: 'startStops',
            childValue: 'start_stop'
          }}
          rows={rows}
          isLoading={false}
          sortBy={SortBy}
          sortOrder={SortOrder}
          onSortChange={(newSortBy, newSortOrder) => {
            if (setSortBy) setSortBy(newSortBy);
            if (setSortOrder) setSortOrder(newSortOrder);
          }}
        />
      )}
    </div>
  );
}

export default Table;
