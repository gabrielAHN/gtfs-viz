import { Button } from "@/components/ui/button"
import { BiBookOpen, BiLogoGithub } from "react-icons/bi"
import { isCliSession } from "@/lib/cli/isCliSession"
import { DOCS_URL } from "@/lib/links"

export const GithubButton: React.FC = () => (
  <Button
    variant={"icon"}
    onClick={() => window.open("https://github.com/gabrielAHN/gtfs-viz.git", "_blank")}
  >
    <BiLogoGithub />
  </Button>
)

export const DocsButton: React.FC = () =>
  isCliSession() ? null : (
    <Button variant={"icon"} asChild>
      <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" aria-label="Docs" title="Docs">
        <BiBookOpen />
      </a>
    </Button>
  )
