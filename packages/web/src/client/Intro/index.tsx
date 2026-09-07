import ThemeSwitcher from "@/components/ui/ThemeSwitcher"
import FileImporter from "./FileImporter"
import UpcomingFeatures from "@/components/UpcomingFeatures"

import { GithubButton } from "@/components/contact"

function Intro() {
  return (
    <div className="flex min-h-screen w-screen flex-col items-center overflow-y-auto px-4 py-6 text-center sm:justify-center">
      <h1 className="text-6xl sm:text-[15vh]">GTFS 🚉 Viz</h1>
      <div className="flex gap-2 mb-[1vh]">
        <GithubButton />
        <ThemeSwitcher />
      </div>
      <FileImporter />
      <div className="mt-[2vh]">
        <UpcomingFeatures />
      </div>
    </div>
  )
}

export default Intro
