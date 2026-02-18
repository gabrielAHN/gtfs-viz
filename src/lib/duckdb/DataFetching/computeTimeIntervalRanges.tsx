export const computeTimeIntervalRanges = (uniqueShortestTimes) => {
  if (!Array.isArray(uniqueShortestTimes) || uniqueShortestTimes.length === 0) {
    return [];
  }

  const sortedTimes = uniqueShortestTimes.sort((a, b) => a - b);
  const count = sortedTimes.length;

  const createRange = (min, max) => ({ min, max });

  if (count === 1) {
    return [createRange(sortedTimes[0], sortedTimes[0])];
  }

  if (count === 2) {
    return [
      createRange(sortedTimes[0], sortedTimes[0]),
      createRange(sortedTimes[1], sortedTimes[1]),
    ];
  }

  if (count <= 5) {
    return sortedTimes.map((time) => createRange(time, time));
  }

  const numberOfRanges = 5;
  const rangeSize = Math.ceil(count / numberOfRanges);
  const ranges = [];

  for (let i = 0; i < numberOfRanges; i++) {
    const startIdx = i * rangeSize;
    const endIdx = Math.min(startIdx + rangeSize, count);
    const rangeTimes = sortedTimes.slice(startIdx, endIdx);

    if (rangeTimes.length === 0) {
      continue;
    }

    if (rangeTimes.length === 1) {
      ranges.push(createRange(rangeTimes[0], rangeTimes[0]));
    } else {
      ranges.push(
        createRange(rangeTimes[0], rangeTimes[rangeTimes.length - 1])
      );
    }
  }

  return ranges.filter(
    (range) => typeof range.min === "number" && typeof range.max === "number"
  );
};
