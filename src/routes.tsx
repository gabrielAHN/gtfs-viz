import { usePageViewContext } from "./context/combinedContext";
import { GhnWebsite } from "@/components/contact";
import SelectedStations from "./client/Stations/SelectedStations";
import AllStations from "@/client/Stations/AllStations";
import Header from "./client/Header";
import Export from "./client/Export";
import Intro from "./client/Intro";

const Routes: React.FC = () => {
  const { PageState } = usePageViewContext();

  switch (PageState) {
    case "intro":
      return <Intro />;
      
    case "export":
      return (
        <>
          <Header />
          <div className="p-4">
            <Export />
          </div>
        </>
      );

    case "dashboard":
      return (
        <>
          <Header />
          <div className="p-4">
            <AllStations />
            <GhnWebsite />
          </div>
        </>
      );

    case "stationView":
      return (
        <>
          <Header />
          <div className="p-4">
            <SelectedStations />
            <GhnWebsite />
          </div>
        </>
      );

    default:
      return null;
  }
};

export default Routes;
