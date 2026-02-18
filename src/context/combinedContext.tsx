
export { useDuckDB } from "./duckdb.client";
export { useThemeContext } from "./theme.client";

export const usePageViewContext = () => {
  throw new Error("usePageViewContext has been removed. Use TanStack Router instead.");
};

export const useStationViewContext = () => {
  throw new Error("useStationViewContext has been removed. Pass station data as props instead.");
};
