export const doesConnectionPassTimeRange = ({
  connection,
  TimeRange,
  ExcludeTime,
  EmptyConnect,
}) => {
  const time =
    typeof connection.shortest_time === "number"
      ? connection.shortest_time
      : null;

  if (ExcludeTime !== undefined && ExcludeTime !== null) {
    return time !== ExcludeTime;
  }

  if (!Array.isArray(TimeRange) || TimeRange.length !== 2) {
    return true;
  }

  const [min, max] = TimeRange;

  if (time === null) {
    return !EmptyConnect;
  }

  return time >= min && time <= max;
};
