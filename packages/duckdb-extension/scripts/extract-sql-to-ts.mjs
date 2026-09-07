#!/usr/bin/env node
/**
 * Extracts SQL strings from gtfs_sql.hpp and generates a TypeScript module.
 * Single source of truth: the C++ header file.
 * Handles split raw strings (adjacent R"SQL(...)SQL" literals for MSVC).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const hppPath = resolve(root, "src/include/gtfs_sql.hpp");
const outDir = resolve(root, "dist");
const outPath = resolve(outDir, "sql.js");
const dtsPath = resolve(outDir, "sql.d.ts");

const hpp = readFileSync(hppPath, "utf8");

function extractRawString(content, varName) {
  // Match the variable assignment, then collect all adjacent R"SQL(...)SQL" blocks
  const startPattern = new RegExp(`${varName}\\s*=\\s*R"SQL\\(`);
  const startMatch = content.match(startPattern);
  if (!startMatch) throw new Error(`Could not find ${varName} in hpp`);

  const startIdx = startMatch.index + startMatch[0].length;
  let result = "";
  let pos = startIdx;

  while (pos < content.length) {
    const endIdx = content.indexOf(')SQL"', pos);
    if (endIdx === -1) throw new Error(`Unterminated R"SQL( for ${varName}`);
    result += content.slice(pos, endIdx);
    pos = endIdx + 5; // skip )SQL"

    // Check if another R"SQL( follows (continuation for MSVC split)
    const nextRaw = content.indexOf('R"SQL(', pos);
    const nextSemicolon = content.indexOf(";", pos);
    if (nextRaw !== -1 && (nextSemicolon === -1 || nextRaw < nextSemicolon)) {
      pos = nextRaw + 6;
    } else {
      break;
    }
  }

  return result;
}

const loadSql = extractRawString(hpp, "GTFS_LOAD_SQL");
const initSql = extractRawString(hpp, "GTFS_INIT_SQL");
const rerouteSql = extractRawString(hpp, "GTFS_REROUTE_SQL");

function splitStatements(sql) {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      return s.split("\n").some((l) => {
        const t = l.trim();
        return t.length > 0 && !t.startsWith("--");
      });
    });
}
const SQL_KEYWORDS =
  /^(CREATE|ALTER|DROP|SET|INSTALL|LOAD|INSERT|UPDATE|DELETE|PRAGMA|BEGIN|COMMIT|WITH|SELECT|CALL|ATTACH|DETACH|USE|COPY|EXPORT|CHECKPOINT)\b/i;
const badFragments = [];
for (const [name, sql] of [
  ["GTFS_LOAD_SQL", loadSql],
  ["GTFS_INIT_SQL", initSql],
  ["GTFS_REROUTE_SQL", rerouteSql],
]) {
  for (const stmt of splitStatements(sql)) {
    const firstCode = stmt.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("--")) ?? "";
    if (!SQL_KEYWORDS.test(firstCode)) {
      badFragments.push(`  [${name}] fragment starts with: ${firstCode.slice(0, 80)}`);
    }
  }
}
if (badFragments.length > 0) {
  console.error(
    "\n❌ SQL split integrity check FAILED — a statement fragment does not start with a\n" +
      "SQL keyword. This is almost always a ';' inside a '--' comment breaking a statement.\n" +
      "Remove the semicolon from the offending comment.\n\n" +
      badFragments.join("\n") +
      "\n",
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

writeFileSync(
  outPath,
  `// Auto-generated from src/include/gtfs_sql.hpp — do not edit
export const GTFS_LOAD_SQL = ${JSON.stringify(loadSql)};
export const GTFS_INIT_SQL = ${JSON.stringify(initSql)};
export const GTFS_REROUTE_SQL = ${JSON.stringify(rerouteSql)};
`,
);

writeFileSync(
  dtsPath,
  `// Auto-generated from src/include/gtfs_sql.hpp — do not edit
export declare const GTFS_LOAD_SQL: string;
export declare const GTFS_INIT_SQL: string;
export declare const GTFS_REROUTE_SQL: string;
`,
);

console.log("Generated dist/sql.js + dist/sql.d.ts from gtfs_sql.hpp");
