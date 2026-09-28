import { useState } from "react"
import { BiLogoGithub } from "react-icons/bi"
import { ArrowUpRight, Bot, Check, Cloud, Copy, FileText, History, TrainFront } from "lucide-react"
import ThemeSwitcher from "@/components/ui/ThemeSwitcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildLink, goals, intro, parts, releasesFor, repos } from "./content"
import type { Part, Release } from "./content"
import { docsBase, fullMarkdown, partMarkdown } from "./markdown"

const goalIcons = [Cloud, Bot, TrainFront]
const visibleReleases = 4

const nav = [
  { id: "intro", label: "Intro" },
  { id: "goals", label: "Goals" },
  ...parts.map((part) => ({ id: part.id, label: part.name })),
  { id: "agents", label: "Agent docs" },
]

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
  variant = "outline",
}: {
  href: string
  label: string
  github?: boolean
  variant?: "outline" | "default" | "ghost"
}) {
  return (
    <Button variant={variant} size="sm" asChild>
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

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-background px-4 py-2 text-base">
      <code>{code}</code>
    </pre>
  )
}

function Overview({ part }: { part: Part }) {
  return (
    <div className="space-y-4">
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
            className="rounded-lg border bg-background p-4 hover:bg-accent hover:text-accent-foreground"
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
    </div>
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
              className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-lg hover:bg-accent hover:text-accent-foreground ${index === active ? "bg-accent text-accent-foreground font-bold" : ""}`}
            >
              <span className="w-5 shrink-0 text-muted-foreground">{index + 1}.</span>
              <span className="whitespace-nowrap md:whitespace-normal">{item.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="space-y-3">
        <h4 className="text-2xl font-bold">
          {active + 1}. {step.title}
        </h4>
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

function ReleaseRow({ release }: { release: Release }) {
  const link = buildLink(release)
  return (
    <li className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[9rem_1fr_auto]">
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
        <ExternalButton href={link.href} label={link.label} />
      </div>
    </li>
  )
}

function Releases({ part }: { part: Part }) {
  const [expanded, setExpanded] = useState(false)
  const list = releasesFor(part.id)
  const shown = expanded ? list : list.slice(0, visibleReleases)
  return (
    <div>
      <ul className="divide-y">
        {shown.map((release) => (
          <ReleaseRow key={release.version} release={release} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
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
        <ExternalButton href={`${part.repo}/releases`} label="All releases" github />
      </div>
    </div>
  )
}

function Markdown({ part }: { part: Part }) {
  const text = partMarkdown(part)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label="Copy markdown" />
        <ExternalButton href={`${docsBase}${part.id}.md`} label={`${part.id}.md`} />
      </div>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-background px-4 py-3 text-base">
        {text}
      </pre>
    </div>
  )
}

function PartSection({ part }: { part: Part }) {
  return (
    <section id={part.id} className="scroll-mt-6 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-4xl font-bold">{part.name}</h2>
          <p className="text-lg text-muted-foreground">{part.tagline}</p>
        </div>
        <ExternalButton
          href={part.repo}
          label={part.repo.replace("https://github.com/", "")}
          github
        />
      </div>
      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview" className="text-base">
            Overview
          </TabsTrigger>
          <TabsTrigger value="how-to" className="text-base">
            How to
          </TabsTrigger>
          <TabsTrigger value="releases" className="text-base">
            Releases
          </TabsTrigger>
          <TabsTrigger value="markdown" className="text-base">
            <FileText className="mr-1 h-4 w-4" />
            Markdown
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Overview part={part} />
        </TabsContent>
        <TabsContent value="how-to" className="mt-4">
          <HowTo part={part} />
        </TabsContent>
        <TabsContent value="releases" className="mt-2">
          <Releases part={part} />
        </TabsContent>
        <TabsContent value="markdown" className="mt-4">
          <Markdown part={part} />
        </TabsContent>
      </Tabs>
    </section>
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
          <p className="mx-auto max-w-3xl text-xl">{intro}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <a href={repos.app}>Open the web app</a>
            </Button>
            {parts.map((part) => (
              <Button key={part.id} variant="outline" asChild>
                <a href={`#${part.id}`}>{part.name}</a>
              </Button>
            ))}
            <Button variant="outline" asChild>
              <a href="#agents">
                <Bot />
                Agent docs
              </a>
            </Button>
          </div>
        </header>

        <section id="goals" className="scroll-mt-6 space-y-4">
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

        {parts.map((part) => (
          <PartSection key={part.id} part={part} />
        ))}

        <section id="agents" className="scroll-mt-6 rounded-lg border bg-card p-5">
          <h2 className="flex items-center gap-2 text-4xl font-bold">
            <Bot className="h-8 w-8" />
            Agent docs
          </h2>
          <p className="text-lg text-muted-foreground">
            The same docs as plain markdown for AI agents. Point an agent at{" "}
            <code className="rounded bg-muted px-1">{docsBase}llms.txt</code> or paste the full file
            into its context.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={fullMarkdown()} label="Copy all docs" />
            <ExternalButton href={`${docsBase}llms.txt`} label="llms.txt" />
            <ExternalButton href={`${docsBase}llms-full.txt`} label="llms-full.txt" />
            {parts.map((part) => (
              <ExternalButton
                key={part.id}
                href={`${docsBase}${part.id}.md`}
                label={`${part.id}.md`}
              />
            ))}
          </div>
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
