import { createRootRoute, Outlet } from "@tanstack/react-router";
import { DuckDBProvider, useDuckDB } from "@/context/duckdb.client";
import { ThemeProvider } from "@/context/theme.client";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import CliQueryBridge from "@/lib/cli/CliQueryBridge";
import "@/styles/index.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <DuckDBProvider>
      <ThemeProvider>
        <RouterOutlet />
      </ThemeProvider>
    </DuckDBProvider>
  );
}

function RouterOutlet() {
  const duckdb = useDuckDB();
  const isLoading = duckdb?.loading ?? false;

  return (
    <>
      <LoadingOverlay
        isVisible={(duckdb?.isResetting ?? false) || isLoading}
        message={duckdb?.loadingMessage || "Processing..."}
        subMessage={duckdb?.loadingSubMessage || ""}
      />
      <CliQueryBridge />
      {!isLoading && <Outlet context={{ duckdb }} />}
    </>
  );
}
