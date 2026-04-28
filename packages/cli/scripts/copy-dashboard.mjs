import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const webDist = path.join(repoRoot, "packages", "web", "dist");
const legacyDist = path.join(repoRoot, "dist");
const source = await stat(path.join(webDist, "index.html")).catch(() => null)
  ? webDist
  : legacyDist;
const target = path.join(packageRoot, "dashboard");

const sourceStat = await stat(path.join(source, "index.html")).catch(() => null);

if (!sourceStat?.isFile()) {
  throw new Error("Dashboard build not found. Run yarn build:app before building the CLI package.");
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

const cleanDashboard = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.name === ".DS_Store") {
        await rm(entryPath, { force: true });
      } else if (entry.name.endsWith(".map")) {
        // Strip sourcemaps — saves ~8MB in published package
        await rm(entryPath, { force: true });
      } else if (entry.isDirectory()) {
        await cleanDashboard(entryPath);
      }
    }),
  );
};

await cleanDashboard(target);
