import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useDuckDB } from "@/context/duckdb.client";
import { useCallback, useMemo, useState } from "react";
import { logger } from "@/lib/logger";
import { BiImport, BiMap, BiTable, BiMenu } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import ThemeSwitcher from "@/components/ui/ThemeSwitcher";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function Header() {
  const router = useRouter();
  const routerState = useRouterState();
  const duckDB = useDuckDB();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPath = routerState.location.pathname;
  const currentSearch = routerState.location.search as any;

  const hasStations = duckDB?.hasStations ?? false;
  const hasStops = duckDB?.hasStops ?? false;
  const hasRoutes = duckDB?.hasRoutes ?? false;
  const hasShapes = duckDB?.hasShapes ?? false;
  const hasTrips = duckDB?.hasTrips ?? false;
  const hasStopTimes = duckDB?.hasStopTimes ?? false;
  const isResetting = duckDB?.isResetting ?? false;
  const isCliLaunch = duckDB?.isCliLaunch ?? false;

  const isRoutesActive = currentPath.startsWith("/routes");
  const isTripsActive = currentPath.startsWith("/trips");
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
        logger.error("Error resetting database:", error);
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

  const navigationGroups = useMemo(() => {
    const stationsViews = [
      { id: "map", label: "Map", icon: Map, path: "/stations/map" },
      { id: "table", label: "Table", icon: BiTable, path: "/stations/table" },
    ];
    const stopsViews = [
      { id: "map", label: "Map", icon: Map, path: "/stops/map" },
      { id: "table", label: "Table", icon: BiTable, path: "/stops/table" },
    ];
    const routesViews = [
      ...(hasShapes ? [{ id: "map", label: "Map", icon: Map, path: "/routes/map" }] : []),
      { id: "table", label: "Table", icon: BiTable, path: "/routes/table" },
    ];
    return [
      {
        id: "routes",
        label: "Routes",
        icon: "🚌",
        enabled: hasRoutes,
        active: isRoutesActive,
        defaultPath: hasShapes ? "/routes/map" : "/routes/table",
        disabledText: "No routes in the file",
        views: routesViews,
        search: { selectedRouteId: currentSearch?.selectedRouteId },
      },
      {
        id: "trips",
        label: "Trips",
        icon: "🚍",
        enabled: hasTrips,
        active: isTripsActive,
        defaultPath: "/trips/table",
        disabledText: "No trips in the file",
        views: [],
        search: { selectedTripId: currentSearch?.selectedTripId },
      },
      {
        id: "stations",
        label: "Stations",
        icon: "🚉",
        enabled: hasStations,
        active: isStationsActive,
        defaultPath: "/stations/map",
        disabledText: "No stations in the file",
        views: stationsViews,
        search: { selectedStationId: currentSearch?.selectedStationId },
      },
      {
        id: "stops",
        label: "Stops",
        icon: "🚏",
        enabled: hasStops,
        active: isStopsActive,
        defaultPath: "/stops/map",
        disabledText: "No stops in the file",
        views: stopsViews,
        search: { selectedStopId: currentSearch?.selectedStopId },
      },
    ];
  }, [hasShapes, hasRoutes, hasTrips, hasStopTimes, hasStations, hasStops,
      isRoutesActive, isTripsActive, isStationsActive, isStopsActive,
      currentSearch?.selectedRouteId, currentSearch?.selectedTripId,
      currentSearch?.selectedStationId, currentSearch?.selectedStopId]);

  return (
    <>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] sm:w-[320px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-xl">🚉</span>
              </div>
              <span className="text-lg font-bold text-foreground">GTFS Viz</span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-6">
            {!isCliLaunch && (
              <>
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
              </>
            )}

            <div>
              <h3 className="mb-2 px-2 text-xs font-medium text-muted-foreground">Navigation</h3>
              <div className="flex flex-col gap-2">
                {navigationGroups.map((group) => (
                  <div key={group.id}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            to={group.enabled ? group.defaultPath : "#"}
                            search={group.enabled ? group.search : undefined}
                            onClick={(event) => {
                              if (!group.enabled) {
                                event.preventDefault();
                              } else {
                                handleNavigate();
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              !group.enabled && "cursor-not-allowed opacity-50",
                              group.active && group.enabled
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted",
                            )}
                          >
                            <span>{group.icon}</span>
                            <span>{group.label}</span>
                          </Link>
                        </TooltipTrigger>
                        {!group.enabled && (
                          <TooltipContent>
                            <p>{group.disabledText}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>

                    {group.enabled && group.views.length > 0 && (
                      <div className="ml-6 mt-1 flex flex-col gap-1">
                        {group.views.map((view) => {
                          const ViewIcon = view.icon;
                          const isActive = currentPath === view.path;

                          return (
                            <Link
                              key={view.id}
                              to={view.path}
                              search={group.search}
                              onClick={handleNavigate}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                                isActive
                                  ? "bg-primary/10 font-medium text-primary"
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
                ))}

                <Link
                  to="/export"
                  onClick={handleNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isExportActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
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
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-2xl">🚉</span>
              </div>
              <h1 className="text-xl font-bold text-foreground">GTFS Viz</h1>
            </div>
            <div className="flex items-center gap-2">
              {!isCliLaunch && (
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
              )}
              <div className="ml-2 pl-2">
                <ThemeSwitcher />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 h-8 w-8 sm:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <BiMenu className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="hidden pt-3 sm:block">
            <TooltipProvider>
              <div className="flex items-center gap-1">
                {navigationGroups.map((group) => (
                  <div key={group.id} className="group relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {group.enabled ? (
                          <Link
                            to={group.defaultPath}
                            search={group.search}
                            className={cn(
                              "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
                              group.active
                                ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                                : "bg-muted/50 text-muted-foreground hover:bg-primary/80 hover:text-primary-foreground",
                            )}
                          >
                            <span className="mr-1.5">{group.icon}</span>
                            {group.label}
                          </Link>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex h-10 cursor-not-allowed items-center justify-center whitespace-nowrap rounded-md bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground opacity-50",
                            )}
                          >
                            <span className="mr-1.5">{group.icon}</span>
                            {group.label}
                          </span>
                        )}
                      </TooltipTrigger>
                      {!group.enabled && (
                        <TooltipContent>
                          <p>{group.disabledText}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>

                    {group.enabled && group.views.length > 0 && (
                      <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                        <ul className="grid w-[200px] gap-2 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
                          {group.views.map((view) => {
                            const ViewIcon = view.icon;

                            return (
                              <li key={view.id}>
                                <Link
                                  to={view.path}
                                  search={group.search}
                                  activeOptions={{
                                    exact: false,
                                    includeSearch: false,
                                  }}
                                  className={cn(
                                    "flex select-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                                    "hover:bg-primary/80 hover:text-primary-foreground focus:bg-primary/80 focus:text-primary-foreground",
                                  )}
                                  activeProps={{
                                    className: cn(
                                      "flex select-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors",
                                      "bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90",
                                    ),
                                  }}
                                >
                                  <ViewIcon className="h-4 w-4" />
                                  <span>{view.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                <Link
                  to="/export"
                  className={cn(
                    "inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    isExportActive
                      ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                      : "bg-muted/50 text-muted-foreground hover:bg-primary/80 hover:text-primary-foreground",
                  )}
                >
                  <span className="mr-1.5">📁</span>
                  Export
                </Link>
              </div>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </>
  );
}

export default Header;
