
import { Import, File } from 'lucide-react';
import { usePageViewContext } from "@/context/combinedContext";

import HeaderNavigation from "@/components/header/headerNavigation";
import HeaderDrawer from "@/components/header/HeaderDrawer";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";

function Header() {
  const { setPageState } = usePageViewContext();

  const TabData = [
    {
      label: "GTFS Data",
      pages: [
        {
          title: "Stations",
          label: "Stations",
          icon: () => {
            return <div className="text-2xl">🚉</div>;
          },
          clickFunction: () => {
            setPageState("dashboard");
          },
          description:
            "Easily check out and edit GTFS Station(s) data.",
        },
      ]
    },
    {
      label: "Import/Export",
      pages:[
      {
        title: "Import",
        label: "Import",
        icon: Import,
        clickFunction: () => {
          window.location.reload();
        },
        description:
          "Import a GTFS file to get started.",
      },
      {
        title: "Export",
        label: "Export",
        icon: File,
        clickFunction: () => {
          setPageState("export");
        },
        description:
          "See the edited data and export the file.",
      },
    ]
    },
  ];

  return (
    <div className="flex mb-1 m-4 items-center justify-between flex-wrap">
      <h1 className="text-2xl font-bold mb-1 mr-10">Station 🚉 Viz</h1>
      <div className="">
        <div className="flex sm:hidden justify-between items-center space-x-4">
          <ThemeSwitcher/>
          <HeaderDrawer TabList={TabData} />
        </div>
        <div className="hidden sm:flex items-center">
          <ThemeSwitcher className={"mr-2"}/>
          <HeaderNavigation TabList={TabData} />
        </div>
      </div>
    </div>
  );
}
export default Header;
