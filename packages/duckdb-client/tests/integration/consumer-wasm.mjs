import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const vizRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const staged = process.env.GTFS_STAGED_REPOSITORY;
assert.ok(staged || process.argv.includes('--baseline-errors'), 'GTFS_STAGED_REPOSITORY must point to a staged gtfs extension repository directory');
const require = createRequire(resolve(vizRoot, 'package.json'));
const { chromium } = require('@playwright/test');
const wasmDist = dirname(require.resolve('@duckdb/duckdb-wasm/dist/duckdb-browser.mjs'));
const { build } = require('esbuild');
const browserModule = (await build({ entryPoints: [resolve(wasmDist, 'duckdb-browser.mjs')], bundle: true, format: 'esm', platform: 'browser', write: false })).outputFiles[0].contents;
const clientModule = (await build({ stdin: { contents: `export * from './packages/web/src/lib/extensions.ts'; export { runIngestion } from './packages/web/src/lib/gtfs-ingestion/client.ts';`, resolveDir: vizRoot }, bundle: true, format: 'esm', platform: 'browser', write: false, alias: { '@': resolve(vizRoot, 'packages/web/src') }, define: { 'import.meta.env.VITE_GTFS_EXTENSION_REPOSITORY': 'globalThis.__GTFS_EXTENSION_REPOSITORY', 'import.meta.env.DEV': 'false' } })).outputFiles[0].contents;
const requests = [];
const macroNames = ['find_shortest_path', 'get_gtfs_data_availability', 'gtfs_time_to_seconds', 'route_type_to_name', 'seconds_to_gtfs_time'];
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
  const match = /^\/(?:duckdb-wasm\/)?v1\.4\.3\/wasm_(eh|mvp)\/gtfs\.duckdb_extension\.wasm$/.exec(req.url);
  try {
    if (!match) { res.writeHead(404); res.end(); return; }
    await serveFile(res, resolve(staged, `v1.4.3/wasm_${match[1]}/gtfs.duckdb_extension.wasm`));
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
      const result = await evaluateCase(page, async ({ variant, allowUnsignedExtensions, repository, baselineErrors, macroNames }) => {
        const duckdb = await import('/duckdb/duckdb-browser.mjs');
        const worker = new Worker(`/duckdb/duckdb-browser-${variant}.worker.js`);
        const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
        try {
          console.log('GTFS_STAGE:instantiate');
          await db.instantiate(`${location.origin}/duckdb/duckdb-${variant}.wasm`);
          await db.open(allowUnsignedExtensions ? { allowUnsignedExtensions: true } : {});
          const conn = await db.connect();
          globalThis.__GTFS_EXTENSION_REPOSITORY = repository;
          const api = await import('/client.js');
          const queries = [];
          const traced = { query: async sql => { queries.push(sql); return conn.query(sql); } };
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

          console.log('GTFS_STAGE:load');
          try { await api.downloaded(traced); }
          catch (error) { return { variant, allowUnsignedExtensions, engine, missingBeforeLoad, loadError: String(error), cause: String(error.cause) }; }
          const values = await rows("SELECT route_type_to_name(i) AS name FROM (VALUES (0),(1),(2),(3),(4),(5),(6),(7),(11),(12),(99),(NULL)) t(i)");
          const tables = await rows('SELECT count(*) AS n FROM information_schema.tables');
          await conn.query('CREATE TABLE user_data AS SELECT 42 AS value');
          await api.downloaded(traced);
          const preserved = await rows('SELECT value, route_type_to_name(3) AS name FROM user_data');
          const registered = await rows(`SELECT function_name FROM duckdb_functions() WHERE database_name='system' AND function_name IN (${macroNames.map(name => `'${name}'`).join(',')}) ORDER BY function_name`);
          console.log('GTFS_STAGE:dataset lifecycle');
          await conn.query('LOAD spatial');
          const files = {
            'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station\nS,Fixture Station,35,139,1,\nE,Entrance,35.0001,139,2,S\nP,Platform P,35.0002,139,0,S\nQ,Platform Q,35.0003,139,0,S\nO,Outside Stop,35.001,139.001,0,\n',
            'pathways.txt': 'pathway_id,from_stop_id,to_stop_id,pathway_mode,is_bidirectional,length,traversal_time\nEP,E,P,1,0,30,30\nPQ,P,Q,1,0,20,20\n',
            'routes.txt': 'route_id,route_short_name,route_long_name,route_type,route_color,route_text_color\nR,R,Fixture Route,3,112233,ffffff\n',
            'trips.txt': 'route_id,service_id,trip_id,shape_id\nR,WK,T,SH\n',
            'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,25:00:00,25:00:00,P,1\nT,25:10:00,25:10:00,Q,2\n',
            'shapes.txt': 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nSH,35.0002,139,1\nSH,35.0003,139,2\n',
            'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20260101,20261231\n',
            'calendar_dates.txt': 'service_id,date,exception_type\nWK,20260102,1\n',
          };
          for (const [name, csv] of Object.entries(files)) await db.registerFileBuffer(name, new TextEncoder().encode(csv));
          await api.runIngestion(traced, false, undefined, true, true, true, true, true, true, true);

          const availability = await rows('SELECT * FROM get_gtfs_data_availability()');
          const path = await rows("SELECT path_description, hop_count FROM find_shortest_path('S', 'E', 'Q')");
          const afterMidnight = await rows("SELECT seconds_to_gtfs_time(gtfs_time_to_seconds('25:01:02')) AS t");
          await conn.query("INSERT INTO EditStopTable (row_id, stop_id, stop_name, stop_lat, stop_lon, location_type_name, parent_station, level_id, wheelchair_status, status) VALUES ('1', 'S', 'Renamed Station', 35.0, 139.0, 'Station', '', '', '🔵', 'edit')");
          await api.recreateStopsView(traced);
          await api.recreateStopsView(traced);
          const refreshed = await rows("SELECT stop_name, (SELECT count(*) FROM EditStopTable) AS pending FROM StationsTable WHERE stop_id='S'");
          await conn.close();
          const second = await db.connect();
          await api.reinstallMacros(second);
          const newConnection = (await second.query('SELECT route_type_to_name(3) AS name')).toArray().map(row => row.toJSON());
          await second.close();
          return { variant, allowUnsignedExtensions, engine, missingBeforeLoad, values, tables, preserved, newConnection, registered, availability, path, afterMidnight, refreshed, embeddedMacros: queries.filter(sql => /CREATE\s+(OR REPLACE\s+)?MACRO/i.test(sql)), elapsedMs: performance.now() - started };
        } finally { console.log('GTFS_STAGE:terminate'); await db.terminate(); worker.terminate(); }
      }, { variant, allowUnsignedExtensions, repository, baselineErrors, macroNames });
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
        assert.deepEqual(result.embeddedMacros, []);
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
