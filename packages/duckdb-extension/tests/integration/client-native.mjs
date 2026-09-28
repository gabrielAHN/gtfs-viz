import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExtensionClient } from '@gtfs-viz/duckdb-extension/client';

const exec = promisify(execFile);
const vizRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const extensionRoot = resolve(process.env.GTFS_DUCK_TOOLS_ROOT || resolve(vizRoot, '../gtfs-duck-tools'));
const binary = process.env.DUCKDB_BIN;
assert.ok(binary, 'Set DUCKDB_BIN to the matching standalone native DuckDB CLI');
const artifact = process.env.GTFS_EXTENSION || resolve(extensionRoot, 'build/release/extension/gtfs_duck_tools/gtfs_duck_tools.duckdb_extension');
const fixture = await readFile(resolve(extensionRoot, 'test/fixtures/normalized.sql'), 'utf8');
const compressed = gzipSync(await readFile(artifact));
const version = JSON.parse((await exec(binary, ['-json', ':memory:', '-c', 'SELECT version() AS version'])).stdout)[0].version;
const platform = JSON.parse((await exec(binary, ['-json', ':memory:', '-c', 'PRAGMA platform'])).stdout)[0].platform;
const requests = [];
const repo = createServer((req, res) => {
  requests.push(req.url);
  if (req.url === `/${version}/${platform}/gtfs_duck_tools.duckdb_extension.gz`) {
    res.writeHead(200, { 'Content-Type': 'application/gzip' });
    res.end(compressed);
  } else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => repo.listen(0, '127.0.0.1', resolve));
const repository = `http://127.0.0.1:${repo.address().port}`;
const directory = await mkdtemp(join(tmpdir(), 'gtfs-client-native-'));
const literal = value => `'${value.replaceAll("'", "''")}'`;
async function adapter(name, unsigned) {
  const home = join(directory, name);
  const cache = join(home, 'extensions');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(home, { recursive: true });
  let loaded = false;
  return {
    cache,
    async query(sql) {
      const args = [...(unsigned ? ['-unsigned'] : []), '-json', '-cmd', `SET home_directory=${literal(home)}; SET extension_directory=${literal(cache)}`];
      if (loaded && sql !== 'LOAD gtfs_duck_tools') args.push('-cmd', 'LOAD gtfs_duck_tools');
      const result = await exec(binary, [...args, join(home, 'data.duckdb'), '-c', sql], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
      if (sql === 'LOAD gtfs_duck_tools') loaded = true;
      return result.stdout.trim() ? JSON.parse(result.stdout) : [];
    },
  };
}
try {
  const db = await adapter('unsigned-development', true);
  const client = createExtensionClient(db, { repository });
  await client.install();
  await client.load();
  assert.deepEqual(await db.query('SELECT count(*) AS n FROM information_schema.tables'), [{ n: 0 }]);
  await client.prepare();
  await db.query(fixture);
  await client.init();
  assert.deepEqual(await db.query("SELECT path_description, hop_count FROM find_shortest_path('S', 'E', 'Q')"), [{ path_description: 'E -> P -> Q', hop_count: 2 }]);
  await db.query("INSERT INTO EditStopTable (row_id, stop_id, stop_name, stop_lat, stop_lon, location_type_name, parent_station, level_id, wheelchair_status, status) VALUES ('1', 'S', 'Renamed Station', 35.0, 139.0, 'Station', '', '', '🔵', 'edit')");
  await client.refresh();
  await client.refresh();
  assert.deepEqual(await db.query("SELECT stop_name, (SELECT count(*) FROM EditStopTable) AS pending FROM StationsTable WHERE stop_id='S'"), [{ stop_name: 'Renamed Station', pending: 1 }]);
  assert.ok((await readdir(db.cache, { recursive: true })).some(name => name.endsWith('gtfs_duck_tools.duckdb_extension')));
  const strict = createExtensionClient(await adapter('signed-default', false), { repository });
  let rejection;
  try { await strict.install(); await strict.load(); } catch (error) { rejection = error; }
  assert.ok(rejection, 'Unsigned downloaded artifact must be rejected with default policy');
  assert.match(String(rejection.cause), /unsigned|signature/i);
  const unavailable = createExtensionClient(await adapter('missing-repository', false), { repository: `${repository}/missing` });
  await assert.rejects(unavailable.install(), error => {
    assert.match(String(error.cause), /404|download|HTTP/i);
    assert.match(error.message, /repository reachability/);
    return true;
  });
  assert.ok(requests.filter(path => path === `/${version}/${platform}/gtfs_duck_tools.duckdb_extension.gz`).length >= 2);
  console.log(JSON.stringify({ status: 'PASS', version, platform, lifecycle: 'prepare/init/path/refresh/edit-preservation', signedDefaultRejection: rejection.message, downloadFailure: '404 surfaced with cause', requests }));
} finally {
  await new Promise(resolve => { repo.close(resolve); repo.closeAllConnections(); });
  await rm(directory, { recursive: true, force: true });
}
