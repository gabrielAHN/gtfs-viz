import ThemeSwitcher from "@/components/ui/ThemeSwitcher"
import FileImporter from "./FileImporter"

import { DocsButton, GithubButton } from "@/components/contact"

function Intro() {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center overflow-y-auto px-4 py-6 text-center">
      <h1 className="text-6xl sm:text-[15vh]">GTFS 🚉 Viz</h1>
      <div className="flex gap-2 mb-[1vh]">
        <GithubButton />
        <DocsButton />
        <ThemeSwitcher />
      </div>
      <FileImporter />
    </div>
  )
}

export default Intro
