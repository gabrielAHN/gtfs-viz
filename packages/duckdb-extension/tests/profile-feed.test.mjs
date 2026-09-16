import assert from "node:assert/strict";
import test from "node:test";
import {
  externalTimerForPlatform,
  parsePeakRssMB,
  profileInvocation,
} from "./profile-timing.mjs";

const duckdbArgs = ["-bail", "-json", ":memory:"];

test("Darwin profiling uses BSD time and converts byte RSS", () => {
  const timer = externalTimerForPlatform("darwin", true);
  assert.deepEqual(timer, {
    command: "/usr/bin/time",
    args: ["-l"],
    rssFormat: "darwin",
  });
  assert.equal(parsePeakRssMB("104857600  maximum resident set size", timer.rssFormat), 100);
  assert.deepEqual(profileInvocation(timer), {
    command: "/usr/bin/time",
    args: ["-l", "duckdb", ...duckdbArgs],
  });
});

test("GNU/Linux profiling uses GNU time and converts kilobyte RSS", () => {
  const timer = externalTimerForPlatform("linux", true);
  assert.deepEqual(timer, {
    command: "/usr/bin/time",
    args: ["-v"],
    rssFormat: "gnu",
  });
  assert.equal(
    parsePeakRssMB("Maximum resident set size (kbytes): 153600", timer.rssFormat),
    150,
  );
});

test("profiling runs DuckDB directly when no supported external timer exists", () => {
  assert.equal(externalTimerForPlatform("linux", false), null);
  assert.equal(externalTimerForPlatform("win32", true), null);
  assert.deepEqual(profileInvocation(null), {
    command: "duckdb",
    args: duckdbArgs,
  });
  assert.equal(parsePeakRssMB("", null), null);
});
