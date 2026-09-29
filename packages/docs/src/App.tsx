import { useEffect, useMemo, useState } from "react"
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
  pageFile,
  pagePath,
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
import type { Block, DocPage, Part, Release } from "./content"
import { functionCategories, functions } from "./functions"
import type { FunctionKind, GtfsFunction } from "./functions"
import { fullMarkdown, pageMarkdown, releaseMarkdown, releasesMarkdown } from "./markdown"
import { Link, usePathname } from "./router"

const goalIcons = [Cloud, Bot, TrainFront]

type Route =
  | { kind: "home" }
  | { kind: "agents" }
  | { kind: "page"; part: Part; page: DocPage }
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
  if (segments.length === 1) return { kind: "page", part, page: part.pages[0] }
  if (segments[1] === "releases") {
    if (segments.length === 2) return { kind: "releases", part }
    const release = releasesFor(part.id).find((item) => releaseSlug(item) === segments[2])
    return release && segments.length === 3
      ? { kind: "release", part, release }
      : { kind: "missing" }
  }
  const page = part.pages.find((item) => item.slug === segments[1])
  return page && segments.length === 2 ? { kind: "page", part, page } : { kind: "missing" }
}

function titleFor(route: Route) {
  switch (route.kind) {
    case "home":
      return "GTFS Viz Docs"
    case "agents":
      return "Agent docs · GTFS Viz Docs"
    case "page":
      return `${route.page.title} · ${route.part.name} · GTFS Viz Docs`
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

function CopyButton({ text, label, compact }: { text: string; label: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size="sm"
      aria-label={compact ? label : undefined}
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check /> : <Copy />}
      {!compact && (copied ? "Copied" : label)}
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
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border bg-background py-2 pl-4 pr-12 text-base">
        <code>{code}</code>
      </pre>
      <div className="absolute right-1 top-1">
        <CopyButton text={code} label="Copy code" compact />
      </div>
    </div>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return (
        <p className="text-lg">
          <Inline text={block.text} />
        </p>
      )
    case "list":
      return (
        <ul className="list-disc space-y-1 pl-6 text-lg">
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )
    case "code":
      return <CodeBlock code={block.code} />
    case "steps":
      return (
        <ol className="space-y-3">
          {block.items.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-x-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border bg-card font-bold">
                {index + 1}
              </span>
              <div className="min-w-0 space-y-2">
                <p className="text-lg">
                  <strong>{step.title}</strong>
                  {step.body && (
                    <>
                      {" · "}
                      <Inline text={step.body} />
                    </>
                  )}
                </p>
                {step.code && <CodeBlock code={step.code} />}
              </div>
            </li>
          ))}
        </ol>
      )
    case "cards":
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {block.items.map((card) => {
            const body = (
              <>
                <p className="flex items-center justify-between gap-2 text-xl font-bold">
                  {card.title}
                  {card.href && <ArrowUpRight className="h-4 w-4 shrink-0" />}
                </p>
                <p className="mt-1 break-words text-lg">
                  <Inline text={card.body} />
                </p>
              </>
            )
            return card.href ? (
              <a
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border bg-card p-4 hover:bg-accent hover:text-accent-foreground"
              >
                {body}
              </a>
            ) : (
              <div key={card.title} className="rounded-lg border bg-card p-4">
                {body}
              </div>
            )
          })}
        </div>
      )
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-lg">
            <thead className="bg-muted">
              <tr>
                {block.head.map((cell) => (
                  <th key={cell} className="px-4 py-2 font-bold">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")} className="border-t align-top">
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={`px-4 py-2 ${index === 0 ? "whitespace-nowrap font-bold" : ""}`}
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
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

type NavItem = { to: string; label: string }

function partNav(part: Part): NavItem[] {
  return [
    ...part.pages.map((page) => ({ to: pagePath(part.id, page.slug), label: page.title })),
    { to: releasesPath(part.id), label: "Releases" },
  ]
}

function isActive(pathname: string, item: NavItem, part?: Part) {
  if (pathname.startsWith(item.to)) return true
  return part
    ? item.to === pagePath(part.id, part.pages[0].slug) && pathname === partPath(part.id)
    : false
}

function PageNav({ part, current }: { part: Part; current: string }) {
  const items = partNav(part)
  const index = items.findIndex((item) => item.to === current)
  const previous = items[index - 1]
  const next = items[index + 1]
  return (
    <nav className="grid gap-2 sm:grid-cols-2" aria-label="Page navigation">
      {previous ? (
        <Link
          to={previous.to}
          className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm text-muted-foreground">Previous</span>
            <span className="text-lg font-bold">{previous.label}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          to={next.to}
          className="flex items-center justify-end gap-2 rounded-lg border bg-card px-4 py-3 text-right hover:bg-accent hover:text-accent-foreground"
        >
          <span>
            <span className="block text-sm text-muted-foreground">Next</span>
            <span className="text-lg font-bold">{next.label}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      )}
    </nav>
  )
}

function OnThisPage({ items }: { items: { id: string; title: string }[] }) {
  return (
    <nav aria-label="On this page" className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-2xl border px-3 py-0.5 text-base hover:bg-accent hover:text-accent-foreground"
        >
          {item.title}
        </a>
      ))}
    </nav>
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
          {parts.map((part) => (
            <div key={part.id} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
              <div>
                <h3 className="text-3xl font-bold">{part.name}</h3>
                <p className="text-lg text-muted-foreground">{part.tagline}</p>
              </div>
              <p className="text-lg">
                <Inline text={part.summary} />
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {partNav(part).map((item, index) => (
                  <Button
                    key={item.to}
                    variant={index === 0 ? "default" : "outline"}
                    size="sm"
                    asChild
                  >
                    <Link to={item.to}>{item.label}</Link>
                  </Button>
                ))}
              </div>
            </div>
          ))}
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

const kindLabel: Record<FunctionKind, string> = {
  pragma: "Pragma",
  scalar: "Scalar",
  table: "Table",
}

function FunctionRow({ fn, open }: { fn: GtfsFunction; open: boolean }) {
  return (
    <details id={fn.name} open={open} className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-2 hover:bg-accent hover:text-accent-foreground">
        <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1">
          <code className="break-all text-lg font-bold">{fn.name}</code>
          <span className="block text-base text-muted-foreground">
            <Inline text={fn.description} />
          </span>
        </span>
        <Badge variant="outline" className="mt-1 shrink-0">
          {kindLabel[fn.kind]}
        </Badge>
      </summary>
      <div className="space-y-3 border-t px-4 py-3">
        <p className="text-lg">
          <code className="break-all rounded bg-muted px-1">{fn.signature}</code>
        </p>
        <CodeBlock code={fn.example} />
        {fn.kind === "table" && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-muted-foreground">Returns</span>
            {fn.returns.map((column) => (
              <code key={column} className="rounded bg-muted px-1">
                {column}
              </code>
            ))}
          </div>
        )}
        {fn.kind === "scalar" && (
          <p className="text-lg">
            <span className="text-muted-foreground">Result </span>
            <code className="rounded bg-muted px-1">{fn.returns[0]}</code>
          </p>
        )}
        {fn.note && (
          <p className="text-lg text-muted-foreground">
            <Inline text={fn.note} />
          </p>
        )}
      </div>
    </details>
  )
}

const categoryOf = (name: string) => functions.find((fn) => fn.name === name)?.category

function FunctionsReference() {
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<FunctionKind | "all">("all")
  const [hash, setHash] = useState(() => decodeURIComponent(window.location.hash.slice(1)))
  const [category, setCategory] = useState(() => categoryOf(hash) ?? functionCategories[0].id)
  useEffect(() => {
    const onHash = () => {
      const next = decodeURIComponent(window.location.hash.slice(1))
      setQuery("")
      setKind("all")
      setHash(next)
      const owner = categoryOf(next)
      if (owner) setCategory(owner)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  useEffect(() => {
    if (hash) document.getElementById(hash)?.scrollIntoView()
  }, [hash])
  const needle = query.trim().toLowerCase()
  const scoped = !needle && kind === "all"
  const shown = useMemo(
    () =>
      functions.filter(
        (fn) =>
          (kind === "all" || fn.kind === kind) &&
          (!needle ||
            fn.name.toLowerCase().includes(needle) ||
            fn.description.toLowerCase().includes(needle)) &&
          (!scoped || fn.category === category),
      ),
    [kind, needle, scoped, category],
  )
  const counts = (["pragma", "scalar", "table"] as FunctionKind[]).map((item) => ({
    item,
    count: functions.filter((fn) => fn.kind === item).length,
  }))
  const groups = functionCategories.filter((group) => shown.some((fn) => fn.category === group.id))
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all 88 functions"
          aria-label="Search functions"
          className="h-9 w-full rounded-md border bg-background px-3 text-lg sm:w-64"
        />
        <Tabs value={kind} onValueChange={(value) => setKind(value as FunctionKind | "all")}>
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="all" className="text-base">
              All {functions.length}
            </TabsTrigger>
            {counts.map(({ item, count }) => (
              <TabsTrigger key={item} value={item} className="text-base">
                {kindLabel[item]} {count}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <nav aria-label="Function categories" className="flex flex-wrap gap-2">
        {functionCategories.map((group) => {
          const active = scoped && group.id === category
          return (
            <button
              key={group.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setQuery("")
                setKind("all")
                setCategory(group.id)
              }}
              className={`rounded-2xl border px-3 py-0.5 text-base hover:bg-accent hover:text-accent-foreground ${active ? "bg-accent font-bold text-accent-foreground" : ""}`}
            >
              {group.title}{" "}
              <span className="text-muted-foreground">
                {functions.filter((fn) => fn.category === group.id).length}
              </span>
            </button>
          )
        })}
      </nav>
      {groups.length === 0 && (
        <p className="text-lg text-muted-foreground">No functions match “{query}”.</p>
      )}
      {groups.map((group) => {
        const list = shown.filter((fn) => fn.category === group.id)
        return (
          <section key={group.id} id={`category-${group.id}`} className="scroll-mt-4 space-y-2">
            <div>
              <h2 className="text-3xl font-bold">
                {group.title} <span className="text-xl text-muted-foreground">{list.length}</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                <Inline text={group.body} />
              </p>
            </div>
            {list.map((fn) => (
              <FunctionRow key={fn.name} fn={fn} open={hash === fn.name} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function DocPageView({ part, page }: { part: Part; page: DocPage }) {
  const markdown = pageMarkdown(part, page)
  const file = pageFile(part.id, page.slug)
  const functionsPage = page.slug === "functions"
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { label: "Docs", to: docsBase },
          { label: part.name, to: partPath(part.id) },
          { label: page.title },
        ]}
        title={page.title}
        subtitle={<Inline text={page.summary} />}
        actions={
          <ExternalButton
            href={part.repo}
            label={part.repo.replace("https://github.com/", "")}
            github
          />
        }
      />
      <Tabs defaultValue="docs">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="docs" className="text-base">
            Docs
          </TabsTrigger>
          <TabsTrigger value="markdown" className="text-base">
            <FileText className="mr-1 h-4 w-4" />
            Markdown
          </TabsTrigger>
        </TabsList>
        <TabsContent value="docs" className="mt-4 space-y-8">
          {functionsPage ? (
            <FunctionsReference />
          ) : (
            <>
              {page.sections.length > 2 && <OnThisPage items={page.sections} />}
              {page.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-4 space-y-3">
                  <h2 className="text-3xl font-bold">{section.title}</h2>
                  {section.blocks.map((block, index) => (
                    <BlockView key={index} block={block} />
                  ))}
                </section>
              ))}
            </>
          )}
        </TabsContent>
        <TabsContent value="markdown" className="mt-4 space-y-3">
          <MarkdownBar text={markdown} file={file} />
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-background px-4 py-3 text-base">
            {markdown}
          </pre>
        </TabsContent>
      </Tabs>
      <PageNav part={part} current={pagePath(part.id, page.slug)} />
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
        actions={
          <div className="flex flex-wrap gap-2">
            <MarkdownBar text={releasesMarkdown(part)} file={`${part.id}/releases.md`} />
            <ExternalButton href={`${part.repo}/releases`} label="GitHub releases" github />
          </div>
        }
      />
      <div className="space-y-2">
        {list.map((release) => (
          <ReleaseCard key={release.version} release={release} />
        ))}
      </div>
      <PageNav part={part} current={releasesPath(part.id)} />
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
    { file: "llms-full.txt", body: "Every page and release note in one file." },
    { file: "index.md", body: "Intro, goals and parts." },
    ...parts.flatMap((part) => [
      ...part.pages.map((page) => ({
        file: pageFile(part.id, page.slug),
        body: `${part.name}: ${page.title}.`,
      })),
      { file: `${part.id}/releases.md`, body: `${part.name}: every release.` },
    ]),
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
      <div className="grid gap-2 md:grid-cols-2">
        {files.map((item) => (
          <a
            key={item.file}
            href={`${docsBase}${item.file}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3 hover:bg-accent hover:text-accent-foreground"
          >
            <span className="min-w-0">
              <span className="break-all text-xl font-bold">{item.file}</span>
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

const linkClass = (active: boolean) =>
  `rounded-2xl px-3 py-1 hover:bg-accent hover:text-accent-foreground ${active ? "bg-accent font-bold text-accent-foreground" : ""}`

function Sidebar({ pathname }: { pathname: string }) {
  const agents = `${docsBase}agents/`
  return (
    <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] w-56 shrink-0 overflow-y-auto lg:block">
      <Link to={docsBase} className="text-3xl font-bold">
        GTFS 🚉 Viz
      </Link>
      <p className="text-muted-foreground">Docs</p>
      <nav className="mt-4 flex flex-col gap-4 text-lg" aria-label="Docs">
        <Link
          to={docsBase}
          aria-current={pathname === docsBase ? "page" : undefined}
          className={linkClass(pathname === docsBase)}
        >
          Home
        </Link>
        {parts.map((part) => (
          <div key={part.id} className="flex flex-col gap-0.5">
            <Link
              to={partPath(part.id)}
              className="px-3 pb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {part.name}
            </Link>
            {partNav(part).map((item) => {
              const active = isActive(pathname, item, part)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`${linkClass(active)} ml-2 border-l pl-4`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
        <Link
          to={agents}
          aria-current={pathname === agents ? "page" : undefined}
          className={linkClass(pathname === agents)}
        >
          Agent docs
        </Link>
      </nav>
    </aside>
  )
}

function MobileNav({ pathname, route }: { pathname: string; route: Route }) {
  const current = "part" in route ? route.part : undefined
  const top = [
    { to: docsBase, label: "Home", active: pathname === docsBase },
    ...parts.map((part) => ({
      to: partPath(part.id),
      label: part.name,
      active: current?.id === part.id,
    })),
    { to: `${docsBase}agents/`, label: "Agent docs", active: route.kind === "agents" },
  ]
  return (
    <div className="space-y-2 lg:hidden">
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="Docs">
        {top.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            aria-current={link.active ? "page" : undefined}
            className={`shrink-0 rounded-2xl border px-3 py-1 ${link.active ? "bg-accent font-bold text-accent-foreground" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {current && (
        <nav
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 text-base"
          aria-label={`${current.name} pages`}
        >
          {partNav(current).map((item) => {
            const active = isActive(pathname, item, current)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-2xl px-3 py-0.5 ${active ? "bg-accent font-bold text-accent-foreground" : "text-muted-foreground"}`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
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
      case "page":
        return (
          <DocPageView
            key={pagePath(route.part.id, route.page.slug)}
            part={route.part}
            page={route.page}
          />
        )
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
        <MobileNav pathname={pathname} route={route} />
        {page}
        <footer className="pb-6 pt-6 text-center text-muted-foreground">
          MIT License · Gabriel AHN
        </footer>
      </main>
    </div>
  )
}
