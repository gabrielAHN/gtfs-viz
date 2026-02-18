import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import FileImporter from "./FileImporter";
import UpcomingFeatures from "@/components/UpcomingFeatures";

import { GithubButton } from "@/components/contact";
import DuckdbIcon from "@/assets/DuckdbIcon.svg";

function Intro() {
  return (
    <div className="flex flex-col items-center justify-center text-center w-screen h-screen">
      <h1 className="text-[15vh]">GTFS 🚉 Viz</h1>
      <div className="flex gap-2 mb-[1vh]">
        <GithubButton />
        <ThemeSwitcher />
      </div>
      <FileImporter />
      <div className="mt-[2vh]">
        <UpcomingFeatures />
      </div>
    </div>
  );
}

export default Intro;
