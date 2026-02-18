import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
}

interface ChildTabsConfig {
  condition: (pathname: string) => boolean;
  tabs: TabItem[];
}

interface TabHeaderProps {
  tabs: TabItem[];
  className?: string;
  searchParams?: (prev: any) => any;
  customActiveCheck?: (pathname: string, tab: TabItem) => boolean;
  childTabs?: ChildTabsConfig[];
  size?: "default" | "small";
  exact?: boolean;
  includeSearch?: boolean;
}

export function TabHeader({
  tabs,
  className,
  searchParams = (prev) => prev,
  customActiveCheck,
  childTabs,
  size = "default",
  exact = true,
  includeSearch = false,
}: TabHeaderProps) {
  const location = useLocation();

  const sizeClasses = size === "small"
    ? "px-3 py-1.5 text-xs"
    : "px-4 py-2 text-sm";

  return (
    <>
      <div className={cn("flex items-center gap-2 border-b border-border", className)}>
        {tabs.map((tab) => {
          
          if (customActiveCheck) {
            const isActive = customActiveCheck(location.pathname, tab);
            return (
              <Link
                key={tab.value}
                to={tab.path}
                search={searchParams}
                resetScroll={false}
                className={cn(
                  "flex items-center gap-2 rounded-t-lg font-medium transition-colors hover:bg-accent/50 hover:text-foreground",
                  sizeClasses,
                  isActive
                    ? "bg-background border border-b-0 border-border font-semibold text-foreground"
                    : "text-foreground/70"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.value}
              to={tab.path}
              search={searchParams}
              resetScroll={false}
              activeOptions={{
                exact,
                includeSearch,
              }}
              className={cn(
                "flex items-center gap-2 rounded-t-lg font-medium transition-colors hover:bg-accent/50 hover:text-foreground",
                sizeClasses,
              )}
              activeProps={{
                className: cn(
                  "bg-background border border-b-0 border-border font-semibold text-foreground",
                  sizeClasses,
                ),
              }}
              inactiveProps={{
                className: cn(
                  "text-foreground/70",
                  sizeClasses,
                ),
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {}
      {childTabs?.map((childConfig, index) => {
        if (childConfig.condition(location.pathname)) {
          return (
            <TabHeader
              key={index}
              tabs={childConfig.tabs}
              searchParams={searchParams}
              size="small"
              className="mb-4"
              exact={exact}
              includeSearch={includeSearch}
            />
          );
        }
        return null;
      })}
    </>
  );
}
