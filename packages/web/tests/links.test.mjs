import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { build } from "esbuild"

const PUBLIC_DOCS = "https://gtfs-viz-production-f1a4.up.railway.app/docs/"
const PUBLIC_CLI_DOCS = `${PUBLIC_DOCS}gtfs-tools/cli/`
// The gtfs-tools daemon serves this app as its dashboard and answers every page path with it.
const DAEMON_PAGE = "http://127.0.0.1:41234/stations?cliSession=s&cliApi=/__gtfs_viz/api"

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8")

const links = async (docsUrl) => {
  const result = await build({
    entryPoints: [new URL("../src/lib/links.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    define: {
      "import.meta.env.VITE_GTFS_DOCS_URL":
        docsUrl === undefined ? "undefined" : JSON.stringify(docsUrl),
    },
  })
  const code = Buffer.from(result.outputFiles[0].contents).toString("base64")
  return import(`data:text/javascript;base64,${code}#${Math.random()}`)
}

test("the dashboard build links the gtfs-tools CLI to the public docs, not the daemon", async () => {
  const { DOCS_URL, CLI_DOCS_URL } = await links(undefined)
  assert.equal(CLI_DOCS_URL, PUBLIC_CLI_DOCS)
  assert.equal(DOCS_URL, PUBLIC_DOCS)
  assert.equal(new URL(CLI_DOCS_URL, DAEMON_PAGE).href, PUBLIC_CLI_DOCS)
  assert.equal(new URL(DOCS_URL, DAEMON_PAGE).href, PUBLIC_DOCS)
})

test("only builds served next to the docs link relatively", async () => {
  const scripts = JSON.parse(read("../../../package.json")).scripts
  assert.match(scripts["build:deploy"], /VITE_GTFS_DOCS_URL=\$\{VITE_GTFS_DOCS_URL:-\/docs\/\} /)
  assert.match(scripts["build:dashboard"], /env (-u \S+ )*-u VITE_GTFS_DOCS_URL /)
  assert.match(read("../../../scripts/dev.mjs"), /VITE_GTFS_DOCS_URL/)
  assert.equal((await links("/docs/")).CLI_DOCS_URL, "/docs/gtfs-tools/cli/")
  assert.equal(
    (await links("https://docs.test/site")).CLI_DOCS_URL,
    "https://docs.test/site/gtfs-tools/cli/",
  )
})

test("the importer and the Docs button take their docs links from lib/links", () => {
  for (const rel of [
    "../src/client/Intro/FileImporter/index.tsx",
    "../src/components/contact.tsx",
  ]) {
    const source = read(rel)
    assert.match(source, /from "@\/lib\/links"/, rel)
    assert.doesNotMatch(source, /VITE_GTFS_DOCS_URL|["'`]\/docs\//, rel)
  }
})
