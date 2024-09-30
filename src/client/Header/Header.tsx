import { usePageViewContext } from "@/context/combinedContext";

function Header() {
  const { setPageState } = usePageViewContext();

  const HeaderTabs = [
    {
      name: "Stations",
      path: "dashboard",
      clickFunction: () => {
        setPageState("dashboard");
      },
    },
    {
      name: "New Upload",
      path: "intro",
      clickFunction: () => {
        window.location.reload();
      },
    },
  ];

  return (
    <div className="flex mb-1 m-4 items-center justify-between flex-wrap">
      <h1 className="text-2xl font-bold mb-1 mr-4">Station 🚉 Viz</h1>
      <div className="flex space-x-4">
        {HeaderTabs.map((tab) => (
          <button
            key={tab.name}
            className="hover:text-blue-500"
            onClick={tab.clickFunction}
          >
            {tab.name}
          </button>
        ))}
      </div>
    </div>
  );
}
export default Header;
