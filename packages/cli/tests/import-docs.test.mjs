// The import docs and help say exactly when a failed import keeps the current dataset: download and
// validation failures do; a failure during the DuckDB import itself clears it, as for local files.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const DOCS = ["../README.md", "../skills/gtfs-viz/SKILL.md", "../skills/gtfs-viz/references/commands.md"]

test("import docs say download and validation failures keep the dataset and DuckDB import failures clear it", async () => {
  for (const doc of DOCS) {
    const text = (await readFile(new URL(doc, import.meta.url), "utf8")).replace(/\s+/g, " ")
    assert.match(text, /download and validation failures \(not a zip, no `stops\.txt`\) leave the current dataset untouched/i, doc)
    assert.match(text, /a failure during the DuckDB import itself still clears it, as for local files/, doc)
    assert.doesNotMatch(text, /; failures leave the current dataset untouched/, doc)
  }
})
