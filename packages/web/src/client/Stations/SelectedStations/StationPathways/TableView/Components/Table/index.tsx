import { useMemo, useEffect } from "react";

import ChildTable from "@/components/table/ChildTable"
import {
  doesRowPassInitialFilters,
  processFilteredData,
  computeTimeIntervalRanges,
} from "@/lib/duckdb/DataFetching";

function Table({
  RouteData,
  StartDropdown,
  EndDropdown,
  EmptyConnect,
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
  onRouteClick,
}) {
  const isStartView = TabValue === "start";

  const primaryKey = isStartView ? "start_stop" : "end_stop";
  const secondaryKey = isStartView ? "end_stop" : "start_stop";
  const secondaryStopsKey = isStartView ? "endStops" : "startStops";

  const {
    rows,
    uniqueShortestTimes,
  } = useMemo(() => {
    if (!RouteData || !Array.isArray(RouteData)) {
      return {
        rows: [],
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

    const processedData = processFilteredData({
      filteredData: initialFilteredData,
      primaryKey,
      secondaryKey,
      secondaryStopsKey,
      TimeRange,
      ExcludeTime,
      SortBy,
      SortOrder,
    });

    const uniqueShortestTimesSet = new Set();
    initialFilteredData.forEach((row) => {
      if (typeof row.shortest_time === "number") {
        uniqueShortestTimesSet.add(row.shortest_time);
      }
    });
    const uniqueShortestTimes = Array.from(uniqueShortestTimesSet).sort(
      (a, b) => a - b
    );

    return {
      rows: processedData.rows,
      uniqueShortestTimes,
    };
  }, [
    RouteData,
    StartDropdown,
    EndDropdown,
    EmptyConnect,
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

  if (isLoading || !RouteData || !Array.isArray(RouteData)) {
    return (
      <div className="mt-5">
        <ChildTable
          parentColumn={{
            label: isStartView ? 'From Node' : 'To Node',
            value: isStartView ? 'start_stop' : 'end_stop',
          }}
          childColumn={{
            label: isStartView ? 'To Node' : 'From Node',
            value: isStartView ? 'endStops' : 'startStops',
            childValue: isStartView ? 'end_stop' : 'start_stop'
          }}
          rows={[]}
          isLoading={true}
          sortBy={undefined}
          sortOrder={undefined}
          onSortChange={undefined}
          onChildRowClick={undefined}
        />
      </div>
    );
  }

  return (
    <div className="mt-5 ">
      {rows.length === 0 ? (
        <div className="flex justify-center items-center h-96">
          <h2 className="text-xl font-semibold text-gray-500">
            No Time Interval Data
          </h2>
        </div>
      ) : isStartView ? (
        <ChildTable
          parentColumn={{
            label: 'From Node',
            value: 'start_stop',
          }}
          childColumn={{
            label: 'To Node',
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
          onChildRowClick={
            onRouteClick
              ? ({ row, childStop }) =>
                  onRouteClick({
                    start_stop: row.start_stop,
                    end_stop: childStop.end_stop,
                    shortest_time: childStop.shortest_time,
                  })
              : undefined
          }
        />
      ) : (
        <ChildTable
          parentColumn={{
            label: 'To Node',
            value: 'end_stop'
          }}
          childColumn={{
            label: 'From Node',
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
          onChildRowClick={
            onRouteClick
              ? ({ row, childStop }) =>
                  onRouteClick({
                    start_stop: childStop.start_stop,
                    end_stop: row.end_stop,
                    shortest_time: childStop.shortest_time,
                  })
              : undefined
          }
        />
      )}
    </div>
  );
}

export default Table;
