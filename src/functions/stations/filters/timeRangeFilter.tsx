export const doesConnectionPassTimeRange = ({
  connection,
  TimeRange,
  EmptyConnect,
}) => {
  if (!Array.isArray(TimeRange) || TimeRange.length !== 2) {
    return true;
  }

  const [min, max] = TimeRange;
  const time =
    typeof connection.shortest_time === "number"
      ? connection.shortest_time
      : null;

  if (time === null) {
    return !EmptyConnect;
  }

  return time >= min && time <= max;
};
