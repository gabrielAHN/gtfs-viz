#!/usr/bin/env node
/**
 * Bundles the CLI into a single dist/index.js using esbuild.
 * Inlines all @gtfs-viz/* imports so the published package has zero npm dependencies.
 *
 * tsc outputs to .tsc-out/, this script bundles into dist/index.js.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { mkdir } from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const external = builtinModules.flatMap((m) => [m, `node:${m}`]);

await mkdir(path.join(root, "dist"), { recursive: true });

await build({
  entryPoints: [path.join(root, ".tsc-out", "index.js")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: path.join(root, "dist", "index.js"),
  banner: { js: "#!/usr/bin/env node" },
  external,
});

console.log("Bundled CLI into dist/index.js (self-contained)");
