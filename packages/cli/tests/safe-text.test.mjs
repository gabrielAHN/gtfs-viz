// safeTerminalText: whole escape sequences are stripped, other controls and bidi or invisible
// formatting characters become U+FFFD, and newline, tab and ordinary text are kept.
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"

const load = async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gtfs-viz-safe-text-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const outfile = path.join(directory, "safe-text.mjs")
  await build({ entryPoints: [new URL("../src/output/safe-text.ts", import.meta.url).pathname], outfile, bundle: true, format: "esm", platform: "node" })
  return import(pathToFileURL(outfile).href)
}

test("safeTerminalText strips escape sequences and replaces controls and formatting characters", async (t) => {
  const { safeTerminalText } = await load(t)
  for (const [input, expected] of [
    ["HTTP 404 \u001b]0;TITLE\u0007\u001b[31mRED\u009b31m", "HTTP 404 RED"],
    ["a\u001b]8;;file:///x\u001b\\link\u001b]8;;\u001b\\b", "alinkb"],
    ["a\u009d0;TITLE\u009cb", "ab"],
    ["a\u001bPq#0;2;0;0;0\u001b\\b", "ab"],
    ["a\u001b[2Jb\u001bcc", "abc"],
    ["line one\r\noverwrite\u0008\u007f", "line one\ufffd\noverwrite\ufffd\ufffd"],
    ["tab\tnew\nline", "tab\tnew\nline"],
    ["evil\u202egpj.zip \u200b\u2066\u061c\ufeff", "evil\ufffdgpj.zip \ufffd\ufffd\ufffd\ufffd"],
    ["lone escape \u001b", "lone escape \ufffd"],
    ["café — v2 %E2%80%AE.zip", "café — v2 %E2%80%AE.zip"],
  ]) {
    assert.equal(safeTerminalText(input), expected, JSON.stringify(input))
  }
})
