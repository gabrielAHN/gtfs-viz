import { useEffect, useRef, useState } from "react"
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
  Menu,
  MessageSquare,
  Sparkles,
  TrainFront,
  X,
} from "lucide-react"
import ThemeSwitcher from "@/components/ui/ThemeSwitcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  agentFile,
  agentPage,
  agentPath,
  docsBase,
  functionsPath,
  githubRelease,
  groupFile,
  goals,
  intro,
  pageFile,
  pagePath,
  partById,
  partFile,
  partPath,
  parts,
  pullRequest,
  releaseFile,
  releasePath,
  releasesFor,
  releasesPath,
  releaseSlug,
  repos,
  upcoming,
  upcomingFile,
  upcomingPath,
  versionLabel,
} from "./content"
import type { Block, DocPage, Part, Release, Section } from "./content"
import { functionGroups, functions, internalCount } from "./functions"
import type { FunctionGroup, FunctionKind, GtfsFunction } from "./functions"
import {
  agentMarkdown,
  groupMarkdown,
  pageMarkdown,
  partMarkdown,
  releaseMarkdown,
  releasesMarkdown,
  upcomingMarkdown,
} from "./markdown"
import { Link, useHash, usePathname } from "./router"

const goalIcons = [TrainFront, Bot, Cloud]

const siteName = "GTFS Tools"

type Route =
  | { kind: "home" }
  | { kind: "agents" }
  | { kind: "upcoming" }
  | { kind: "part"; part: Part }
  | { kind: "page"; part: Part; page: DocPage }
  | { kind: "group"; part: Part; group: FunctionGroup }
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
  if (segments[0] === "upcoming" && segments.length === 1) return { kind: "upcoming" }
  const part = partById(segments[0])
  if (!part) return { kind: "missing" }
  if (segments.length === 1) return { kind: "part", part }
  if (segments[1] === "functions" && segments.length === 3) {
    const group = functionGroups.find((item) => item.id === segments[2])
    return group ? { kind: "group", part, group } : { kind: "missing" }
  }
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
      return `${siteName} Docs`
    case "agents":
      return `${agentPage.title} · ${siteName} Docs`
    case "upcoming":
      return `${upcoming.title} · ${siteName} Docs`
    case "part":
      return `${route.part.name} · ${siteName} Docs`
    case "page":
      return `${route.page.title} · ${route.part.name} · ${siteName} Docs`
    case "group":
      return `${route.group.title} · Functions · ${siteName} Docs`
    case "releases":
      return `${route.part.name} releases · ${siteName} Docs`
    case "release":
      return `${route.part.name} ${versionLabel(route.release)} · ${siteName} Docs`
    default:
      return `Not found · ${siteName} Docs`
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

const smallButton = "h-7 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5"

