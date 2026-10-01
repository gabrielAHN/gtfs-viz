import {
  agentFile,
  agentPage,
  agentPath,
  upcoming,
  upcomingFile,
  upcomingPath,
  docsBase,
  functionsPath,
  githubRelease,
  groupFile,
  goals,
  intro,
  pageFile,
  pagePath,
  partFile,
  partPath,
  parts,
  pullRequest,
  releaseFile,
  releasePath,
  releases,
  releasesFor,
  repos,
  versionLabel,
} from "./content"
import type { Block, DocPage, Part, Release, Section } from "./content"
import { functionGroups, functions, internalCount } from "./functions"
import type { FunctionGroup, GtfsFunction } from "./functions"

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
        ...(step.code
          ? [
              "",
              ...fence(step.code, step.lang).flatMap((line) =>
                line.split("\n").map((row) => `   ${row}`),
              ),
            ]
          : []),
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
    `#### ${fn.name}`,
    "",
    `\`${fn.signature}\` (${fn.kind}${fn.usedByViz ? ", used by GTFS Viz" : ""})`,
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
  return [
    "## Groups",
    "",
    ...functionGroups.map(
      (group) =>
        `- [${group.title}](${docsBase}${groupFile(group.id)}): ${group.body} (${functions.filter((fn) => fn.group === group.id).length} functions)`,
    ),
    "",
    `${internalCount} more functions are internal (caches, map bounds and filter menus for GTFS Viz's maps, and helpers behind other functions) and are not covered here.`,
    "",
  ]
}

export function groupMarkdown(group: FunctionGroup) {
  const list = functions.filter((fn) => fn.group === group.id)
  const multiple = group.categories.length > 1
  return [
    `# GTFS DuckDB functions: ${group.title}`,
    "",
    group.body,
    "",
    `Page: ${functionsPath(group.id)}`,
    "",
    ...group.categories.flatMap((category) => [
      ...(multiple ? [`## ${category.title}`, "", category.body, ""] : []),
      ...list.filter((fn) => fn.category === category.id).flatMap(functionMarkdown),
    ]),
  ].join("\n")
}

const sectionMarkdown = (section: Section, depth: number): string[] => [
  `${"#".repeat(depth)} ${section.title}`,
  "",
  ...section.blocks.flatMap(blockMarkdown),
  ...(section.sub ?? []).flatMap((child) => sectionMarkdown(child, depth + 1)),
]

const sectionsMarkdown = (page: DocPage) =>
  page.sections.flatMap((section) => sectionMarkdown(section, 2))

export function pageMarkdown(part: Part, page: DocPage) {
  return [
    `# ${part.name}: ${page.title}`,
    "",
    page.summary,
    "",
    `Page: ${pagePath(part.id, page.slug)}`,
    "",
    ...(page.slug === "functions" ? functionsMarkdown() : []),
    ...sectionsMarkdown(page),
  ].join("\n")
}

export function agentMarkdown() {
  return [
    `# ${agentPage.title}`,
    "",
    agentPage.summary,
    "",
    `Page: ${agentPath}`,
    "",
    ...sectionsMarkdown(agentPage),
  ].join("\n")
}

export function upcomingMarkdown() {
  return [
    `# ${upcoming.title}`,
    "",
    upcoming.summary,
    "",
    `Page: ${upcomingPath}`,
    "",
    ...upcoming.features.flatMap((feature) => [
      `## ${feature.title}`,
      "",
      `- Category: ${feature.category}`,
      "",
      feature.description,
      "",
    ]),
    "## Share your ideas",
    "",
    upcoming.ideas,
    "",
    `- Discussions: ${upcoming.discussions}`,
    `- Report a bug: ${upcoming.issues}`,
    "",
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
  `- [Overview](${docsBase}${partFile(part.id)}): what ${part.name} does`,
  ...part.pages.flatMap((page) => [
    `- [${page.title}](${docsBase}${pageFile(part.id, page.slug)}): ${page.summary}`,
    ...(page.slug === "functions"
      ? functionGroups.map(
          (group) => `  - [${group.title}](${docsBase}${groupFile(group.id)}): ${group.body}`,
        )
      : []),
  ]),
  `- [Releases](${docsBase}${part.id}/releases.md): every release, each with its own file`,
]

export function partMarkdown(part: Part) {
  return [
    `# ${part.name}`,
    "",
    part.summary,
    "",
    `- Repository: ${part.repo}`,
    `- Page: ${partPath(part.id)}`,
    "",
    "## What it does",
    "",
    ...part.does.map((item) => `- ${item}`),
    "",
    "## Pages",
    "",
    ...pageLinks(part),
    "",
  ].join("\n")
}

export function overviewMarkdown() {
  return [
    "# GTFS Tools",
    "",
    intro,
    "",
    "## Goal",
    "",
    ...goals.map((goal) => `- **${goal.title}:** ${goal.body}`),
    "",
    ...parts.flatMap((part) => [
      `## ${part.name}`,
      "",
      `${part.summary} Repository: ${part.repo}`,
      "",
      ...pageLinks(part),
      "",
    ]),
    "## Agent skill",
    "",
    `- [${agentPage.title}](${docsBase}${agentFile}): ${agentPage.summary}`,
    "",
    "## Roadmap",
    "",
    `- [${upcoming.title}](${docsBase}${upcomingFile}): ${upcoming.features.map((feature) => feature.title).join(", ")}`,
    "",
    "## Links",
    "",
    `- GTFS Viz web app: ${repos.app}`,
    `- Docs: ${docsBase}`,
    "",
  ].join("\n")
}

export function llmsTxt() {
  return [
    "# GTFS Tools",
    "",
    `> ${intro}`,
    "",
    "## Docs",
    "",
    `- [Full docs](${docsBase}llms-full.txt): every page and release in one file`,
    `- [Overview](${docsBase}index.md): goals and parts`,
    "",
    ...parts.flatMap((part) => [`## ${part.name}`, "", ...pageLinks(part), ""]),
    "## Agent skill",
    "",
    `- [${agentPage.title}](${docsBase}${agentFile}): ${agentPage.summary}`,
    "",
    "## Roadmap",
    "",
    `- [${upcoming.title}](${docsBase}${upcomingFile}): features planned for future releases`,
    "",
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
      partMarkdown(part),
      ...part.pages.map((page) => pageMarkdown(part, page)),
      ...(part.id === "gtfs-duckdb" ? functionGroups.map(groupMarkdown) : []),
      ...releasesFor(part.id).map(releaseMarkdown),
    ]),
    agentMarkdown(),
    upcomingMarkdown(),
  ].join("\n---\n\n")

export function markdownFiles(): Record<string, string> {
  return {
    "llms.txt": llmsTxt(),
    "llms-full.txt": fullMarkdown(),
    "index.md": overviewMarkdown(),
    [agentFile]: agentMarkdown(),
    [upcomingFile]: upcomingMarkdown(),
    ...Object.fromEntries(parts.map((part) => [partFile(part.id), partMarkdown(part)])),
    ...Object.fromEntries(
      functionGroups.map((group) => [groupFile(group.id), groupMarkdown(group)]),
    ),
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
