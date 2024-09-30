import { IconButton } from "@mui/material";
import GitHubIcon from '@mui/icons-material/GitHub';
import FileImporter from "./FileImporter/main";

function Intro() {
  return (
    <div className="flex flex-col items-center justify-center text-center w-screen h-screen">
      <h1 className="text-[15vh]">GTFS 🚉 Viz</h1>
      <IconButton href='https://github.com/gabrielAHN/gtfs-viz.git' target='_blank'>
        <GitHubIcon />
      </IconButton>
      <a href="https://www.gabrielhn.com" target='_blank' 
        className="hover:text-yellow-400 relative mb-5" >
        Created by gabrielhn.com
      </a>
      <FileImporter />
      <p className="flex items-center mt-[5vh]">
      Powered 🔌 by duckdbwasm
      <a
        href="https://duckdb.org/docs/api/wasm/overview"
        target="_blank"
        className="ml-2"
      >
        <img
          src="https://raw.githubusercontent.com/duckdb/duckdb-wasm/main/misc/duckdb_wasm.svg"
          alt="duckdbwasm logo"
          className="h-6 w-auto"
        />
      </a>
    </p>
    </div>
  );
}

export default Intro;
