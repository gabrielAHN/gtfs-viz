import {
  Link,
  useRouter,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useDuckDB } from "@/context/duckdb.client";
import { useCallback, useState } from "react";
import { BiImport, BiMap, BiTable, BiMenu } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const VIEW_TYPES = [
  { id: "map", label: "Map", icon: BiMap, path: "/map" },
  { id: "table", label: "Table", icon: BiTable, path: "/table" },
];

function Header() {
  const router = useRouter();
  const routerState = useRouterState();
  const navigate = useNavigate();
  const duckDB = useDuckDB();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPath = routerState.location.pathname;
  const currentSearch = routerState.location.search as any;

  const hasStations = duckDB?.hasStations ?? false;
  const hasStops = duckDB?.hasStops ?? false;
  const isResetting = duckDB?.isResetting ?? false;

  const isStationsActive = currentPath.startsWith("/stations");
  const isStopsActive = currentPath.startsWith("/stops");
  const isExportActive = currentPath.startsWith("/export");

  const handleImport = useCallback(async () => {
    if (isResetting || !duckDB) return;

    duckDB.setIsResetting(true);
    duckDB.setLoadingMessage("Resetting database...");
    duckDB.setLoadingSubMessage("Clearing all data and preparing for import");

    if (duckDB.resetDb) {
      try {
        await duckDB.resetDb();
      } catch (error) {
        console.error("Error resetting database:", error);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    duckDB.setLoadingMessage("Redirecting...");
    duckDB.setLoadingSubMessage("");
    await new Promise((resolve) => setTimeout(resolve, 200));

    router.navigate({ to: "/" });

    setTimeout(() => {
      duckDB.setIsResetting(false);
      duckDB.setLoadingMessage("");
      duckDB.setLoadingSubMessage("");
    }, 500);
  }, [isResetting, duckDB, router]);

  const handleNavigate = () => {
    setMobileMenuOpen(false);
  };

  const stationsViews = [
    { id: "map", label: "Map", icon: BiMap, path: "/stations/map" },
    { id: "table", label: "Table", icon: BiTable, path: "/stations/table" },
  ];

  const stopsViews = [
    { id: "map", label: "Map", icon: BiMap, path: "/stops/map" },
    { id: "table", label: "Table", icon: BiTable, path: "/stops/table" },
  ];

  return (
    <>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] sm:w-[320px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded-lg bg-primary/10 w-8 h-8">
                <span className="text-xl">🚉</span>
              </div>
              <span className="font-bold text-foreground text-lg">
                GTFS Viz
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-6">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                handleImport();
                handleNavigate();
              }}
              disabled={isResetting}
            >
              <BiImport className="mr-2 h-4 w-4" />
              {isResetting ? "Resetting..." : "Import Data"}
            </Button>

            <Separator />

            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2 px-2">
                Navigation
              </h3>
              <div className="flex flex-col gap-2">
                <div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to={hasStations ? "/stations/map" : "#"}
                          search={
                            hasStations
                              ? {
                                  selectedStationId:
                                    currentSearch?.selectedStationId,
                                }
                              : undefined
                          }
                          onClick={(e) => {
                            if (!hasStations) {
                              e.preventDefault();
                            } else {
                              handleNavigate();
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            !hasStations && "opacity-50 cursor-not-allowed",
                            isStationsActive && hasStations
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <span>🚉</span>
                          <span>Stations</span>
                        </Link>
                      </TooltipTrigger>
                      {!hasStations && (
                        <TooltipContent>
                          <p>No stations in the file</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  {hasStations && (
                    <div className="ml-6 mt-1 flex flex-col gap-1">
                      {VIEW_TYPES.map((view) => {
                        const ViewIcon = view.icon;
                        const targetPath = `/stations${view.path}`;
                        const isActive = currentPath === targetPath;

                        return (
                          <Link
                            key={view.id}
                            to={targetPath}
                            search={{
                              selectedStationId:
                                currentSearch?.selectedStationId,
                            }}
                            onClick={handleNavigate}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <ViewIcon className="h-4 w-4" />
                            <span>{view.label} View</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to={hasStops ? "/stops/map" : "#"}
                          search={
                            hasStops
                              ? {
                                  selectedStopId: currentSearch?.selectedStopId,
                                }
                              : undefined
                          }
                          onClick={(e) => {
                            if (!hasStops) {
                              e.preventDefault();
                            } else {
                              handleNavigate();
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            !hasStops && "opacity-50 cursor-not-allowed",
                            isStopsActive && hasStops
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <span>🚏</span>
                          <span>Stops</span>
                        </Link>
                      </TooltipTrigger>
                      {!hasStops && (
                        <TooltipContent>
                          <p>No stops in the file</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  {hasStops && (
                    <div className="ml-6 mt-1 flex flex-col gap-1">
                      {VIEW_TYPES.map((view) => {
                        const ViewIcon = view.icon;
                        const targetPath = `/stops${view.path}`;
                        const isActive = currentPath === targetPath;

                        return (
                          <Link
                            key={view.id}
                            to={targetPath}
                            search={{
                              selectedStopId: currentSearch?.selectedStopId,
                            }}
                            onClick={handleNavigate}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <ViewIcon className="h-4 w-4" />
                            <span>{view.label} View</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Link
                  to="/export"
                  onClick={handleNavigate}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isExportActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <span>📁</span>
                  <span>Export</span>
                </Link>
              </div>
            </div>

            <Separator />

            <div className="px-2">
              <ThemeSwitcher />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="bg-card shadow-sm">
        <div className="mx-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center justify-center rounded-lg bg-primary/10 w-10 h-10">
                <span className="text-2xl">🚉</span>
              </div>
              <h1 className="font-bold text-foreground text-xl">GTFS Viz</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleImport}
                disabled={isResetting}
                className="text-xs"
              >
                <BiImport className="mr-1.5 h-3.5 w-3.5" />
                {isResetting ? "Resetting..." : "Import"}
              </Button>
              <div className="ml-2 pl-2">
                <ThemeSwitcher />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8 ml-2"
                onClick={() => setMobileMenuOpen(true)}
              >
                <BiMenu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="pt-3 hidden sm:block">
            <TooltipProvider>
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavigationMenuTrigger
                          disabled={!hasStations}
                          onClick={() => {
                            if (hasStations) {
                              navigate({
                                to: "/stations/map",
                                search: {
                                  selectedStationId:
                                    currentSearch?.selectedStationId,
                                },
                              });
                            }
                          }}
                          className={cn(
                            "h-10 px-4 py-2 text-sm font-medium",
                            !hasStations && "opacity-50 cursor-not-allowed",
                            isStationsActive && hasStations
                              ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 data-[state=open]:bg-primary/90 data-[state=open]:text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-primary/80 hover:text-primary-foreground data-[state=open]:bg-primary/80 data-[state=open]:text-primary-foreground",
                          )}
                        >
                          <span className="mr-1.5">🚉</span>
                          Stations
                        </NavigationMenuTrigger>
                      </TooltipTrigger>
                      {!hasStations && (
                        <TooltipContent>
                          <p>No stations in the file</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    {hasStations && (
                      <NavigationMenuContent>
                        <ul className="grid w-[200px] gap-2 p-2">
                          {stationsViews.map((view) => {
                            const ViewIcon = view.icon;
                            return (
                              <li key={view.id}>
                                <NavigationMenuLink asChild>
                                  <Link
                                    to={view.path}
                                    search={{
                                      selectedStationId:
                                        currentSearch?.selectedStationId,
                                    }}
                                    activeOptions={{
                                      exact: false,
                                      includeSearch: false,
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 select-none rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                                      "hover:bg-primary/80 hover:text-primary-foreground focus:bg-primary/80 focus:text-primary-foreground",
                                    )}
                                    activeProps={{
                                      className: cn(
                                        "flex items-center gap-2 select-none rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                                        "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90",
                                      ),
                                    }}
                                  >
                                    <ViewIcon className="h-4 w-4" />
                                    <span>{view.label}</span>
                                  </Link>
                                </NavigationMenuLink>
                              </li>
                            );
                          })}
                        </ul>
                      </NavigationMenuContent>
                    )}
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavigationMenuTrigger
                          disabled={!hasStops}
                          onClick={() => {
                            if (hasStops) {
                              navigate({
                                to: "/stops/map",
                                search: {
                                  selectedStopId: currentSearch?.selectedStopId,
                                },
                              });
                            }
                          }}
                          className={cn(
                            "h-10 px-4 py-2 text-sm font-medium",
                            !hasStops && "opacity-50 cursor-not-allowed",
                            isStopsActive && hasStops
                              ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 data-[state=open]:bg-primary/90 data-[state=open]:text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-primary/80 hover:text-primary-foreground data-[state=open]:bg-primary/80 data-[state=open]:text-primary-foreground",
                          )}
                        >
                          <span className="mr-1.5">🚏</span>
                          Stops
                        </NavigationMenuTrigger>
                      </TooltipTrigger>
                      {!hasStops && (
                        <TooltipContent>
                          <p>No stops in the file</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    {hasStops && (
                      <NavigationMenuContent>
                        <ul className="grid w-[200px] gap-2 p-2">
                          {stopsViews.map((view) => {
                            const ViewIcon = view.icon;
                            return (
                              <li key={view.id}>
                                <NavigationMenuLink asChild>
                                  <Link
                                    to={view.path}
                                    search={{
                                      selectedStopId:
                                        currentSearch?.selectedStopId,
                                    }}
                                    activeOptions={{
                                      exact: false,
                                      includeSearch: false,
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 select-none rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                                      "hover:bg-primary/80 hover:text-primary-foreground focus:bg-primary/80 focus:text-primary-foreground",
                                    )}
                                    activeProps={{
                                      className: cn(
                                        "flex items-center gap-2 select-none rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                                        "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90",
                                      ),
                                    }}
                                  >
                                    <ViewIcon className="h-4 w-4" />
                                    <span>{view.label}</span>
                                  </Link>
                                </NavigationMenuLink>
                              </li>
                            );
                          })}
                        </ul>
                      </NavigationMenuContent>
                    )}
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <Link
                      to="/export"
                      className={cn(
                        "h-10 px-4 py-2 text-sm font-medium inline-flex items-center justify-center whitespace-nowrap rounded-md transition-colors",
                        isExportActive
                          ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                          : "bg-muted/50 text-muted-foreground hover:bg-primary/80 hover:text-primary-foreground",
                      )}
                    >
                      <span className="mr-1.5">📁</span>
                      Export
                    </Link>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </>
  );
}

export default Header;
