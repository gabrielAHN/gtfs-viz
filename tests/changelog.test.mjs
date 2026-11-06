import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

// GTFS Viz has no versions: CHANGELOG sections are dates. Every section uses the same categories as
// gtfs-tools' CHANGELOG (Added, Changed, Removed, Fixed, Security, in that order) with bullet items only.
const CATEGORIES = ["Added", "Changed", "Removed", "Fixed", "Security"]
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8")

const sections = () => {
  const out = []
  for (const line of changelog.split("\n")) {
    if (line.startsWith("## ")) {
      const match = /^## (\d{4}-\d{2}-\d{2})$/.exec(line)
      assert.ok(match, `"${line}" is not a "## YYYY-MM-DD" section`)
      out.push({ date: match[1], lines: [] })
    } else if (out.length) out.at(-1).lines.push(line)
  }
  return out
}

test("CHANGELOG sections are unique dates, newest first", () => {
  const dates = sections().map(({ date }) => date)
  assert.ok(dates.length > 10)
  for (let i = 1; i < dates.length; i++) assert.ok(dates[i - 1] > dates[i], `${dates[i - 1]} before ${dates[i]}`)
})

test("every CHANGELOG section uses the shared categories, in order, with bullet items only", () => {
  for (const { date, lines } of sections()) {
    const headings = lines.filter((line) => line.startsWith("#"))
    assert.ok(headings.length > 0, `${date} has categories`)
    for (const heading of headings)
      assert.ok(heading.startsWith("### ") && CATEGORIES.includes(heading.slice(4)), `${date}: "${heading}"`)
    const names = headings.map((heading) => heading.slice(4))
    assert.deepEqual(names, CATEGORIES.filter((name) => names.includes(name)), `${date} lists its categories in order`)
    let current
    for (const line of lines) {
      if (line.startsWith("### ")) {
        current = line
        continue
      }
      if (!line.trim()) continue
      assert.ok(current, `${date}: text before its first category: "${line}"`)
      assert.match(line, /^- \S/, `${date} ${current}: "${line}" is not a bullet item`)
    }
  }
})
