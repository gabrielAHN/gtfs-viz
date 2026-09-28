import assert from 'node:assert/strict';
import test from 'node:test';
import { importGtfs } from '../dist/index.js';

const allFiles = { stopsPath: 'stops.txt', pathwaysPath: 'pathways.txt', routesPath: 'routes.txt', tripsPath: 'trips.txt', stopTimesPath: 'stop_times.txt', shapesPath: 'shapes.txt', calendarPath: 'calendar.txt', calendarDatesPath: 'calendar_dates.txt' };

test('partial downloaded imports reject unsupported index skipping before any query', async () => {
  const queries = [];
  await assert.rejects(importGtfs(async sql => queries.push(sql), { stopsPath: 'stops.txt', extensionRepository: 'https://example.test/ext' }), /does not support skipping indexes/);
  assert.deepEqual(queries, []);
});

test('download failure never falls back to embedded SQL', async () => {
  const queries = [];
  const cause = new Error('signature rejected');
  await assert.rejects(importGtfs(async sql => { queries.push(sql); throw cause; }, { ...allFiles, extensionRepository: 'https://example.test/ext' }), error => error.cause === cause);
  assert.equal(queries.length, 1);
});

test('downloaded ingestion installs and loads before prepare/import/init without embedded macros', async () => {
  const queries = [];
  await importGtfs(async sql => queries.push(sql), { ...allFiles, extensionRepository: 'https://example.test/ext' });
  assert.deepEqual(queries.slice(0, 3), ["INSTALL gtfs_duck_tools FROM 'https://example.test/ext'", 'LOAD gtfs_duck_tools', 'PRAGMA gtfs_prepare']);
  assert.equal(queries.at(-1), 'PRAGMA gtfs_init');
  assert.equal(queries.some(sql => /CREATE\s+(OR REPLACE\s+)?MACRO/i.test(sql)), false);
});
