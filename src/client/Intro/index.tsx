import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import FileImporter from "./FileImporter";

import { GhnWebsite, GithubButton } from "@/components/contact";
import DuckdbIcon from '@/assets/DuckdbIcon.svg'

function Intro() {
  return (
    <div className="flex flex-col items-center justify-center text-center w-screen h-screen">
      <h1 className="text-[15vh]">GTFS 🚉 Viz</h1>
      <div className="flex gap-2">
        <GithubButton />
        <ThemeSwitcher />
      </div>
      <GhnWebsite />
      <FileImporter />
      <p className="flex items-center mt-[5vh]">
        Powered 🔌 by duckdb
        <a
          href="https://duckdb.org/docs/api/wasm/overview"
          target="_blank"
          className="ml-2"
        >
          <img src={DuckdbIcon} alt="DuckDB Icon" className="w-6 h-6" />
        </a>
      </p>
    </div>
  );
}

export default Intro;
