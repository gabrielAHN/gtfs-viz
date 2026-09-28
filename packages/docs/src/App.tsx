import { useState } from "react"
import { BiLogoGithub } from "react-icons/bi"
import { ArrowUpRight, Boxes, Bot, Cloud, History, TrainFront } from "lucide-react"
import ThemeSwitcher from "@/components/ui/ThemeSwitcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildLink, goals, parts, releases, repos, repoUrl } from "./content"
import type { Part, Release } from "./content"

const goalIcons = [Cloud, Bot, TrainFront]
const visibleReleases = 4

const nav = [
  { id: "intro", label: "Intro" },
  { id: "goals", label: "Goals" },
  { id: "parts", label: "Parts" },
  { id: "releases", label: "Releases" },
]

const releaseRepos: { repo: Release["repo"]; label: string }[] = [
  { repo: "gtfs-viz", label: "gtfs-viz" },
  { repo: "gtfs-duckdb-extension", label: "gtfs-duckdb-extension" },
]

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((piece, index) =>
        piece.startsWith("`") ? (
          <code key={index} className="rounded bg-muted px-1 text-[0.95em]">
            {piece.slice(1, -1)}
          </code>
        ) : (
          <span key={index}>{piece}</span>
        ),
      )}
    </>
  )
}

function RepoLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <BiLogoGithub />
        {label}
        <ArrowUpRight />
      </a>
    </Button>
  )
}

function SectionTitle({
  id,
  title,
  subtitle,
  icon: Icon,
}: {
  id: string
  title: string
  subtitle: string
  icon?: typeof Boxes
}) {
  return (
    <div id={id} className="scroll-mt-6">
      <h2 className="flex items-center gap-2 text-4xl font-bold">
        {Icon && <Icon className="h-8 w-8" />}
        {title}
      </h2>
      <p className="text-lg text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function PartPanel({ part }: { part: Part }) {
  const href = part.path ? `${part.repo}/tree/main/${part.path}` : part.repo
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-3xl font-bold">{part.name}</h3>
          <p className="text-lg text-muted-foreground">{part.tagline}</p>
        </div>
        <RepoLink href={href} label={part.path ?? part.repoLabel} />
      </div>
      <p className="text-lg">
        <Inline text={part.description} />
      </p>
      <ul className="list-disc space-y-1 pl-6 text-lg">
        {part.features.map((feature) => (
          <li key={feature}>
            <Inline text={feature} />
          </li>
        ))}
      </ul>
      <pre className="mt-auto overflow-x-auto rounded-lg border bg-background px-4 py-2 text-base">
        <code>{part.install}</code>
      </pre>
    </div>
  )
}

