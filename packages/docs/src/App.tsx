import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { BiLogoGithub } from "react-icons/bi"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  FileText,
  TrainFront,
} from "lucide-react"
import ThemeSwitcher from "@/components/ui/ThemeSwitcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  docsBase,
  githubRelease,
  goals,
  intro,
  partById,
  partPath,
  parts,
  pullRequest,
  releaseFile,
  releasePath,
  releasesFor,
  releasesPath,
  releaseSlug,
  repos,
  versionLabel,
} from "./content"
import type { Part, Release } from "./content"
import { fullMarkdown, partMarkdown, releaseMarkdown } from "./markdown"
import { Link, usePathname } from "./router"

const goalIcons = [Cloud, Bot, TrainFront]

type Route =
  | { kind: "home" }
  | { kind: "agents" }
  | { kind: "part"; part: Part }
  | { kind: "releases"; part: Part }
  | { kind: "release"; part: Part; release: Release }
  | { kind: "missing" }

function resolve(pathname: string): Route {
  const segments = pathname
    .replace(/^\/docs\/?/, "")
    .split("/")
    .filter(Boolean)
  if (segments.length === 0) return { kind: "home" }
  if (segments[0] === "agents" && segments.length === 1) return { kind: "agents" }
  const part = partById(segments[0])
  if (!part) return { kind: "missing" }
  if (segments.length === 1) return { kind: "part", part }
  if (segments[1] !== "releases") return { kind: "missing" }
  if (segments.length === 2) return { kind: "releases", part }
  const release = releasesFor(part.id).find((item) => releaseSlug(item) === segments[2])
  return release && segments.length === 3 ? { kind: "release", part, release } : { kind: "missing" }
}

