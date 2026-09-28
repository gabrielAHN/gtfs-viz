import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const vizRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const root = resolve(process.env.GTFS_DUCK_TOOLS_ROOT || resolve(vizRoot, '../gtfs-duck-tools'));
const require = createRequire(resolve(vizRoot, 'package.json'));
const { chromium } = require('@playwright/test');
const wasmDist = dirname(require.resolve('@duckdb/duckdb-wasm/dist/duckdb-browser.mjs'));
const { build } = require('esbuild');
const browserModule = (await build({ entryPoints: [resolve(wasmDist, 'duckdb-browser.mjs')], bundle: true, format: 'esm', platform: 'browser', write: false })).outputFiles[0].contents;
const clientModule = (await build({ entryPoints: [resolve(vizRoot, 'packages/duckdb-extension/dist/client.js')], bundle: true, format: 'esm', platform: 'browser', write: false })).outputFiles[0].contents;
const requests = [];
const fixture = await readFile(resolve(root, 'test/fixtures/normalized.sql'), 'utf8');
const macroNames = (await Promise.all(['load', 'init', 'reroute'].map(name => readFile(resolve(root, `sql/${name}.sql`), 'utf8')))).flatMap(sql => [...sql.matchAll(/CREATE OR REPLACE MACRO\s+(\w+)/g)].map(match => match[1])).sort();
const baselineErrors = process.argv.includes('--baseline-errors');
const unsignedOnly = process.argv.includes('--unsigned-only');
const types = { wasm: 'application/wasm', js: 'text/javascript', mjs: 'text/javascript' };
const serveFile = async (res, path) => {
  const content = await readFile(path);
  res.writeHead(200, { 'Content-Type': types[path.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(content);
};
const app = createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://localhost').pathname;
    if (name === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><title>GTFS extension WASM verification</title><main>GTFS extension test harness</main>');
    } else if (name === '/client.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(clientModule);
    } else if (name === '/duckdb/duckdb-browser.mjs') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(browserModule);
    } else if (/^\/duckdb\/(duckdb-browser\.mjs|duckdb-browser-(eh|mvp)\.worker\.js|duckdb-(eh|mvp)\.wasm)$/.test(name)) {
      await serveFile(res, resolve(wasmDist, name.slice('/duckdb/'.length)));
    } else { res.writeHead(404); res.end(); }
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${app.address().port}`;
const repo = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', origin);
  requests.push(req.url);
  const match = /^\/(?:duckdb-wasm\/)?v1\.4\.3\/wasm_(eh|mvp)\/gtfs_duck_tools\.duckdb_extension\.wasm$/.exec(req.url);
  try {
    if (!match) { res.writeHead(404); res.end(); return; }
    await serveFile(res, resolve(root, `build/wasm_${match[1]}/extension/gtfs_duck_tools/gtfs_duck_tools.duckdb_extension.wasm`));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise(resolve => repo.listen(0, '127.0.0.1', resolve));
const repository = `http://127.0.0.1:${repo.address().port}`;
let browser;
const results = [];
const evaluateCase = async (page, fn, args) => {
  let stage = 'starting';
  let timer;
  page.on('console', message => {
    if (message.text().startsWith('GTFS_STAGE:')) stage = message.text().slice(11);
  });
  try {
    return await Promise.race([
      page.evaluate(fn, args),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${args.variant} unsigned=${args.allowUnsignedExtensions}: timed out during ${stage}`)), 60000);
      }),
    ]);
  } finally { clearTimeout(timer); }
};
try {
  browser = await chromium.launch({ headless: true });
  for (const variant of ['eh', 'mvp']) {
    for (const allowUnsignedExtensions of (baselineErrors ? [false] : unsignedOnly ? [true] : [true, false])) {
      const page = await browser.newPage();
      await page.goto(origin);
      const result = await evaluateCase(page, async ({ variant, allowUnsignedExtensions, repository, baselineErrors, fixture, macroNames }) => {
        const duckdb = await import('/duckdb/duckdb-browser.mjs');
        const worker = new Worker(`/duckdb/duckdb-browser-${variant}.worker.js`);
        const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
        try {
          console.log('GTFS_STAGE:instantiate');
          await db.instantiate(`${location.origin}/duckdb/duckdb-${variant}.wasm`);
          await db.open(allowUnsignedExtensions ? { allowUnsignedExtensions: true } : {});
          const conn = await db.connect();
          const { createExtensionClient } = await import('/client.js');
          const client = createExtensionClient(conn, { repository });
          const rows = async sql => (await conn.query(sql)).toArray().map(row => JSON.parse(JSON.stringify(row.toJSON(), (_, v) => typeof v === 'bigint' ? Number(v) : v)));
          const engine = await rows('SELECT version() AS version');
          const missingBeforeLoad = (await rows("SELECT count(*) AS n FROM duckdb_functions() WHERE function_name='route_type_to_name'"))[0].n === 0;
          if (baselineErrors) {
            let baselineError;
            try { await conn.query("SELECT error('gtfs_baseline_probe')"); } catch (error) { baselineError = String(error); }
            return { variant, engine, missingBeforeLoad, baselineError };
          }
          const started = performance.now();
          console.log('GTFS_STAGE:install');
          await client.install();
          console.log('GTFS_STAGE:load');
          try { await client.load(); }
          catch (error) { return { variant, allowUnsignedExtensions, engine, missingBeforeLoad, loadError: String(error), cause: String(error.cause) }; }
          const values = await rows("SELECT route_type_to_name(i) AS name FROM (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(11),(12),(99),(NULL)) t(i)");
          const tables = await rows('SELECT count(*) AS n FROM information_schema.tables');
          await conn.query('CREATE TABLE user_data AS SELECT 42 AS value');
          await client.load();
          const preserved = await rows('SELECT value, route_type_to_name(3) AS name FROM user_data');
          const registered = await rows(`SELECT function_name FROM duckdb_functions() WHERE database_name='system' AND function_name IN (${macroNames.map(name => `'${name}'`).join(',')}) ORDER BY function_name`);
          console.log('GTFS_STAGE:dataset lifecycle');
          await client.prepare();
          await conn.query(fixture);
          await client.init();
          const availability = await rows('SELECT * FROM get_gtfs_data_availability()');
          const path = await rows("SELECT path_description, hop_count FROM find_shortest_path('S', 'E', 'Q')");
          const afterMidnight = await rows("SELECT seconds_to_gtfs_time(gtfs_time_to_seconds('25:01:02')) AS t");
          await conn.query("INSERT INTO EditStopTable (row_id, stop_id, stop_name, stop_lat, stop_lon, location_type_name, parent_station, level_id, wheelchair_status, status) VALUES ('1', 'S', 'Renamed Station', 35.0, 139.0, 'Station', '', '', '🔵', 'edit')");
          await client.refresh();
          await client.refresh();
          const refreshed = await rows("SELECT stop_name, (SELECT count(*) FROM EditStopTable) AS pending FROM StationsTable WHERE stop_id='S'");
          await conn.close();
          const second = await db.connect();
          const newConnection = (await second.query('SELECT route_type_to_name(3) AS name')).toArray().map(row => row.toJSON());
          await second.close();
          return { variant, allowUnsignedExtensions, engine, missingBeforeLoad, values, tables, preserved, newConnection, registered, availability, path, afterMidnight, refreshed, elapsedMs: performance.now() - started };
        } finally { console.log('GTFS_STAGE:terminate'); await db.terminate(); worker.terminate(); }
      }, { variant, allowUnsignedExtensions, repository, baselineErrors, fixture, macroNames });
      results.push(result);
      console.log(JSON.stringify(result));
      assert.deepEqual(result.engine, [{ version: 'v1.4.3' }]);
      assert.equal(result.missingBeforeLoad, true);
      if (baselineErrors) {
        assert.match(result.baselineError || '', /gtfs_baseline_probe/);
      } else if (!allowUnsignedExtensions) {
        assert.match(result.cause || '', /unsigned|signature/i);
      } else {
        assert.equal(result.loadError, undefined);
        assert.deepEqual(result.values.map(row => row.name), ['Tram, Streetcar, Light rail', 'Subway, Metro', 'Rail', 'Bus', 'Ferry', 'Cable tram', 'Aerial lift', 'Funicular', 'Trolleybus', 'Monorail', 'Other', 'Other']);
        assert.deepEqual(result.tables, [{ n: 0 }]);
        assert.deepEqual(result.preserved, [{ value: 42, name: 'Bus' }]);
        assert.deepEqual(result.newConnection, [{ name: 'Bus' }]);
        assert.deepEqual(result.registered.map(row => row.function_name), macroNames);
        assert.deepEqual(result.availability, [{ stations: 1, stops: 1, pathways: 2, routes: 1, trips: 1, has_stations: true, has_stops: true, has_routes: true, has_trips: true }]);
        assert.deepEqual(result.path, [{ path_description: 'E -> P -> Q', hop_count: 2 }]);
        assert.deepEqual(result.afterMidnight, [{ t: '25:01:02' }]);
        assert.deepEqual(result.refreshed, [{ stop_name: 'Renamed Station', pending: 1 }]);
      }
      await page.close();
    }
  }
  if (!baselineErrors) for (const variant of ['eh', 'mvp']) assert.ok(requests.some(path => path.includes(`/wasm_${variant}/`)));
  console.log(JSON.stringify({ status: 'PASS', scope: baselineErrors ? 'baseline-errors' : unsignedOnly ? 'unsigned-development-only' : 'full', browser: browser.version(), cases: results.length, requests }));
} finally {
  await browser?.close();
  await Promise.all([app, repo].map(server => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  })));
}
