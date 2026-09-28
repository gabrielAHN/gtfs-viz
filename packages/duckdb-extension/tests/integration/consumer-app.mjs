import assert from 'node:assert/strict';
import { createServer as httpServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import JSZip from 'jszip';
const legacy = process.argv.includes('--legacy');

const root = resolve(import.meta.dirname, '../../../..');
const requests = [];
const repo = httpServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  requests.push(req.url);
  const match = /^\/v1\.4\.3\/wasm_(eh|mvp)\/gtfs_duck_tools\.duckdb_extension\.wasm$/.exec(req.url);
  if (!match) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', 'application/wasm');
  res.end(await readFile(resolve(root, `../gtfs-duck-tools/build/wasm_${match[1]}/extension/gtfs_duck_tools/gtfs_duck_tools.duckdb_extension.wasm`)));
});
await new Promise(resolve => repo.listen(0, '127.0.0.1', resolve));
if (legacy) delete process.env.VITE_GTFS_EXTENSION_REPOSITORY;
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
  if (legacy) {
    const zip = new JSZip();
    zip.file('stops.txt', 'stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station\nS,Legacy Fixture Station,35,139,1,\nP,Platform,35.001,139,0,S\n');
    await page.locator('input[type=file]').setInputFiles({ name: 'fixture.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
    await page.waitForFunction(() => sessionStorage.getItem('gtfs_data_initialized') === 'true', { timeout: 60000 });
    await page.goto(`http://127.0.0.1:${port}/stations/table`);
    await page.getByText('Legacy Fixture Station', { exact: true }).first().waitFor({ timeout: 60000 });
    assert.equal(requests.length, 0);
  } else {
    const alert = page.getByRole('alert').filter({ hasText: 'gtfs_duck_tools' });
    await alert.waitFor({ timeout: 60000 });
    assert.match(await alert.textContent(), /signature|unsigned/i);
    assert.ok(requests.some(path => path.includes('gtfs_duck_tools')));
  }
  const out = resolve(root, '.hermes/plans');
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: resolve(out, legacy ? 'consumer-app-legacy.png' : 'consumer-app-policy.png'), fullPage: true });
  console.log(JSON.stringify({ status: 'PASS', scope: legacy ? 'live unconfigured Vite app, ZIP UI import, station table, default legacy path' : 'live Vite app, production signature policy, visible startup failure', requests, errors }));
} finally {
  await browser?.close();
  await server.close();
  await new Promise(resolve => { repo.close(resolve); repo.closeAllConnections(); });
}
