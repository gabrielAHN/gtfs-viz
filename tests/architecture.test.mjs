import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', '.hermes', '.local'].includes(entry.name)) return [];
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
test('consumers and built artifacts contain no database toolbox implementation', () => {
  const candidates = files(resolve(root, 'packages')).concat(existsSync(resolve(root, 'dist')) ? files(resolve(root, 'dist')) : []);
  const violations = candidates.filter(path => {
    if (/\/tests?\//.test(path) || !/\.(ts|tsx|js|mjs|sql|hpp|cpp|h|c|cmake)$/.test(path)) return false;
    return /CREATE\s+(?:OR\s+REPLACE\s+)?MACRO\s+\w+|GTFS_(?:LOAD|INIT|REROUTE)_SQL|stops_with_casts|pathways_with_casts|routes_with_casts|CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:RouteShape\w+|calendar(?:_dates)?|StopsView|PathwaysView|pathway_network)\s*\(/.test(readFileSync(path, 'utf8'));
  });
  assert.deepEqual(violations.map(path => relative(root, path)), []);
  assert.equal(existsSync(resolve(root, 'packages/duckdb-extension')), false);
  for (const path of ['extensions', 'duckdb', 'extension-ci-tools', 'CMakeLists.txt', 'extension_config.cmake', 'packages/cli/skills/gtfs-viz/references/procedures.md']) assert.equal(existsSync(resolve(root, path)), false, path);
  assert.equal(existsSync(resolve(root, 'packages/duckdb-client/dist/sql.js')), false);
  assert.equal(existsSync(resolve(root, 'packages/web/public/extensions/gtfs.sql')), false);
});
