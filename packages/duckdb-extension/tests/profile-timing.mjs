const TIME_PATH = "/usr/bin/time";
const DUCKDB_ARGS = ["-bail", "-json", ":memory:"];

export function externalTimerForPlatform(platformName, timerAvailable) {
  if (!timerAvailable) return null;
  if (platformName === "darwin") {
    return { command: TIME_PATH, args: ["-l"], rssFormat: "darwin" };
  }
  if (platformName === "linux") {
    return { command: TIME_PATH, args: ["-v"], rssFormat: "gnu" };
  }
  return null;
}

export function profileInvocation(timer) {
  if (!timer) return { command: "duckdb", args: [...DUCKDB_ARGS] };
  return {
    command: timer.command,
    args: [...timer.args, "duckdb", ...DUCKDB_ARGS],
  };
}

export function parsePeakRssMB(stderr, rssFormat) {
  const match =
    rssFormat === "darwin"
      ? /(\d+)\s+maximum resident set size/i.exec(stderr)
      : rssFormat === "gnu"
        ? /Maximum resident set size \(kbytes\):\s*(\d+)/i.exec(stderr)
        : null;
  if (!match) return null;
  const bytes = Number(match[1]) * (rssFormat === "gnu" ? 1024 : 1);
  return Math.round(bytes / 1048576);
}
