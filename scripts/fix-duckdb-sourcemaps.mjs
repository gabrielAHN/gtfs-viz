#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workerFiles = [
  'node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js',
  'node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js',
  'node_modules/@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs',
  'node_modules/@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs',
];

let fixed = 0;
workerFiles.forEach((relativePath) => {
  const workerPath = join(__dirname, '..', relativePath);

  try {
    if (existsSync(workerPath)) {
      let content = readFileSync(workerPath, 'utf8');
      const original = content;
      content = content.replace(/\/\/# sourceMappingURL=.*\.map.*$/gm, '');

      if (content !== original) {
        writeFileSync(workerPath, content, 'utf8');
        fixed++;
      }
    }
  } catch (err) {
    // Silently ignore errors
  }
});

if (fixed > 0) {
  console.log(`✓ Removed sourcemap references from ${fixed} DuckDB worker file(s)`);
}
