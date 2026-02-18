import { doesConnectionPassTimeRange } from "./timeRangeFilter";

export const processFilteredData = ({
  filteredData,
  primaryKey,
  secondaryKey,
  secondaryStopsKey,
  StartStopTypesDropdown,
  EndStopTypesDropdown,
  TimeRange,
}) => {
  const stopsMap = new Map();
  const startStopsMap = new Map();
  const endStopsMap = new Map();

  filteredData.forEach((row) => {
    const {
      start_stop,
      end_stop,
      from_location_type_name,
      to_location_type_name,
      shortest_time,
    } = row;

    const startLocationTypeName = from_location_type_name || "Unknown";
    const endLocationTypeName = to_location_type_name || "Unknown";

    if (!startStopsMap.has(start_stop)) {
      startStopsMap.set(start_stop, startLocationTypeName);
    }
    if (!endStopsMap.has(end_stop)) {
      endStopsMap.set(end_stop, endLocationTypeName);
    }

    const primaryStop = primaryKey === "start_stop" ? start_stop : end_stop;
    const secondaryStop = primaryKey === "start_stop" ? end_stop : start_stop;
    const primaryLocationType =
      primaryKey === "start_stop" ? startLocationTypeName : endLocationTypeName;
    const secondaryLocationType =
      primaryKey === "start_stop" ? endLocationTypeName : startLocationTypeName;

    if (!stopsMap.has(primaryStop)) {
      stopsMap.set(primaryStop, {
        [primaryKey]: primaryStop,
        primaryLocationType: primaryLocationType,
        [secondaryStopsKey]: [],
      });
    }

    if (
      Array.isArray(StartStopTypesDropdown) &&
      StartStopTypesDropdown.length > 0 &&
      !StartStopTypesDropdown.includes(primaryLocationType)
    ) {
      return;
    }

    if (
      Array.isArray(EndStopTypesDropdown) &&
      EndStopTypesDropdown.length > 0 &&
      !EndStopTypesDropdown.includes(secondaryLocationType)
    ) {
      return;
    }

    const connection = { shortest_time };
    if (!doesConnectionPassTimeRange({ connection, TimeRange })) {
      return;
    }

    stopsMap.get(primaryStop)[secondaryStopsKey].push({
      [secondaryKey]: secondaryStop,
      secondaryLocationType: secondaryLocationType,
      shortest_time:
        shortest_time !== null && shortest_time !== undefined
          ? shortest_time
          : "-",
    });
  });

  stopsMap.forEach((value, key) => {
    if (value[secondaryStopsKey].length === 0) {
      stopsMap.delete(key);
    }
  });

  const rowsArray = Array.from(stopsMap.values()).sort((a, b) =>
    a[primaryKey].localeCompare(b[primaryKey])
  );

  rowsArray.forEach((row) => {
    row[secondaryStopsKey].sort((a, b) =>
      a[secondaryKey].localeCompare(b[secondaryKey])
    );
  });

  const uniqueStartStops = Array.from(
    startStopsMap,
    ([stop_id, location_type]) => ({
      stop_id,
      location_type,
    })
  ).sort((a, b) => a.stop_id.localeCompare(b.stop_id));

  const uniqueEndStops = Array.from(
    endStopsMap,
    ([stop_id, location_type]) => ({
      stop_id,
      location_type,
    })
  ).sort((a, b) => a.stop_id.localeCompare(b.stop_id));

  const startStopTypesSet = new Set();
  startStopsMap.forEach((type) => startStopTypesSet.add(type));

  const endStopTypesSet = new Set();
  endStopsMap.forEach((type) => endStopTypesSet.add(type));

  const uniqueStartStopTypes = Array.from(startStopTypesSet).sort();
  const uniqueEndStopTypes = Array.from(endStopTypesSet).sort();

  return {
    rows: rowsArray,
    uniqueStartStops,
    uniqueEndStops,
    uniqueStartStopTypes,
    uniqueEndStopTypes,
  };
};
