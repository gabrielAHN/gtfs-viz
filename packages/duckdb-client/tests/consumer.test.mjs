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

test('downloaded ingestion installs and loads before the extension import without embedded macros', async () => {
  const queries = [];
  await importGtfs(async sql => queries.push(sql), { ...allFiles, directory: "it's here", extensionRepository: 'https://example.test/ext' });
  assert.deepEqual(queries, ["INSTALL gtfs FROM 'https://example.test/ext'", 'LOAD gtfs', "PRAGMA gtfs_import('it''s here')"]);
  assert.equal(queries.some(sql => /CREATE\s+(OR REPLACE\s+)?MACRO/i.test(sql)), false);
});
