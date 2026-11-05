// Native consumer harness for @gtfs-viz/duckdb-client: drives the DuckDB CLI through the published
// client entry against a staged gtfs extension repository served over HTTP. Each DuckDB CLI run is a
// fresh session, so the executor replays `LOAD spatial; LOAD gtfs;` once the client has loaded gtfs.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createExtensionClient, importSql, addGeomColumnsSql } from '@gtfs-viz/duckdb-client';

const exec = promisify(execFile);
const staged = process.env.GTFS_STAGED_REPOSITORY;
assert.ok(staged, 'GTFS_STAGED_REPOSITORY must point to a staged gtfs extension repository directory');
const binary = process.env.DUCKDB_BIN;
assert.ok(binary, 'DUCKDB_BIN must select the matching native engine');
const env = { ...process.env };
delete env.AI_AGENT;
const version = JSON.parse((await exec(binary, ['-json', ':memory:', '-c', 'SELECT version() AS v'], { env })).stdout)[0].v;
const platform = JSON.parse((await exec(binary, ['-json', ':memory:', '-c', 'PRAGMA platform'], { env })).stdout)[0].platform;
const data = await readFile(resolve(staged, version, platform, 'gtfs.duckdb_extension.gz'));
const requests = [];
const server = createServer((req, res) => {
  requests.push(req.url);
  if (req.url === `/${version}/${platform}/gtfs.duckdb_extension.gz`) { res.writeHead(200); res.end(data); }
  else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const repository = `http://127.0.0.1:${server.address().port}`;
const dir = await mkdtemp(join(tmpdir(), 'gtfs-consumer-native-'));

const home = async name => {
  const path = join(dir, name);
  await mkdir(path, { recursive: true });
  if (process.env.GTFS_DEPENDENCY_CACHE) await cp(process.env.GTFS_DEPENDENCY_CACHE, join(path, 'extensions'), { recursive: true });
  return path;
};

// A SqlExecutor over DuckDB CLI subprocesses on one database file.
const nativeSession = (databasePath, { home, unsigned }) => {
  let loaded = false;
  const run = async sql => {
    const args = [
      ...(unsigned ? ['-unsigned'] : []),
      '-cmd', `SET home_directory='${home}'; SET extension_directories=['${home}/extensions'];`,
      '-noheader', '-list', databasePath, '-c', sql,
    ];
    try {
      return (await exec(binary, args, { env, timeout: 120000, maxBuffer: 64 * 1024 * 1024 })).stdout;
    } catch (error) {
      throw new Error((error.stderr || error.stdout || error.message).trim());
    }
  };
  return {
    async query(sql) {
      const lifecycle = /^\s*(INSTALL|LOAD)\b/i.test(sql);
      const out = await run(loaded && !lifecycle ? `LOAD spatial; LOAD gtfs; ${sql}` : sql);
      if (/^\s*LOAD gtfs\s*;?\s*$/i.test(sql)) loaded = true;
      return out;
    },
    // Rows as JSON objects, read from lines with a known prefix so DuckDB notices cannot break parsing.
    async rows(sql) {
      const out = await this.query(`SELECT 'ROW\t' || to_json(q) FROM (${sql}) q;`);
      return out.split('\n').filter(line => line.startsWith('ROW\t')).map(line => JSON.parse(line.slice(4)));
    },
  };
};

try {
  const feed = join(dir, 'feed');
  await mkdir(feed);
  await writeFile(join(feed, 'stops.txt'), 'stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station\nS,Station,35,139,1,\nP,Platform,35.001,139,0,S\n');

  // Unsigned development loading from the staged HTTP repository.
  const positive = await home('positive');
  const dbPath = join(positive, 'data.duckdb');
  const session = nativeSession(dbPath, { home: positive, unsigned: true });
  const client = createExtensionClient(session, { repository });
  await session.query('INSTALL spatial;');
  await client.install();
  await client.load();
  console.log('STAGE import');
  await client.importDirectory(feed);
  await session.query(addGeomColumnsSql());
  console.log('STAGE imported');
  assert.deepEqual(await session.rows('SELECT count(*) AS n FROM stops WHERE geom IS NOT NULL'), [{ n: 2 }]);
  assert.deepEqual(await session.rows('SELECT stop_name FROM StationsTable'), [{ stop_name: 'Station' }]);

  // Edits survive a refresh, a reopen with a load-only client and a repeated import.
  await session.query("INSERT INTO EditStopTable (row_id,stop_id,stop_name,stop_lat,stop_lon,location_type_name,parent_station,level_id,wheelchair_status,status) VALUES ('1','S','Edited',35,139,'Station','','','🔵','edit')");
  await client.refresh();
  const edited = [{ stop_name: 'Edited', pending: 1 }];
  const editedSql = 'SELECT stop_name,(SELECT count(*) FROM EditStopTable) AS pending FROM StationsTable';
  assert.deepEqual(await session.rows(editedSql), edited);
  const reopened = nativeSession(dbPath, { home: positive, unsigned: true });
  await createExtensionClient(reopened, {}).load();
  assert.deepEqual(await reopened.rows(editedSql), edited);
  console.log('STAGE import');
  await reopened.query(importSql(feed));
  await reopened.query(addGeomColumnsSql());
  console.log('STAGE imported');
  assert.deepEqual(await reopened.rows(editedSql), edited);
  assert.deepEqual(await reopened.rows("SELECT count(*) AS n FROM duckdb_functions() WHERE database_name = 'data' AND function_type IN ('macro', 'table_macro')"), [{ n: 0 }]);

  // Default signature policy: a missing repository fails with guidance, an unsigned build is refused.
  const strict = await home('strict');
  const missing = createExtensionClient(nativeSession(join(strict, 'missing.duckdb'), { home: strict, unsigned: false }), { repository: `${repository}/missing-repository` });
  await assert.rejects(missing.install(), error => /404/.test(error.cause?.message) && /^gtfs install failed:[\s\S]*No fallback was attempted/.test(error.message));
  const signed = createExtensionClient(nativeSession(join(strict, 'data.duckdb'), { home: strict, unsigned: false }), { repository });
  await assert.rejects(signed.install().then(() => signed.load()), error => /unsigned|signature/i.test(error.cause?.message));
  console.log(JSON.stringify({ status: 'PASS', version, platform, scope: 'duckdb-client install/load/import over the native DuckDB CLI, CSV import, geometry, edit/refresh, load-only reopen, repeated import, no embedded macros, missing-repository guidance, default signature rejection', requests }));
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await rm(dir, { recursive: true, force: true });
}
