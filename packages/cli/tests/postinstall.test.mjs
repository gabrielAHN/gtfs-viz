import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const postinstallScript = fileURLToPath(
  new URL("../scripts/postinstall.mjs", import.meta.url)
);

async function createIsolatedData(t) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-postinstall-"));
  const home = path.join(sandbox, "home");
  const temp = path.join(sandbox, "tmp");
  const dataRoot = path.join(home, ".gtfs-viz-cli");
  const sessionRoot = path.join(temp, "gtfs-viz-cli");
  const importedFeed = path.join(dataRoot, "imported-feed.zip");
  const sessionDatabase = path.join(dataRoot, "current.duckdb");
  const sessionState = path.join(sessionRoot, "session.json");

  await mkdir(dataRoot, { recursive: true });
  await mkdir(sessionRoot, { recursive: true });
  await writeFile(importedFeed, "feed sentinel");
  await writeFile(sessionDatabase, "database sentinel");
  await writeFile(sessionState, "session sentinel");

  t.after(() => rm(sandbox, { recursive: true, force: true }));

  return {
    home,
    temp,
    sentinels: [
      [importedFeed, "feed sentinel"],
      [sessionDatabase, "database sentinel"],
      [sessionState, "session sentinel"],
    ],
  };
}

async function runPostinstall({ home, temp }, overrides = {}) {
  const env = {
    ...process.env,
    HOME: home,
    TMPDIR: temp,
    ...overrides,
  };
  delete env.GTFS_VIZ_PRESERVE_DATA;
  delete env.GTFS_VIZ_RESET_DATA;
  Object.assign(env, overrides);

  return execFileAsync(process.execPath, [postinstallScript], { env });
}

test("postinstall preserves user data by default", async (t) => {
  const fixture = await createIsolatedData(t);

  await runPostinstall(fixture);

  for (const [sentinel, expected] of fixture.sentinels) {
    assert.equal(await readFile(sentinel, "utf8"), expected);
  }
});

test("postinstall removes user data only with an explicit reset", async (t) => {
  const fixture = await createIsolatedData(t);

  await runPostinstall(fixture, { GTFS_VIZ_RESET_DATA: "1" });

  for (const [sentinel] of fixture.sentinels) {
    await assert.rejects(access(sentinel), { code: "ENOENT" });
  }
});

test("postinstall preserves user data for unrelated environment values", async (t) => {
  const fixture = await createIsolatedData(t);

  await runPostinstall(fixture, {
    GTFS_VIZ_PRESERVE_DATA: "0",
    GTFS_VIZ_RESET_DATA: "true",
  });

  for (const [sentinel, expected] of fixture.sentinels) {
    assert.equal(await readFile(sentinel, "utf8"), expected);
  }
});
