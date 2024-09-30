import { usePageViewContext } from "./context/combinedContext";
import SelectedStations from "./client/Stations/SelectedStations/main";
import AllStations from "@/client/Stations/AllStations/main";
import Header from "./client/Header/Header";
import Intro from "./client/Intro/main";
import "./App.css";

function Routes() {
  const { PageState } = usePageViewContext();


  switch (PageState) {
    case "intro":
      return (
      <Intro />
      );
    case "dashboard":
      return (
        <>
          <Header />
          <AllStations />
          <div className="flex justify-center m-4">
            <a href="/" className="hover:text-yellow-400">
              Created by gabrielhn.com
            </a>
          </div>
        </>
      );
    case "stationView":
      return (
        <>
          <Header />
          <SelectedStations />
          <div className="flex justify-center m-4">
            <a href="/" className="hover:text-yellow-400">
              Created by gabrielhn.com
            </a>
          </div>
        </>
      );
  }
}

export default Routes;
