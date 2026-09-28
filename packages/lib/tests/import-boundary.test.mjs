import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import ts from "typescript"

const root = fileURLToPath(new URL("../../..", import.meta.url))
const library = join(root, "packages/lib")

test("rendering package imports in isolation without DuckDB or SQL installation", () => {
  const manifestPath = join(library, "package.json")
  assert.ok(existsSync(manifestPath), "@gtfs-viz/lib must be a separate rendering package")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  assert.equal(manifest.name, "@gtfs-viz/lib")
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    assert.deepEqual(Object.keys(manifest[field] ?? {}), [], `${field}: rendering uses injected deck.gl dependencies`)
  }
  const config = ts.readConfigFile(join(library, "tsconfig.json"), ts.sys.readFile)
  assert.equal(config.error, undefined)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, library)
  assert.deepEqual(parsed.errors, [])
  for (const file of parsed.fileNames) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        assert.match(node.moduleSpecifier.text, /^\.\//, `${file}: external module dependency`)
      }
      if (ts.isCallExpression(node)) {
        assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, `${file}: dynamic import`)
        assert.notEqual(node.expression.getText(source), "require", `${file}: runtime require`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  const temporary = mkdtempSync(join(tmpdir(), "gtfs-render-import-"))
  try {
    const isolated = join(temporary, "node_modules/@gtfs-viz/lib")
    mkdirSync(isolated, { recursive: true })
    writeFileSync(join(isolated, "package.json"), JSON.stringify(manifest))
    execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", join(library, "tsconfig.json"), "--outDir", join(isolated, "dist")])
    const probe = `
      import assert from 'node:assert/strict';
      import * as rendering from '@gtfs-viz/lib';
      import * as deckgl from '@gtfs-viz/lib/deckgl';
      assert.deepEqual(Object.keys(rendering), Object.keys(deckgl));
      for (const name of ['createRouteShapeLayer', 'createFannedPathLayer', 'buildRouteShapePaths', 'encodeFanCode']) {
        assert.equal(typeof rendering[name], 'function', name);
      }
      assert.ok(!Object.keys(rendering).some(name => /sql|install|importGtfs|NamedQuery/i.test(name)));
      const paths = rendering.buildRouteShapePaths([{ route_id: 'A', lons: [0, 1], lats: [2, 3] }]);
      assert.deepEqual(Array.from(paths[0].path), [0, 2, 1, 3]);
      assert.equal(paths[0].fanCodes, null);
      assert.equal(rendering.routeShapeLayerProps({ id: 'test', data: paths, zoom: 15 })._pathType, 'open');
    `
    execFileSync(process.execPath, ["--input-type=module", "--eval", probe], { cwd: temporary })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})
