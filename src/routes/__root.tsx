import { createRootRoute, Outlet } from "@tanstack/react-router";
import { DuckDBProvider, useDuckDB } from "@/context/duckdb.client";
import { ThemeProvider } from "@/context/theme.client";
import { lazy, Suspense } from "react";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import "@/styles/index.css";

const TanStackRouterDevtools =
  import.meta.env.DEV
    ? lazy(() =>
        import("@tanstack/react-router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        }))
      )
    : () => null;

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <DuckDBProvider>
      <ThemeProvider>
        <RouterOutlet />
        {import.meta.env.DEV && (
          <Suspense>
            <TanStackRouterDevtools />
          </Suspense>
        )}
      </ThemeProvider>
    </DuckDBProvider>
  );
}

function RouterOutlet() {
  const duckdb = useDuckDB();

  return (
    <>
      <LoadingOverlay
        isVisible={duckdb?.isResetting ?? false}
        message={duckdb?.loadingMessage || "Processing..."}
        subMessage={duckdb?.loadingSubMessage || ""}
      />
      <Outlet context={{ duckdb }} />
    </>
  );
}