function ReleaseRow({ release }: { release: Release }) {
  const link = buildLink(release)
  return (
    <li className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[9rem_1fr_auto]">
      <div>
        <p className="text-2xl font-bold">
          {release.version === "Unreleased" ? release.version : `v${release.version}`}
        </p>
        <p className="text-muted-foreground">{release.date}</p>
      </div>
      <div>
        <p className="text-xl font-bold">{release.title}</p>
        <ul className="mt-1 space-y-1">
          {release.highlights.map((item) => (
            <li key={item.text} className="flex items-start gap-2 text-lg">
              <Badge variant="outline" className="mt-0.5 w-24 shrink-0 justify-center">
                {item.area}
              </Badge>
              <span>
                <Inline text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-start gap-2 sm:flex-col sm:items-end">
        <Badge variant={release.status === "Released" ? "default" : "secondary"}>
          {release.status}
        </Badge>
        <Button variant="outline" size="sm" asChild>
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
            <ArrowUpRight />
          </a>
        </Button>
      </div>
    </li>
  )
}

function ReleaseList({ repo }: { repo: Release["repo"] }) {
  const [expanded, setExpanded] = useState(false)
  const list = releases.filter((release) => release.repo === repo)
  const shown = expanded ? list : list.slice(0, visibleReleases)
  return (
    <div className="rounded-lg border bg-card">
      <ul className="divide-y">
        {shown.map((release) => (
          <ReleaseRow key={release.version} release={release} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
        {list.length > visibleReleases ? (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            <History />
            {expanded
              ? "Show recent releases"
              : `Show ${list.length - visibleReleases} older releases`}
          </Button>
        ) : (
          <span />
        )}
        <RepoLink href={`${repoUrl(repo)}/releases`} label="All releases" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-10 px-4 py-6">
      <aside className="sticky top-6 hidden h-fit w-44 shrink-0 lg:block">
        <a href={repos.app} className="text-3xl font-bold">
          GTFS 🚉 Viz
        </a>
        <p className="text-muted-foreground">Docs</p>
        <nav className="mt-4 flex flex-col gap-1 text-lg">
          {nav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-2xl px-3 py-1 hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 space-y-10">
        <header id="intro" className="scroll-mt-6 text-center">
          <h1 className="text-6xl sm:text-8xl">GTFS 🚉 Viz</h1>
          <div className="mb-3 flex justify-center gap-2">
            <Button variant="icon" asChild>
              <a href={repos.viz} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <BiLogoGithub />
              </a>
            </Button>
            <ThemeSwitcher />
          </div>
          <p className="mx-auto max-w-3xl text-xl">
            GTFS Viz is an open-source toolkit for looking at, fixing and publishing GTFS transit
            feeds. A browser app, a command-line tool with an AI agent skill, and a DuckDB extension
            share one set of GTFS functions, so the same station, pathway, route and trip logic runs
            from a single operator's laptop up to a cloud pipeline.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <a href={repos.app}>Open the web app</a>
            </Button>
            <RepoLink href={repos.viz} label="gtfs-viz" />
            <RepoLink href={repos.extension} label="gtfs-duckdb-extension" />
          </div>
        </header>

        <section className="space-y-4">
          <SectionTitle
            id="goals"
            title="Goals"
            subtitle="Make GTFS data scale in the cloud and with AI, without losing the simple workflow operators rely on."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {goals.map((goal, index) => {
              const Icon = goalIcons[index]
              return (
                <div key={goal.title} className="rounded-lg border bg-card p-5">
                  <h3 className="flex items-center gap-2 text-2xl font-bold">
                    <Icon className="h-6 w-6 shrink-0 text-primary" />
                    {goal.title}
                  </h3>
                  <p className="mt-1 text-lg">{goal.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle
            id="parts"
            icon={Boxes}
            title="Parts"
            subtitle="The GTFS DuckDB Extension holds the database logic; everything in GTFS Viz calls it."
          />
          <Tabs
            defaultValue={parts[0].id}
            orientation="vertical"
            className="grid gap-4 md:grid-cols-[14rem_1fr]"
          >
            <TabsList className="flex h-auto flex-row justify-start gap-1 overflow-x-auto md:flex-col md:items-stretch">
              {parts.map((part) => (
                <TabsTrigger
                  key={part.id}
                  value={part.id}
                  className="shrink-0 flex-col items-start px-3 py-2 text-left md:whitespace-normal"
                >
                  <span className="text-lg font-bold">{part.name}</span>
                  <span className="hidden text-sm text-muted-foreground md:block">
                    {part.repoLabel.replace("gabrielAHN/", "")}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {parts.map((part) => (
              <TabsContent key={part.id} value={part.id} className="mt-0">
                <PartPanel part={part} />
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <section className="space-y-4">
          <SectionTitle
            id="releases"
            title="Releases"
            subtitle="Build version of each repository, its key features and the pull request it shipped in."
          />
          <Tabs defaultValue={releaseRepos[0].repo}>
            <TabsList>
              {releaseRepos.map((item) => (
                <TabsTrigger key={item.repo} value={item.repo} className="text-base">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {releaseRepos.map((item) => (
              <TabsContent key={item.repo} value={item.repo}>
                <ReleaseList repo={item.repo} />
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <footer className="flex items-center justify-center gap-2 pb-6">
          <Button variant="icon" asChild>
            <a href={repos.viz} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <BiLogoGithub />
            </a>
          </Button>
          <span className="text-muted-foreground">MIT License · Gabriel AHN</span>
        </footer>
      </main>
    </div>
  )
}
