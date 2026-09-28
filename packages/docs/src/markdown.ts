import { buildLink, goals, intro, parts, releasesFor, repos } from "./content"
import type { Part, Release } from "./content"

export const docsBase = "/docs/"

const versionLabel = (release: Release) =>
  release.version === "Unreleased" ? "Unreleased" : `v${release.version}`

function releaseMarkdown(release: Release) {
  const link = buildLink(release)
  return [
    `### ${versionLabel(release)} — ${release.title}`,
    "",
    `${release.date} · ${release.status} · [${link.label}](${link.href})`,
    "",
    ...release.highlights.map((item) => `- **${item.area}:** ${item.text}`),
  ].join("\n")
}

export function partMarkdown(part: Part) {
  return [
    `# ${part.name}`,
    "",
    `${part.tagline}. Repository: ${part.repo}`,
    "",
    part.summary,
    "",
    "## Components",
    "",
    ...part.components.map((c) => `- **${c.name}** (\`${c.path}\`): ${c.body}`),
    "",
    "## Features",
    "",
    ...part.features.map((feature) => `- ${feature}`),
    "",
    "## How to",
    "",
    ...part.howTo.flatMap((step, index) => [
      `### ${index + 1}. ${step.title}`,
      "",
      step.body,
      ...(step.code ? ["", "```" + (step.lang ?? ""), step.code, "```"] : []),
      "",
    ]),
    "## Releases",
    "",
    ...releasesFor(part.id).flatMap((release) => [releaseMarkdown(release), ""]),
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
    "## Parts",
    "",
    ...parts.map(
      (part) => `- [${part.name}](${docsBase}${part.id}.md): ${part.tagline}. ${part.repo}`,
    ),
    "",
    "## Links",
    "",
    `- Web app: ${repos.app}`,
    `- CLI on npm: ${repos.npm}`,
    `- Extension function reference: ${repos.functions}`,
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
    `- [Full docs](${docsBase}llms-full.txt): everything below in one file`,
    `- [Overview](${docsBase}index.md): goals and parts`,
    ...parts.map((part) => `- [${part.name}](${docsBase}${part.id}.md): ${part.tagline}`),
    "",
    "## Optional",
    "",
    `- [Extension function reference](${repos.functions})`,
    `- [CLI Agent Skill](${repos.viz}/blob/main/packages/cli/skills/gtfs-viz/SKILL.md)`,
    "",
  ].join("\n")
}

export const fullMarkdown = () =>
  [overviewMarkdown(), ...parts.map((part) => partMarkdown(part))].join("\n---\n\n")

export function markdownFiles(): Record<string, string> {
  return {
    "llms.txt": llmsTxt(),
    "llms-full.txt": fullMarkdown(),
    "index.md": overviewMarkdown(),
    ...Object.fromEntries(parts.map((part) => [`${part.id}.md`, partMarkdown(part)])),
  }
}
