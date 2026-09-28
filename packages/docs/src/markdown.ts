import {
  docsBase,
  githubRelease,
  goals,
  intro,
  parts,
  pullRequest,
  releaseFile,
  releasePath,
  releases,
  releasesFor,
  repos,
  versionLabel,
} from "./content"
import type { Part, Release } from "./content"

export { docsBase }

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
    "Each release has its own page.",
    "",
    ...releasesFor(part.id).map(
      (release) =>
        `- [${versionLabel(release)}: ${release.title}](${docsBase}${releaseFile(release)}) (${release.date}, ${release.status})`,
    ),
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
    "## Releases",
    "",
    ...releases.map(
      (release) =>
        `- [${parts.find((part) => part.id === release.repo)!.name} ${versionLabel(release)}](${docsBase}${releaseFile(release)}): ${release.title}`,
    ),
    "",
    "## Optional",
    "",
    `- [Extension function reference](${repos.functions})`,
    `- [CLI Agent Skill](${repos.viz}/blob/main/packages/cli/skills/gtfs-viz/SKILL.md)`,
    "",
  ].join("\n")
}

export const fullMarkdown = () =>
  [
    overviewMarkdown(),
    ...parts.flatMap((part) => [partMarkdown(part), ...releasesFor(part.id).map(releaseMarkdown)]),
  ].join("\n---\n\n")

export function markdownFiles(): Record<string, string> {
  return {
    "llms.txt": llmsTxt(),
    "llms-full.txt": fullMarkdown(),
    "index.md": overviewMarkdown(),
    ...Object.fromEntries(parts.map((part) => [`${part.id}.md`, partMarkdown(part)])),
    ...Object.fromEntries(
      releases.map((release) => [releaseFile(release), releaseMarkdown(release)]),
    ),
  }
}
