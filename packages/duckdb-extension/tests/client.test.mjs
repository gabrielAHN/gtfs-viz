import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFile, mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function clientModule() {
  const result = await build({ entryPoints: ['packages/duckdb-extension/lib/client.ts'], bundle: true, format: 'esm', platform: 'neutral', write: false, metafile: true });
  assert.deepEqual(Object.keys(result.metafile.inputs), ['packages/duckdb-extension/lib/client.ts']);
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}

test('client is independent and explicit, with one query per lifecycle operation', async () => {
  const { createExtensionClient } = await clientModule();
  const queries = [];
  const client = createExtensionClient({ query: async sql => { queries.push(sql); } }, { repository: 'https://example.test/extensions' });
  assert.deepEqual(queries, []);
  for (const operation of ['install', 'load', 'prepare', 'init', 'refresh']) await client[operation]();
  assert.deepEqual(queries, ["INSTALL gtfs_duck_tools FROM 'https://example.test/extensions'", 'LOAD gtfs_duck_tools', 'PRAGMA gtfs_prepare', 'PRAGMA gtfs_init', 'PRAGMA gtfs_refresh']);
});

test('repository must be explicit, HTTP(S), unambiguous, and credential-free', async () => {
  const { createExtensionClient } = await clientModule();
  const queries = [];
  for (const repository of [undefined, '', 'community', 'file:///tmp/extensions', 'ftp://host/ext', ' https://host', 'https://host\n', 'https://u:p@host', 'https://host/ext?q=x', 'https://host/ext#hash', 'https://host/\\evil', 'https://']) {
    assert.throws(() => createExtensionClient({ query: async sql => queries.push(sql) }, { repository }), /repository/i, String(repository));
  }
  assert.deepEqual(queries, []);
});

test('repository literals are escaped and captured before caller mutation', async () => {
  const { createExtensionClient } = await clientModule();
  const queries = [];
  const options = { repository: "http://127.0.0.1:9000/o'hare" };
  const client = createExtensionClient({ query: async sql => queries.push(sql) }, options);
  options.repository = 'https://other.test';
  await client.install();
  assert.deepEqual(queries, ["INSTALL gtfs_duck_tools FROM 'http://127.0.0.1:9000/o''hare'"]);
});

test('failures retain causes and operation context without retries or SQL fallback', async () => {
  const { createExtensionClient } = await clientModule();
  for (const operation of ['install', 'load', 'prepare', 'init', 'refresh']) {
    const cause = new Error('engine failure sentinel');
    const queries = [];
    const client = createExtensionClient({ query: async sql => { queries.push(sql); throw cause; } }, { repository: 'https://example.test/ext' });
    await assert.rejects(client[operation](), error => {
      assert.equal(error.cause, cause);
      assert.match(error.message, new RegExp(operation));
      assert.match(error.message, /engine failure sentinel/);
      if (operation === 'install' || operation === 'load') assert.match(error.message, /version|ABI|signature/i);
      return true;
    });
    assert.equal(queries.length, 1);
  }
});

test('load completion awaits the executor and does not run pragmas implicitly', async () => {
  const { createExtensionClient } = await clientModule();
  let finish;
  const queries = [];
  const client = createExtensionClient({ query: sql => {
    queries.push(sql);
    return new Promise(resolve => { finish = resolve; });
  } }, { repository: 'https://example.test/ext' });
  let completed = false;
  const loading = client.load().then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.deepEqual(queries, ['LOAD gtfs_duck_tools']);
  finish();
  await loading;
  assert.equal(completed, true);
});

test('SQL-looking repository paths remain inside one escaped literal', async () => {
  const { createExtensionClient } = await clientModule();
  const queries = [];
  const client = createExtensionClient({ query: async sql => queries.push(sql) }, { repository: "https://example.test/';SELECT(1);--" });
  await client.install();
  assert.deepEqual(queries, ["INSTALL gtfs_duck_tools FROM 'https://example.test/'';SELECT(1);--'"]);
});

test('published client entry imports without embedded SQL or workspace dependencies', async () => {
  const base = 'packages/duckdb-extension';
  const pkg = JSON.parse(await readFile(`${base}/package.json`, 'utf8'));
  assert.equal(pkg.exports['./client']?.import, './dist/client.js');
  assert.equal(pkg.exports['./client']?.types, './dist/client.d.ts');
  const directory = await mkdtemp(join(tmpdir(), 'gtfs-client-boundary-'));
  try {
    await mkdir(join(directory, 'dist'));
    await cp(`${base}/package.json`, join(directory, 'package.json'));
    await cp(`${base}/dist/client.js`, join(directory, 'dist/client.js'));
    const client = await import(pathToFileURL(join(directory, 'dist/client.js')));
    assert.equal(typeof client.createExtensionClient, 'function');
    const bundle = await build({ stdin: { contents: "export * from '@gtfs-viz/duckdb-extension/client'", resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true });
    assert.deepEqual(Object.keys(bundle.metafile.inputs).filter(path => path !== '<stdin>'), ['packages/duckdb-extension/dist/client.js']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