function titleFor(route: Route) {
  switch (route.kind) {
    case "home":
      return "GTFS Viz Docs"
    case "agents":
      return "Agent docs · GTFS Viz Docs"
    case "part":
      return `${route.part.name} · GTFS Viz Docs`
    case "releases":
      return `${route.part.name} releases · GTFS Viz Docs`
    case "release":
      return `${route.part.name} ${versionLabel(route.release)} · GTFS Viz Docs`
    default:
      return "Not found · GTFS Viz Docs"
  }
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((piece, index) =>
        piece.startsWith("**") ? (
          <strong key={index}>{piece.slice(2, -2)}</strong>
        ) : piece.startsWith("`") ? (
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

function ExternalButton({
  href,
  label,
  github,
}: {
  href: string
  label: string
  github?: boolean
}) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {github && <BiLogoGithub />}
        {label}
        <ArrowUpRight />
      </a>
    </Button>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  )
}

function MarkdownBar({ text, file }: { text: string; file: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CopyButton text={text} label="Copy markdown" />
      <Button variant="outline" size="sm" asChild>
        <a href={`${docsBase}${file}`} target="_blank" rel="noopener noreferrer">
          <FileText />
          {file.split("/").pop()}
        </a>
      </Button>
    </div>
  )
}

function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-muted-foreground"
    >
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-4 w-4" />}
          {item.to ? (
            <Link to={item.to} className="underline-offset-4 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-foreground">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}

function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
}: {
  crumbs: { label: string; to?: string }[]
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="space-y-2">
      <Breadcrumbs items={crumbs} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-5xl font-bold">{title}</h1>
          {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-background px-4 py-2 text-base">
      <code>{code}</code>
    </pre>
  )
}

function StatusBadge({ release }: { release: Release }) {
  return (
    <Badge variant={release.status === "Released" ? "default" : "secondary"}>
      {release.status}
    </Badge>
  )
}

function ReleaseCard({ release }: { release: Release }) {
  return (
    <Link
      to={releasePath(release)}
      className="flex items-center justify-between gap-4 rounded-lg border bg-card px-5 py-3 hover:bg-accent hover:text-accent-foreground"
    >
      <span className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-2xl font-bold">{versionLabel(release)}</span>
        <span className="text-lg">{release.title}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="hidden text-muted-foreground sm:inline">{release.date}</span>
        <StatusBadge release={release} />
        <ChevronRight className="h-5 w-5" />
      </span>
    </Link>
  )
}

function HowTo({ part }: { part: Part }) {
  const [active, setActive] = useState(0)
  const step = part.howTo[active]
  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <ol className="flex gap-1 overflow-x-auto md:flex-col">
        {part.howTo.map((item, index) => (
          <li key={item.title} className="shrink-0">
            <button
              type="button"
              onClick={() => setActive(index)}
              aria-current={index === active ? "step" : undefined}
              className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-lg hover:bg-accent hover:text-accent-foreground ${index === active ? "bg-accent font-bold text-accent-foreground" : ""}`}
            >
              <span className="w-5 shrink-0 text-muted-foreground">{index + 1}.</span>
              <span className="whitespace-nowrap md:whitespace-normal">{item.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold">
          {active + 1}. {step.title}
        </h3>
        <p className="text-lg">
          <Inline text={step.body} />
        </p>
        {step.code && <CodeBlock code={step.code} />}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={active === 0}
            onClick={() => setActive(active - 1)}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={active === part.howTo.length - 1}
            onClick={() => setActive(active + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function HomePage() {
  return (
    <div className="space-y-10">
      <header className="text-center">
        <h1 className="text-6xl sm:text-8xl">GTFS 🚉 Viz</h1>
        <p className="mx-auto mt-2 max-w-3xl text-xl">{intro}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a href={repos.app}>Open the web app</a>
          </Button>
          <ExternalButton href={repos.viz} label="gtfs-viz" github />
          <ExternalButton href={repos.extension} label="gtfs-duckdb-extension" github />
        </div>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-4xl font-bold">Goals</h2>
          <p className="text-lg text-muted-foreground">
            Make GTFS data scale in the cloud and with AI, without losing the simple workflow
            operators rely on.
          </p>
        </div>
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
        <h2 className="text-4xl font-bold">Parts</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {parts.map((part) => {
            const latest = releasesFor(part.id)[0]
            return (
              <div key={part.id} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
                <div>
                  <h3 className="text-3xl font-bold">{part.name}</h3>
                  <p className="text-lg text-muted-foreground">{part.tagline}</p>
                </div>
                <p className="text-lg">
                  <Inline text={part.summary} />
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to={partPath(part.id)}>
                      Read the docs
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={releasesPath(part.id)}>Releases</Link>
                  </Button>
                  {latest && (
                    <Button variant="ghost" asChild>
                      <Link to={releasePath(latest)}>Latest: {versionLabel(latest)}</Link>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="flex items-center gap-2 text-3xl font-bold">
          <Bot className="h-7 w-7" />
          Docs for AI agents
        </h2>
        <p className="text-lg text-muted-foreground">Every page is also available as markdown.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={fullMarkdown()} label="Copy all docs" />
          <Button variant="outline" size="sm" asChild>
            <Link to={`${docsBase}agents/`}>Agent docs</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

function PartPage({ part }: { part: Part }) {
  const list = releasesFor(part.id)
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Docs", to: docsBase }, { label: part.name }]}
        title={part.name}
        subtitle={part.tagline}
        actions={
          <ExternalButton
            href={part.repo}
            label={part.repo.replace("https://github.com/", "")}
            github
          />
        }
      />
      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview" className="text-base">
            Overview
          </TabsTrigger>
          <TabsTrigger value="how-to" className="text-base">
            How to
          </TabsTrigger>
          <TabsTrigger value="markdown" className="text-base">
            <FileText className="mr-1 h-4 w-4" />
            Markdown
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <p className="text-lg">
            <Inline text={part.summary} />
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {part.components.map((component) => (
              <a
                key={component.name}
                href={`${part.repo}/tree/main/${component.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border bg-card p-4 hover:bg-accent hover:text-accent-foreground"
              >
                <p className="flex items-center justify-between gap-2 text-xl font-bold">
                  {component.name}
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                </p>
                <p className="text-sm text-muted-foreground">{component.path}</p>
                <p className="mt-1 text-lg">
                  <Inline text={component.body} />
                </p>
              </a>
            ))}
          </div>
          <ul className="grid list-disc gap-x-8 gap-y-1 pl-6 text-lg sm:grid-cols-2">
            {part.features.map((feature) => (
              <li key={feature}>
                <Inline text={feature} />
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="how-to" className="mt-4">
          <HowTo part={part} />
        </TabsContent>
        <TabsContent value="markdown" className="mt-4 space-y-3">
          <MarkdownBar text={partMarkdown(part)} file={`${part.id}.md`} />
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-background px-4 py-3 text-base">
            {partMarkdown(part)}
          </pre>
        </TabsContent>
      </Tabs>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-3xl font-bold">Latest releases</h2>
          <Button variant="outline" size="sm" asChild>
            <Link to={releasesPath(part.id)}>
              All {list.length} releases
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="space-y-2">
          {list.slice(0, 3).map((release) => (
            <ReleaseCard key={release.version} release={release} />
          ))}
        </div>
      </section>
    </div>
  )
}

function ReleasesPage({ part }: { part: Part }) {
  const list = releasesFor(part.id)
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { label: "Docs", to: docsBase },
          { label: part.name, to: partPath(part.id) },
          { label: "Releases" },
        ]}
        title={`${part.name} releases`}
        subtitle="Each release has its own page with its highlights and the pull request it shipped in."
        actions={<ExternalButton href={`${part.repo}/releases`} label="GitHub releases" github />}
      />
      <div className="space-y-2">
        {list.map((release) => (
          <ReleaseCard key={release.version} release={release} />
        ))}
      </div>
    </div>
  )
}

function ReleasePage({ part, release }: { part: Part; release: Release }) {
  const list = releasesFor(part.id)
  const index = list.indexOf(release)
  const newer = list[index - 1]
  const older = list[index + 1]
  const pr = pullRequest(release)
  const tag = githubRelease(release)
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { label: "Docs", to: docsBase },
          { label: part.name, to: partPath(part.id) },
          { label: "Releases", to: releasesPath(part.id) },
          { label: versionLabel(release) },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {versionLabel(release)}
            <StatusBadge release={release} />
          </span>
        }
        subtitle={`${release.title} · ${release.date}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {pr && <ExternalButton href={pr.href} label={pr.label} github />}
            {tag && <ExternalButton href={tag} label="GitHub release" github />}
          </div>
        }
      />
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-2xl font-bold">Highlights</h2>
        <ul className="mt-3 space-y-2">
          {release.highlights.map((item) => (
            <li key={item.text} className="flex items-start gap-3 text-lg">
              <Badge variant="outline" className="mt-0.5 w-14 shrink-0 justify-center sm:w-24">
                {item.area}
              </Badge>
              <span>
                <Inline text={item.text} />
              </span>
            </li>
          ))}
        </ul>
      </section>
      <MarkdownBar text={releaseMarkdown(release)} file={releaseFile(release)} />
      <nav className="grid gap-2 sm:grid-cols-2" aria-label="Release navigation">
        {older ? (
          <Link
            to={releasePath(older)}
            className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <span>
              <span className="block text-sm text-muted-foreground">Older</span>
              <span className="text-lg font-bold">
                {versionLabel(older)}: {older.title}
              </span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link
            to={releasePath(newer)}
            className="flex items-center justify-end gap-2 rounded-lg border bg-card px-4 py-3 text-right hover:bg-accent hover:text-accent-foreground"
          >
            <span>
              <span className="block text-sm text-muted-foreground">Newer</span>
              <span className="text-lg font-bold">
                {versionLabel(newer)}: {newer.title}
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0" />
          </Link>
        )}
      </nav>
    </div>
  )
}

function AgentsPage() {
  const files = [
    { file: "llms.txt", body: "Index of every docs file, following the llms.txt convention." },
    { file: "llms-full.txt", body: "All docs, parts and release notes in one file." },
    { file: "index.md", body: "Intro, goals and parts." },
    ...parts.map((part) => ({ file: `${part.id}.md`, body: `${part.name}: overview and how-to.` })),
  ]
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Docs", to: docsBase }, { label: "Agent docs" }]}
        title="Agent docs"
        subtitle={
          <>
            Point an agent at <code className="rounded bg-muted px-1">{docsBase}llms.txt</code> or
            paste the full file into its context.
          </>
        }
        actions={<CopyButton text={fullMarkdown()} label="Copy all docs" />}
      />
      <div className="grid gap-2">
        {files.map((item) => (
          <a
            key={item.file}
            href={`${docsBase}${item.file}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3 hover:bg-accent hover:text-accent-foreground"
          >
            <span>
              <span className="text-xl font-bold">{item.file}</span>
              <span className="block text-muted-foreground">{item.body}</span>
            </span>
            <ArrowUpRight className="h-5 w-5 shrink-0" />
          </a>
        ))}
      </div>
      <p className="text-lg text-muted-foreground">
        Each release page also has its own markdown file, listed in{" "}
        <code className="rounded bg-muted px-1">llms.txt</code>.
      </p>
    </div>
  )
}

