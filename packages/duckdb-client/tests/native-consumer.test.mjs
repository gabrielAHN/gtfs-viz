import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

async function moduleAt(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}#${Math.random()}`);
}

test('persisted repository controls import planning without an environment variable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gtfs-plan-'));
  try {
    const db = join(dir, 'data.duckdb');
    await writeFile(db + '.extension.json', JSON.stringify({ repository: 'https://example.test/ext' }));
    const { buildImportSteps } = await moduleAt('packages/cli/src/duckdb/import-sql.ts');
    const steps = await buildImportSteps({ databasePath: db, directory: dir });
    assert.ok(steps.includes(`PRAGMA gtfs_import('${dir}');`));
    assert.equal(/CREATE\s+(OR REPLACE\s+)?MACRO/i.test(steps.join(' ')), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('native startup submits separate install and load commands for every subprocess', async () => {
  process.env.GTFS_EXTENSION_REPOSITORY = 'https://example.test/ext';
  try {
    const runner = await moduleAt('packages/cli/src/duckdb/runner.ts');
    assert.equal(typeof runner.extensionStartupArgs, 'function');
    assert.deepEqual(await runner.extensionStartupArgs('/nonexistent/test.duckdb'), ['-cmd', "INSTALL gtfs FROM 'https://example.test/ext'", '-cmd', 'LOAD gtfs']);
  } finally { delete process.env.GTFS_EXTENSION_REPOSITORY; }
});

test('native downloaded import plan runs the extension import and no embedded macro definitions', async () => {
  process.env.GTFS_EXTENSION_REPOSITORY = 'https://example.test/ext';
  try {
    const { buildImportSql } = await moduleAt('packages/cli/src/duckdb/import-sql.ts');
    const sql = await buildImportSql({ databasePath: '/test/data.duckdb', directory: '/test' });
    assert.ok(sql.includes("PRAGMA gtfs_import('/test');"));
    assert.ok(sql.includes('PRAGMA gtfs_add_geometry'));
    assert.equal(/CREATE\s+(OR REPLACE\s+)?MACRO/i.test(sql), false);
  } finally { delete process.env.GTFS_EXTENSION_REPOSITORY; }
});
