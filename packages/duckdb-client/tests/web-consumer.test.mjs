import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

async function adapter(repository = 'https://example.test/ext', entry = 'packages/web/src/lib/extensions.ts') {
  const result = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', write: false, define: { 'import.meta.env.VITE_GTFS_EXTENSION_REPOSITORY': JSON.stringify(repository), 'import.meta.env.DEV': 'false' }, alias: { '@': new URL('../../web/src', import.meta.url).pathname } });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}#${Math.random()}`);
}

test('browser adapter loads on reopening and refreshes edits without embedded SQL', async () => {
  const api = await adapter();
  const queries = [];
  const conn = { query: async sql => { queries.push(sql); return { toArray: () => [{ n: 1 }] }; } };
  await api.reinstallMacros(conn);
  await api.recreateStopsView(conn);
  assert.ok(queries.includes("INSTALL gtfs FROM 'https://example.test/ext'"));
  assert.ok(queries.indexOf('LOAD gtfs') < queries.indexOf('PRAGMA gtfs_refresh'));
  assert.equal(queries.some(sql => /CREATE\s+(OR REPLACE\s+)?MACRO/i.test(sql)), false);
  const second = { query: conn.query };
  await api.refreshRoutesTables(second);
  assert.equal(queries.filter(sql => sql === 'LOAD gtfs').length, 2);
});

test('reopening only loads the extension and never rebuilds a partially persisted dataset', async () => {
  const api = await adapter();
  const queries = [];
  const conn = { query: async sql => { queries.push(sql); if (sql === 'PRAGMA gtfs_refresh') throw new Error('Table with name shapes does not exist'); return { toArray: () => [{ n: 1 }] }; } };
  await api.reinstallMacros(conn);
  assert.deepEqual(queries, ["INSTALL gtfs FROM 'https://example.test/ext'", 'LOAD gtfs']);
});

test('rerouting does not execute embedded macro definitions in downloaded mode', async () => {
  const api = await adapter('https://example.test/ext', 'packages/web/src/lib/duckdb/DataEditing/rerouteTrip.ts');
  const queries = [];
  await api.fetchTripRerouteRoutes({ query: async sql => { queries.push(sql); return { toArray: () => [] }; } }, 'T');
  assert.equal(queries.some(sql => /CREATE\s+(OR REPLACE\s+)?MACRO/i.test(sql)), false);
});

test('materialized-table edits use extension refresh and propagate failures', async () => {
  const api = await adapter('https://example.test/ext', 'packages/web/src/lib/duckdb/DataEditing/insertData.tsx');
  const queries = [];
  const conn = { query: async sql => { queries.push(sql); } };
  await api.refreshMaterializedTable(conn, 'TripsTable');
  assert.ok(queries.includes('PRAGMA gtfs_refresh'));
  const cause = new Error('refresh failed');
  await assert.rejects(api.refreshMaterializedTable({ query: async () => { throw cause; } }, 'TripsTable'), error => error.cause === cause);
});

test('configured browser failure is surfaced, never swallowed by reload helpers', async () => {
  const api = await adapter();
  const cause = new Error('unsigned artifact');
  await assert.rejects(api.reloadQueryMacros({ query: async () => { throw cause; } }), error => error.cause === cause);
});