function MissingPage() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-5xl font-bold">Page not found</h1>
      <Button asChild>
        <Link to={docsBase}>Back to the docs</Link>
      </Button>
    </div>
  )
}

function navLinks() {
  return [
    { to: docsBase, label: "Home", nested: false },
    ...parts.flatMap((part) => [
      { to: partPath(part.id), label: part.name, nested: false },
      { to: releasesPath(part.id), label: "Releases", nested: true },
    ]),
    { to: `${docsBase}agents/`, label: "Agent docs", nested: false },
  ]
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="sticky top-6 hidden h-fit w-48 shrink-0 lg:block">
      <Link to={docsBase} className="text-3xl font-bold">
        GTFS 🚉 Viz
      </Link>
      <p className="text-muted-foreground">Docs</p>
      <nav className="mt-4 flex flex-col gap-1 text-lg">
        {navLinks().map((link) => {
          const active = pathname === link.to || (link.nested && pathname.startsWith(link.to))
          return (
            <Link
              key={link.to}
              to={link.to}
              aria-current={active ? "page" : undefined}
              className={`rounded-2xl px-3 py-1 hover:bg-accent hover:text-accent-foreground ${link.nested ? "pl-6 text-base" : ""} ${active ? "bg-accent font-bold text-accent-foreground" : ""}`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function MobileNav({ pathname }: { pathname: string }) {
  const links = navLinks().map((link, index, all) =>
    link.nested ? { ...link, label: `${all[index - 1].label} releases` } : link,
  )
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:hidden">
      {links.map((link) => {
        const active = pathname === link.to || (link.nested && pathname.startsWith(link.to))
        return (
          <Link
            key={link.to}
            to={link.to}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-2xl border px-3 py-1 ${active ? "bg-accent font-bold text-accent-foreground" : ""}`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default function App() {
  const raw = usePathname()
  const pathname = raw.endsWith("/") ? raw : `${raw}/`
  const route = resolve(pathname)
  useEffect(() => {
    document.title = titleFor(route)
  }, [route])
  const page = (() => {
    switch (route.kind) {
      case "home":
        return <HomePage />
      case "agents":
        return <AgentsPage />
      case "part":
        return <PartPage key={route.part.id} part={route.part} />
      case "releases":
        return <ReleasesPage part={route.part} />
      case "release":
        return (
          <ReleasePage key={releasePath(route.release)} part={route.part} release={route.release} />
        )
      default:
        return <MissingPage />
    }
  })()
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-10 px-4 py-6">
      <Sidebar pathname={pathname} />
      <main className="min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Link to={docsBase} className="text-2xl font-bold lg:invisible">
            GTFS 🚉 Viz
          </Link>
          <div className="flex gap-2">
            <Button variant="icon" asChild>
              <a href={repos.viz} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <BiLogoGithub />
              </a>
            </Button>
            <ThemeSwitcher />
          </div>
        </div>
        <MobileNav pathname={pathname} />
        {page}
        <footer className="pb-6 pt-6 text-center text-muted-foreground">
          MIT License · Gabriel AHN
        </footer>
      </main>
    </div>
  )
}
