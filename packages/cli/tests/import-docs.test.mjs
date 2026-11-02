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

// An unencoded @ in an http(s) URL is refused (it may hide credentials, and some forms cannot be told
// apart from a host, port and path), so the docs and help give the %40 rule instead of an ambiguity note.
test("import docs and help tell users to percent-encode @ in http(s) paths as %40", async () => {
  for (const doc of [...DOCS, "../src/output/print.ts"]) {
    const text = (await readFile(new URL(doc, import.meta.url), "utf8")).replace(/\s+/g, " ")
    assert.match(text, /@[^.]{0,80}%40/, doc)
    assert.match(text, /never put (a user name or password|credentials) in (a|the) URL/i, doc)
    assert.doesNotMatch(text, /cannot be told apart/, doc)
  }
})
