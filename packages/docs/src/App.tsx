import { Fragment } from "react"
import { BiLogoGithub } from "react-icons/bi"
import { ArrowUpRight, Boxes, Cloud, Bot, TrainFront } from "lucide-react"
import ThemeSwitcher from "@/components/ui/ThemeSwitcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { goals, parts, releases, repos, repoUrl } from "./content"
import type { Part, Release } from "./content"

const goalIcons = [Cloud, Bot, TrainFront]

const layout: { repo: string; href: string; rows: [{ id: string; label: string }, string][] }[] = [
  {
    repo: "gtfs-duckdb-extension",
    href: repos.extension,
    rows: [[{ id: "extension", label: "gtfs" }, "GTFS functions for DuckDB and DuckDB-WASM"]],
  },
  {
    repo: "gtfs-viz",
    href: repos.viz,
    rows: [
      [{ id: "web", label: "packages/web" }, "Browser app on DuckDB-WASM"],
      [{ id: "cli", label: "packages/cli" }, "CLI, dashboard and Agent Skill on DuckDB"],
      [{ id: "client", label: "packages/duckdb-client" }, "Downloads and loads the extension"],
      [{ id: "lib", label: "packages/lib" }, "Rendering layers"],
    ],
  },
]

const nav = [
  { id: "intro", label: "Intro" },
  { id: "goals", label: "Goals" },
  { id: "parts", label: "Parts" },
  ...parts.map((part) => ({ id: part.id, label: part.name, nested: true })),
  { id: "releases", label: "Releases" },
]

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-card px-4 py-3 text-left font-mono text-base">
      <code>{children}</code>
    </pre>
  )
}

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

function PartSection({ part }: { part: Part }) {
  const href = part.path ? `${part.repo}/tree/main/${part.path}` : part.repo
  return (
    <section id={part.id} className="scroll-mt-6 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-3xl font-bold">{part.name}</h3>
          <p className="text-lg text-muted-foreground">{part.tagline}</p>
        </div>
        <RepoLink
          href={href}
          label={part.path ? `${part.repoLabel}/${part.path}` : part.repoLabel}
        />
      </div>
      <p className="mt-4 text-lg">
        <Inline text={part.description} />
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-lg">
        {part.features.map((feature) => (
          <li key={feature}>
            <Inline text={feature} />
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Code>{part.install}</Code>
      </div>
    </section>
  )
}

function ReleaseCard({ release }: { release: Release }) {
  const base = repoUrl(release.repo)
  return (
    <article className="rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-3xl font-bold">
          {release.version === "Unreleased" ? release.version : `v${release.version}`}
        </h3>
        <Badge variant="outline">{release.repo}</Badge>
        <Badge variant={release.status === "Released" ? "default" : "secondary"}>
          {release.status}
        </Badge>
      </div>
      <p className="text-lg text-muted-foreground">
        {release.title} · {release.date} ·{" "}
        <a
          className="underline underline-offset-4"
          href={`${base}/pull/${release.pr}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          PR #{release.pr}
        </a>
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {release.sections.map((section) => (
          <div key={section.heading}>
            <h4 className="text-xl font-bold">{section.heading}</h4>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-lg">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </article>
  )
}

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-10 px-4 py-6">
      <aside className="sticky top-6 hidden h-fit w-56 shrink-0 lg:block">
        <a href={repos.app} className="text-3xl font-bold">
          GTFS 🚉 Viz
        </a>
        <p className="text-muted-foreground">Docs</p>
        <nav className="mt-4 flex flex-col gap-1 text-lg">
          {nav.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`rounded-2xl px-3 py-1 hover:bg-accent hover:text-accent-foreground ${"nested" in item ? "pl-6 text-base text-muted-foreground" : ""}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 space-y-12">
        <header id="intro" className="scroll-mt-6 text-center">
          <h1 className="text-6xl sm:text-[12vh]">GTFS 🚉 Viz</h1>
          <div className="mb-4 flex justify-center gap-2">
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

        <section id="goals" className="scroll-mt-6">
          <h2 className="text-4xl font-bold">Goals</h2>
          <p className="text-lg text-muted-foreground">
            Make GTFS data scale in the cloud and with AI, without losing the simple workflow
            operators rely on.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {goals.map((goal, index) => {
              const Icon = goalIcons[index]
              return (
                <div key={goal.title} className="rounded-lg border bg-card p-5">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-2 text-2xl font-bold">{goal.title}</h3>
                  <p className="mt-1 text-lg">{goal.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section id="parts" className="scroll-mt-6 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-4xl font-bold">
              <Boxes className="h-8 w-8" />
              Parts
            </h2>
            <p className="text-lg text-muted-foreground">
              The GTFS DuckDB Extension holds the database logic; everything else in GTFS Viz calls
              it.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {layout.map((group) => (
              <div key={group.repo} className="rounded-lg border bg-card p-5">
                <a
                  href={group.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xl font-bold underline-offset-4 hover:underline"
                >
                  {group.repo}
                </a>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-lg">
                  {group.rows.map(([name, role]) => (
                    <Fragment key={name.id}>
                      <dt>
                        <a
                          href={`#${name.id}`}
                          className="font-bold underline-offset-4 hover:underline"
                        >
                          {name.label}
                        </a>
                      </dt>
                      <dd className="text-muted-foreground">{role}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          {parts.map((part) => (
            <PartSection key={part.id} part={part} />
          ))}
        </section>

        <section id="releases" className="scroll-mt-6 space-y-4">
          <div>
            <h2 className="text-4xl font-bold">Releases</h2>
            <p className="text-lg text-muted-foreground">
              Build version of each repository and the features in each pull request.
            </p>
          </div>
          {releases.map((release) => (
            <ReleaseCard key={`${release.repo}-${release.version}`} release={release} />
          ))}
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
