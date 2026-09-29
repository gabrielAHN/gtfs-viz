import {
  docsBase,
  githubRelease,
  goals,
  intro,
  pageFile,
  pagePath,
  parts,
  pullRequest,
  releaseFile,
  releasePath,
  releases,
  releasesFor,
  repos,
  versionLabel,
} from "./content"
import type { Block, DocPage, Part, Release } from "./content"
import { functionCategories, functions } from "./functions"
import type { GtfsFunction } from "./functions"

export { docsBase }

const fence = (code: string, lang = "") => ["```" + lang, code, "```"]

function blockMarkdown(block: Block): string[] {
  switch (block.type) {
    case "text":
      return [block.text, ""]
    case "list":
      return [...block.items.map((item) => `- ${item}`), ""]
    case "code":
      return [...fence(block.code, block.lang), ""]
    case "steps":
      return block.items.flatMap((step, index) => [
        `${index + 1}. **${step.title}**${step.body ? ` ${step.body}` : ""}`,
        ...(step.code ? ["", ...fence(step.code, step.lang).map((line) => `   ${line}`)] : []),
        "",
      ])
    case "cards":
      return [
        ...block.items.map((card) =>
          card.href
            ? `- [${card.title}](${card.href}): ${card.body}`
            : `- **${card.title}:** ${card.body}`,
        ),
        "",
      ]
    case "table":
      return [
        `| ${block.head.join(" | ")} |`,
        `| ${block.head.map(() => "---").join(" | ")} |`,
        ...block.rows.map((row) => `| ${row.join(" | ")} |`),
        "",
      ]
  }
}

export function functionMarkdown(fn: GtfsFunction) {
  return [
    `### ${fn.name}`,
    "",
    `\`${fn.signature}\` (${fn.kind})`,
    "",
    fn.description,
    "",
    ...fence(fn.example, "sql"),
    "",
    ...(fn.kind === "table"
      ? [`Returns: ${fn.returns.map((column) => `\`${column}\``).join(", ")}`, ""]
      : []),
    ...(fn.kind === "scalar" ? [`Example result: \`${fn.returns[0]}\``, ""] : []),
    ...(fn.note ? [`Note: ${fn.note}`, ""] : []),
  ]
}

function functionsMarkdown() {
  return functionCategories.flatMap((category) => [
    `## ${category.title}`,
    "",
    category.body,
    "",
    ...functions.filter((fn) => fn.category === category.id).flatMap(functionMarkdown),
  ])
}

export function pageMarkdown(part: Part, page: DocPage) {
  const body =
    page.slug === "functions"
      ? functionsMarkdown()
      : page.sections.flatMap((section) => [
          `## ${section.title}`,
          "",
          ...section.blocks.flatMap(blockMarkdown),
        ])
  return [
    `# ${part.name}: ${page.title}`,
    "",
    page.summary,
    "",
    `Page: ${pagePath(part.id, page.slug)}`,
    "",
    ...body,
  ].join("\n")
}

export function releaseMarkdown(release: Release) {
  const part = parts.find((item) => item.id === release.repo)!
  const pr = pullRequest(release)
  const tag = githubRelease(release)
  return [
    `# ${part.name} ${versionLabel(release)}: ${release.title}`,
    "",
    `- Repository: ${part.repo}`,
    `- Date: ${release.date}`,
    `- Status: ${release.status}`,
    ...(pr ? [`- Build: [${pr.label}](${pr.href})`] : []),
    ...(tag ? [`- GitHub release: ${tag}`] : []),
    `- Page: ${releasePath(release)}`,
    "",
    "## Highlights",
    "",
    ...release.highlights.map((item) => `- **${item.area}:** ${item.text}`),
    "",
  ].join("\n")
}

export function releasesMarkdown(part: Part) {
  return [
    `# ${part.name} releases`,
    "",
    "Each release has its own page.",
    "",
    ...releasesFor(part.id).map(
      (release) =>
        `- [${versionLabel(release)}: ${release.title}](${docsBase}${releaseFile(release)}) (${release.date}, ${release.status})`,
    ),
    "",
  ].join("\n")
}

const pageLinks = (part: Part) => [
  ...part.pages.map(
    (page) => `- [${page.title}](${docsBase}${pageFile(part.id, page.slug)}): ${page.summary}`,
  ),
  `- [Releases](${docsBase}${part.id}/releases.md): every release, each with its own file`,
]

export function partMarkdown(part: Part) {
  return [
    `# ${part.name}`,
    "",
    `${part.tagline}. Repository: ${part.repo}`,
    "",
    part.summary,
    "",
    "## Pages",
    "",
    ...pageLinks(part),
    "",
  ].join("\n")
}

export function overviewMarkdown() {
  return [
    "# GTFS Viz",
    "",
    intro,
    "",
    "## Goals",
    "",
    ...goals.map((goal) => `- **${goal.title}:** ${goal.body}`),
    "",
    ...parts.flatMap((part) => [
      `## ${part.name}`,
      "",
      `${part.tagline}. ${part.repo}`,
      "",
      ...pageLinks(part),
      "",
    ]),
    "## Links",
    "",
    `- Web app: ${repos.app}`,
    `- CLI on npm: ${repos.npm}`,
    "",
  ].join("\n")
}

export function llmsTxt() {
  return [
    "# GTFS Viz",
    "",
    `> ${intro}`,
    "",
    "## Docs",
    "",
    `- [Full docs](${docsBase}llms-full.txt): every page and release in one file`,
    `- [Overview](${docsBase}index.md): goals and parts`,
    "",
    ...parts.flatMap((part) => [`## ${part.name}`, "", ...pageLinks(part), ""]),
    "## Releases",
    "",
    ...releases.map(
      (release) =>
        `- [${parts.find((part) => part.id === release.repo)!.name} ${versionLabel(release)}](${docsBase}${releaseFile(release)}): ${release.title}`,
    ),
    "",
  ].join("\n")
}

export const fullMarkdown = () =>
  [
    overviewMarkdown(),
    ...parts.flatMap((part) => [
      ...part.pages.map((page) => pageMarkdown(part, page)),
      ...releasesFor(part.id).map(releaseMarkdown),
    ]),
  ].join("\n---\n\n")

export function markdownFiles(): Record<string, string> {
  return {
    "llms.txt": llmsTxt(),
    "llms-full.txt": fullMarkdown(),
    "index.md": overviewMarkdown(),
    ...Object.fromEntries(parts.map((part) => [`${part.id}.md`, partMarkdown(part)])),
    ...Object.fromEntries(parts.map((part) => [`${part.id}/releases.md`, releasesMarkdown(part)])),
    ...Object.fromEntries(
      parts.flatMap((part) =>
        part.pages.map((page) => [pageFile(part.id, page.slug), pageMarkdown(part, page)]),
      ),
    ),
    ...Object.fromEntries(
      releases.map((release) => [releaseFile(release), releaseMarkdown(release)]),
    ),
  }
}