function CopyButton({
  text,
  label,
  compact,
  className,
}: {
  text: string
  label: string
  compact?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size="sm"
      className={className}
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
  const href = `${docsBase}${file}`
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" className={smallButton} asChild>
        <a href={href} target="_blank" rel="noopener noreferrer" title={href}>
          <FileText />
          Markdown
        </a>
      </Button>
      <CopyButton text={text} label="Copy markdown" className={smallButton} />
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
      <h1 className="text-5xl font-bold">{title}</h1>
      {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
      {actions && <div className="pt-1">{actions}</div>}
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
                  {card.href && <ChevronRight className="h-4 w-4 shrink-0" />}
                </p>
                <p className="mt-1 break-words text-lg">
                  <Inline text={card.body} />
                </p>
              </>
            )
            return card.href ? (
              <Link
                key={card.title}
                to={card.href}
                className="rounded-lg border bg-card p-4 hover:bg-accent hover:text-accent-foreground"
              >
                {body}
              </Link>
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
    { to: partPath(part.id), label: "Overview" },
    ...part.pages.flatMap((page) => [
      { to: pagePath(part.id, page.slug), label: page.title },
      ...(page.slug === "functions"
        ? functionGroups.map((group) => ({ to: functionsPath(group.id), label: group.title }))
        : []),
    ]),
    { to: releasesPath(part.id), label: "Releases" },
  ]
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

function RepoButton({ href, label = "GitHub" }: { href: string; label?: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <BiLogoGithub />
        {label}
      </a>
    </Button>
  )
}

function HomePage() {
  return (
    <div className="space-y-10">
      <header className="text-center">
        <h1 className="text-6xl sm:text-8xl">GTFS 🚉 Tools</h1>
        <p className="mx-auto mt-2 max-w-3xl text-xl">{intro}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a href={repos.app}>Open GTFS Viz</a>
          </Button>
        </div>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-4xl font-bold">Goal</h2>
          <p className="text-lg text-muted-foreground">
            Make GTFS data easy to work with for operators, AI agents and cloud pipelines alike.
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
        <h2 className="text-4xl font-bold">Projects</h2>
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
                <Button size="sm" asChild>
                  <Link to={partPath(part.id)}>Docs</Link>
                </Button>
                <RepoButton href={part.repo} label={part.repo.replace("https://github.com/", "")} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function PartPage({ part }: { part: Part }) {
  const pages = partNav(part).filter(
    (item) =>
      item.to !== partPath(part.id) &&
      (item.to === functionsPath() || !item.to.startsWith(functionsPath())),
  )
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Docs", to: docsBase }, { label: part.name }]}
        title={part.name}
        subtitle={<Inline text={part.summary} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RepoButton href={part.repo} label={part.repo.replace("https://github.com/", "")} />
            <MarkdownBar text={partMarkdown(part)} file={partFile(part.id)} />
          </div>
        }
      />
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-2xl font-bold">What it does</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-lg">
          {part.does.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-3xl font-bold">Pages</h2>
        <div
          className={`grid grid-cols-1 gap-3 ${pages.length % 3 === 0 ? "md:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {pages.map((item) => {
            const page = part.pages.find((entry) => pagePath(part.id, entry.slug) === item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col gap-1 rounded-lg border bg-card p-5 hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center justify-between gap-2 text-xl font-bold">
                  {item.label}
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </span>
                <span className="text-base text-muted-foreground">
                  <Inline
                    text={page?.summary ?? `Every ${part.name} release, each on its own page.`}
                  />
                </span>
              </Link>
            )
          })}
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
        <span className="mt-1 flex shrink-0 flex-wrap justify-end gap-1">
          {fn.usedByViz && <Badge variant="secondary">GTFS Viz</Badge>}
          <Badge variant="outline">{kindLabel[fn.kind]}</Badge>
        </span>
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

const groupOf = (fn: GtfsFunction) => functionGroups.find((group) => group.id === fn.group)!
const inGroup = (group: FunctionGroup) => functions.filter((fn) => fn.group === group.id)

function FunctionSearch() {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? functions.filter(
        (fn) =>
          fn.name.toLowerCase().includes(needle) || fn.description.toLowerCase().includes(needle),
      )
    : []
  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${functions.length} functions`}
        aria-label="Search functions"
        className="h-9 w-full rounded-md border bg-background px-3 text-lg sm:w-80"
      />
      {needle && (
        <ul className="space-y-1">
          {matches.length === 0 && (
            <li className="text-lg text-muted-foreground">No functions match “{query}”.</li>
          )}
          {matches.map((fn) => (
            <li key={fn.name}>
              <Link
                to={`${functionsPath(fn.group)}#${fn.name}`}
                className="flex flex-wrap items-baseline gap-2 rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground"
              >
                <code className="font-bold">{fn.name}</code>
                <span className="text-sm text-muted-foreground">{groupOf(fn).title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FunctionsOverview() {
  return (
    <div className="space-y-5">
      <FunctionSearch />
      <div className="grid gap-3 sm:grid-cols-2">
        {functionGroups.map((group) => (
          <div key={group.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
            <Link
              to={functionsPath(group.id)}
              className="flex items-center justify-between text-2xl font-bold hover:underline"
            >
              <span>
                {group.title}{" "}
                <span className="text-lg text-muted-foreground">{inGroup(group).length}</span>
              </span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <p className="text-lg text-muted-foreground">
              <Inline text={group.body} />
            </p>
            {group.categories.length > 1 && (
              <div className="mt-auto flex flex-wrap gap-1">
                {group.categories.map((category) => (
                  <Link
                    key={category.id}
                    to={`${functionsPath(group.id)}#category-${category.id}`}
                    className="rounded-2xl border px-2 py-0.5 text-base hover:bg-accent hover:text-accent-foreground"
                  >
                    {category.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-base text-muted-foreground">
        {internalCount} more functions are internal: caches, map bounds and filter menus for GTFS
        Viz's maps, and helpers behind other functions. They are not covered here.
      </p>
    </div>
  )
}

const currentHash = () => decodeURIComponent(window.location.hash.slice(1))

function FunctionGroupView({ group }: { group: FunctionGroup }) {
  const [hash, setHash] = useState(currentHash)
  useEffect(() => {
    const onHash = () => setHash(currentHash())
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  useEffect(() => {
    if (hash) document.getElementById(hash)?.scrollIntoView()
  }, [hash])
  const list = inGroup(group)
  const multiple = group.categories.length > 1
  return (
    <div className="space-y-6">
      {multiple && (
        <OnThisPage
          items={group.categories.map((category) => ({
            id: `category-${category.id}`,
            title: category.title,
          }))}
        />
      )}
      {group.categories.map((category) => {
        const rows = list.filter((fn) => fn.category === category.id)
        return (
          <section
            key={category.id}
            id={`category-${category.id}`}
            className="scroll-mt-4 space-y-2"
          >
            {multiple && (
              <div>
                <h2 className="text-3xl font-bold">
                  {category.title}{" "}
                  <span className="text-xl text-muted-foreground">{rows.length}</span>
                </h2>
                <p className="text-lg text-muted-foreground">
                  <Inline text={category.body} />
                </p>
              </div>
            )}
            {rows.map((fn) => (
              <FunctionRow key={fn.name} fn={fn} open={hash === fn.name} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function FunctionGroupPage({ part, group }: { part: Part; group: FunctionGroup }) {
  const functionsPage = part.pages.find((page) => page.slug === "functions")!
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { label: "Docs", to: docsBase },
          { label: part.name, to: partPath(part.id) },
          { label: functionsPage.title, to: functionsPath() },
          { label: group.title },
        ]}
        title={group.title}
        subtitle={<Inline text={group.body} />}
        actions={<MarkdownBar text={groupMarkdown(group)} file={groupFile(group.id)} />}
      />
      <FunctionGroupView group={group} />
      <PageNav part={part} current={functionsPath(group.id)} />
    </div>
  )
}

function SectionView({ section, depth }: { section: Section; depth: number }) {
  const Heading = depth === 0 ? "h2" : "h3"
  return (
    <section
      id={section.id}
      className={`scroll-mt-4 space-y-3 ${depth > 0 ? "rounded-lg border bg-card p-4" : ""}`}
    >
      <Heading className={depth === 0 ? "text-3xl font-bold" : "text-2xl font-bold"}>
        {section.title}
      </Heading>
      {section.blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
      {section.sub && (
        <div className="grid grid-cols-1 gap-3">
          {section.sub.map((child) => (
            <SectionView key={child.id} section={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </section>
  )
}

function Sections({ page }: { page: DocPage }) {
  return (
    <>
      {page.sections.length > 2 && <OnThisPage items={page.sections} />}
      {page.sections.map((section) => (
        <SectionView key={section.id} section={section} depth={0} />
      ))}
    </>
  )
}

function DocPageView({ part, page }: { part: Part; page: DocPage }) {
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
          <MarkdownBar text={pageMarkdown(part, page)} file={pageFile(part.id, page.slug)} />
        }
      />
      <div className="space-y-8">
        {page.slug === "functions" && <FunctionsOverview />}
        <Sections page={page} />
      </div>
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
        actions={<MarkdownBar text={releasesMarkdown(part)} file={`${part.id}/releases.md`} />}
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
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Docs", to: docsBase }, { label: agentPage.title }]}
        title={agentPage.title}
        subtitle={<Inline text={agentPage.summary} />}
        actions={<MarkdownBar text={agentMarkdown()} file={agentFile} />}
      />
      <div className="space-y-8">
        <Sections page={agentPage} />
      </div>
    </div>
  )
}

function UpcomingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Docs", to: docsBase }, { label: upcoming.title }]}
        title={upcoming.title}
        subtitle={upcoming.summary}
        actions={<MarkdownBar text={upcomingMarkdown()} file={upcomingFile} />}
      />
      <div className="grid grid-cols-1 gap-3">
        {upcoming.features.map((feature) => (
          <section
            key={feature.id}
            id={feature.id}
            className="flex scroll-mt-4 flex-col-reverse items-start gap-2 rounded-lg border bg-card p-5 sm:flex-row sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                {feature.title}
              </h2>
              <p className="mt-1 text-lg text-muted-foreground">{feature.description}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {feature.category}
            </Badge>
          </section>
        ))}
      </div>
      <section className="space-y-3 rounded-lg border bg-card p-5 text-center">
        <p className="text-lg text-muted-foreground">{upcoming.ideas}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <a href={upcoming.discussions} target="_blank" rel="noopener noreferrer">
              <MessageSquare />
              Share Your Ideas
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={upcoming.issues} target="_blank" rel="noopener noreferrer">
              <BiLogoGithub />
              Report Bug
            </a>
          </Button>
        </div>
      </section>
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

type TreeNode = {
  to: string
  label: string
  hint?: string
  scroll?: boolean
  children?: TreeNode[]
}

const sectionNode = (to: string, section: Section): TreeNode => ({
  to: `${to}#${section.id}`,
  label: section.title,
  children: section.sub?.map((child) => sectionNode(to, child)),
})

function pageChildren(to: string, page: DocPage): TreeNode[] {
  if (page.slug === "functions") {
    return functionGroups.map((group) => ({
      to: functionsPath(group.id),
      label: group.title,
      children:
        group.categories.length > 1
          ? group.categories.map((category) => ({
              to: `${functionsPath(group.id)}#category-${category.id}`,
              label: category.title,
            }))
          : undefined,
    }))
  }
  return page.sections.map((section) => sectionNode(to, section))
}

function partTree(part: Part): TreeNode[] {
  return [
    { to: partPath(part.id), label: "Overview" },
    ...part.pages.map((page) => {
      const to = pagePath(part.id, page.slug)
      return { to, label: page.title, children: pageChildren(to, page) }
    }),
    {
      to: releasesPath(part.id),
      label: "Releases",
      scroll: true,
      children: releasesFor(part.id).map((release) => ({
        to: releasePath(release),
        label: versionLabel(release),
        hint: release.title,
      })),
    },
  ]
}

const agentNode: TreeNode = {
  to: agentPath,
  label: agentPage.title,
  children: pageChildren(agentPath, agentPage),
}

const upcomingNode: TreeNode = {
  to: upcomingPath,
  label: upcoming.title,
  children: upcoming.features.map((feature) => ({
    to: `${upcomingPath}#${feature.id}`,
    label: feature.title,
  })),
}

const contains = (node: TreeNode, location: string): boolean =>
  node.to === location || (node.children ?? []).some((child) => contains(child, location))

function TreeItem({
  node,
  current,
  location,
  depth,
  onLeaf,
}: {
  node: TreeNode
  current: string
  location: string
  depth: number
  onLeaf?: () => void
}) {
  const within = (!node.to.includes("#") && current.startsWith(node.to)) || contains(node, location)
  const active = node.to.includes("#") ? location === node.to : current === node.to
  const [open, setOpen] = useState(within)
  useEffect(() => {
    setOpen(within)
  }, [within])
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    const box = list.current
    const item = box?.querySelector<HTMLElement>("[aria-current=page]")
    if (!box || !item || !node.scroll) return
    const top = item.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + item.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2 + item.offsetHeight / 2
    }
  }, [open, location, node.scroll])
  const children = node.children ?? []
  return (
    <li>
      <div className="flex items-center gap-1">
        <Link
          to={node.to}
          onSelect={() => (node.children?.length ? setOpen(true) : onLeaf?.())}
          aria-current={active ? "page" : undefined}
          className={`${linkClass(active)} min-w-0 flex-1 ${depth > 0 ? "py-0.5 text-base" : ""}`}
        >
          <span className="block truncate" title={node.hint ?? node.label}>
            {node.label}
            {node.hint && <span className="ml-2 text-sm text-muted-foreground">{node.hint}</span>}
          </span>
        </Link>
        {children.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
            onClick={() => setOpen(!open)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronRight
              className={`h-4 w-4 motion-safe:transition-transform ${open ? "rotate-90" : ""}`}
            />
          </button>
        )}
      </div>
      {open && children.length > 0 && (
        <ul
          ref={list}
          className={`ml-3 mt-0.5 flex flex-col gap-0.5 border-l pl-2 text-muted-foreground ${node.scroll ? "max-h-44 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]" : ""}`}
        >
          {children.map((child) => (
            <TreeItem
              key={child.to}
              node={child}
              current={current}
              location={location}
              depth={depth + 1}
              onLeaf={onLeaf}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function DocsNav({
  current,
  location,
  onLeaf,
}: {
  current: string
  location: string
  onLeaf?: () => void
}) {
  return (
    <nav className="flex flex-col gap-4 text-lg" aria-label="Docs">
      <Link
        to={docsBase}
        onSelect={onLeaf}
        aria-current={current === docsBase ? "page" : undefined}
        className={linkClass(current === docsBase)}
      >
        Home
      </Link>
      {parts.map((part) => (
        <div key={part.id} className="flex flex-col gap-0.5">
          <Link
            to={partPath(part.id)}
            onSelect={onLeaf}
            className="px-3 pb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            {part.name}
          </Link>
          <ul className="flex flex-col gap-0.5">
            {partTree(part).map((node) => (
              <TreeItem
                key={node.to}
                node={node}
                current={current}
                location={location}
                depth={0}
                onLeaf={onLeaf}
              />
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-col gap-0.5">
        <span className="px-3 pb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          AI agents
        </span>
        <ul>
          <TreeItem
            node={agentNode}
            current={current}
            location={location}
            depth={0}
            onLeaf={onLeaf}
          />
        </ul>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="px-3 pb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Roadmap
        </span>
        <ul>
          <TreeItem
            node={upcomingNode}
            current={current}
            location={location}
            depth={0}
            onLeaf={onLeaf}
          />
        </ul>
      </div>
    </nav>
  )
}

function Sidebar({ current, location }: { current: string; location: string }) {
  return (
    <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] w-64 shrink-0 overflow-y-auto overscroll-contain pb-6 pr-3 [scrollbar-gutter:stable] [scrollbar-width:thin] lg:block">
      <Link to={docsBase} className="text-3xl font-bold">
        GTFS 🚉 Tools
      </Link>
      <p className="text-muted-foreground">Docs</p>
      <div className="mt-4">
        <DocsNav current={current} location={location} />
      </div>
    </aside>
  )
}

function MobileMenu({ current, location }: { current: string; location: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => dialog.current?.close()
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const onChange = () => media.matches && dialog.current?.close()
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])
  return (
    <>
      <Button
        variant="icon"
        className="lg:hidden"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          dialog.current?.showModal()
          setOpen(true)
        }}
      >
        <Menu />
      </Button>
      <dialog
        ref={dialog}
        aria-label="Docs menu"
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === dialog.current && close()}
        className="m-0 h-dvh max-h-dvh w-80 max-w-[85vw] border-r bg-background p-0 text-foreground backdrop:bg-black/50"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <span className="text-2xl font-bold">GTFS 🚉 Tools</span>
            <Button variant="icon" aria-label="Close menu" onClick={close}>
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-4">
            {open && <DocsNav current={current} location={location} onLeaf={close} />}
          </div>
        </div>
      </dialog>
    </>
  )
}

export default function App() {
  const raw = usePathname()
  const pathname = raw.endsWith("/") ? raw : `${raw}/`
  const route = resolve(pathname)
  const current = route.kind === "page" ? pagePath(route.part.id, route.page.slug) : pathname
  const hash = useHash()
  const location = `${current}${hash}`
  useEffect(() => {
    document.title = titleFor(route)
  }, [route])
  const page = (() => {
    switch (route.kind) {
      case "home":
        return <HomePage />
      case "agents":
        return <AgentsPage />
      case "upcoming":
        return <UpcomingPage />
      case "part":
        return <PartPage key={route.part.id} part={route.part} />
      case "group":
        return <FunctionGroupPage key={route.group.id} part={route.part} group={route.group} />
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
      <Sidebar current={current} location={location} />
      <main className="min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Link to={docsBase} className="text-2xl font-bold lg:invisible">
            GTFS 🚉 Tools
          </Link>
          <div className="flex gap-2">
            <ThemeSwitcher />
            <MobileMenu current={current} location={location} />
          </div>
        </div>
        {page}
        <footer className="pb-6 pt-6 text-center text-muted-foreground">
          MIT License · Gabriel AHN
        </footer>
      </main>
    </div>
  )
}
