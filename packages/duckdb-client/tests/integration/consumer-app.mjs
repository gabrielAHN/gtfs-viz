import assert from 'node:assert/strict';
import { createServer as httpServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { tmpdir } from 'node:os';
const missingConfig = process.argv.includes('--missing-config');

const root = resolve(import.meta.dirname, '../../../..');
const staged = process.env.GTFS_STAGED_REPOSITORY;
if (!missingConfig) assert.ok(staged, 'GTFS_STAGED_REPOSITORY must point to a staged gtfs extension repository directory');
const requests = [];
const repo = httpServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  requests.push(req.url);
  const match = /^\/v1\.4\.3\/wasm_(eh|mvp)\/gtfs\.duckdb_extension\.wasm$/.exec(req.url);
  if (!match) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', 'application/wasm');
  res.end(await readFile(resolve(staged, `v1.4.3/wasm_${match[1]}/gtfs.duckdb_extension.wasm`)));
});
await new Promise(resolve => repo.listen(0, '127.0.0.1', resolve));
if (missingConfig) delete process.env.VITE_GTFS_EXTENSION_REPOSITORY;
else process.env.VITE_GTFS_EXTENSION_REPOSITORY = `http://127.0.0.1:${repo.address().port}`;
process.chdir(resolve(root, 'packages/web'));
const server = await createServer({ configFile: resolve(root, 'packages/web/vite.config.ts'), server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}`);
  if (missingConfig) {
    const alert = page.getByRole('alert').filter({ hasText: 'gtfs' });
    await alert.waitFor({ timeout: 60000 });
    assert.match(await alert.textContent(), /VITE_GTFS_EXTENSION_REPOSITORY/);
    assert.equal(requests.length, 0);
  } else {
    const alert = page.getByRole('alert').filter({ hasText: 'gtfs' });
    await alert.waitFor({ timeout: 60000 });
    assert.match(await alert.textContent(), /signature|unsigned/i);
    assert.ok(requests.some(path => path.includes('gtfs')));
  }
  const out = await mkdtemp(resolve(tmpdir(), 'gtfs-consumer-app-'));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(out, missingConfig ? 'consumer-app-missing-config.png' : 'consumer-app-policy.png'), fullPage: true });
  console.log(JSON.stringify({ status: 'PASS', scope: missingConfig ? 'live Vite app, missing repository, actionable visible error, no fallback' : 'live Vite app, production signature policy, visible startup failure', requests, errors }));
} finally {
  await browser?.close();
  await server.close();
  await new Promise(resolve => { repo.close(resolve); repo.closeAllConnections(); });
}
