import {
  createFileRoute,
  Outlet,
} from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchStationPathwaysComplete } from "@/lib/duckdb/DataFetching/pathways";
import { fetchPathwayMapRouteData } from "@/lib/duckdb/DataFetching/pathways/fetchPathwayMapRoute";
import PathwaysLoadingSkeleton from "@/client/Stations/SelectedStations/StationPathways/LoadingSkeleton";
import {
  FlowViewProvider,
  type FlowViewBaseProps,
} from "@/client/Stations/SelectedStations/StationPathways/FlowView";
import { getStopColor } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";
import { usePathwaysNavigate } from "./-usePathwaysNavigate";

type FlowSearchParams = {
  selectedStationId?: string;
  selectedNodeId?: string;
  selectedPathwayId?: string;
  fromStop?: string;
  toStop?: string;
  editTarget?: "node" | "pathway";
};

export const Route = createFileRoute("/_layout/stations/pathways/flow")({
  component: PathwaysFlowPage,
  validateSearch: (search: Record<string, unknown>): FlowSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      selectedNodeId: search.selectedNodeId as string | undefined,
      selectedPathwayId: search.selectedPathwayId as string | undefined,
      fromStop: search.fromStop as string | undefined,
      toStop: search.toStop as string | undefined,
      editTarget:
        search.editTarget === "node" || search.editTarget === "pathway"
          ? search.editTarget
          : undefined,
    };
  },
});

function PathwaysFlowPage() {
  const search = Route.useSearch();
  const navigate = usePathwaysNavigate();
  const { conn, initialized } = useDuckDB();
  const { theme } = useThemeContext();
  const [Open, setOpen] = useState<{ formType: string | null; state: boolean }>(
    { formType: null, state: false },
  );
  const [ClickInfo, setClickInfo] = useState<any>();

  const stationId = search.selectedStationId;

  const {
    data: pathwayDataComplete,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["stationPathwaysComplete", stationId],
    queryFn: async () => {
      if (!stationId) {
        throw new Error("No station ID provided");
      }

      return fetchStationPathwaysComplete({
        conn,
        StationView: { stop_id: stationId },
      });
    },
    enabled: !!conn && !!stationId && initialized,
    staleTime: Infinity,
    retry: false,
  });

  const selectedFromStop = search.fromStop;
  const selectedToStop = search.toStop;
  const requestedEditTarget = search.editTarget;
  const hasRouteEndpointFilters = Boolean(selectedFromStop || selectedToStop);

  const stopColorById = useMemo(() => {
    const map = new Map<string, string>();
    pathwayDataComplete?.stops?.forEach((stop: any) => {
      if (stop?.stop_id == null || stop?.location_type_name == null) {
        return;
      }

      map.set(
        String(stop.stop_id),
        rgbToHex(getStopColor(String(stop.location_type_name), theme)),
      );
    });
    return map;
  }, [pathwayDataComplete?.stops, theme]);

  const { data: procedureRouteFilterData } = useQuery({
    queryKey: [
      "stationPathwaysFlowRoute",
      stationId,
      selectedFromStop ?? "",
      selectedToStop ?? "",
    ],
    queryFn: async () => {
      if (!stationId) {
        throw new Error("No station ID provided");
      }

      const routeData = await fetchPathwayMapRouteData({
        conn,
        stationId,
        stops: pathwayDataComplete?.stops ?? [],
        fromStopId: selectedFromStop,
        toStopId: selectedToStop,
        includeNullTime: true,
      });

      return {
        fromStopOptions: routeData.availableFromStops.map((option) => ({
          id: option.value,
          label: option.value,
          color: stopColorById.get(option.value),
          searchLabel: option.label,
        })),
        toStopOptions: routeData.availableToStops.map((option) => ({
          id: option.value,
          label: option.value,
          color: stopColorById.get(option.value),
          searchLabel: option.label,
        })),
        filteredConnectionIds: routeData.filteredConnectionIds,
      };
    },
    enabled:
      !!conn &&
      !!stationId &&
      !!pathwayDataComplete &&
      initialized &&
      hasRouteEndpointFilters,
    staleTime: 0,
    retry: false,
  });

  const handleSelectedNodeIdChange = useCallback(
    (nodeId?: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          selectedNodeId: nodeId || undefined,
          selectedPathwayId: undefined,
          editTarget: undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleSelectedPathwayIdChange = useCallback(
    (pathwayId?: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          selectedNodeId: undefined,
          selectedPathwayId: pathwayId || undefined,
          editTarget: undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleSelectedFromStopChange = useCallback(
    (fromStop?: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          fromStop: fromStop || undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleSelectedToStopChange = useCallback(
    (toStop?: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          toStop: toStop || undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const handleRequestedEditTargetHandled = useCallback(() => {
    navigate({
      search: (prev) => ({
        ...prev,
        editTarget: undefined,
      }),
      replace: true,
    });
  }, [navigate]);

  if (!stationId) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          No station selected. Please select a station from the stations list.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <PathwaysLoadingSkeleton
        headerClassName="h-10"
        contentClassName="h-[calc(100vh-300px)]"
      />
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-sm text-destructive">
          Error loading pathway flow data.
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{String(error)}</div>
      </div>
    );
  }

  if (!pathwayDataComplete) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          No pathway data available for this station.
        </div>
      </div>
    );
  }

  const flowViewProps: FlowViewBaseProps = {
    pathwayData: pathwayDataComplete,
    procedureRouteFilterData,
    onSetClickInfo: setClickInfo,
    selectedNodeId: search.selectedNodeId,
    selectedPathwayId: search.selectedPathwayId,
    onSelectedNodeIdChange: handleSelectedNodeIdChange,
    onSelectedPathwayIdChange: handleSelectedPathwayIdChange,
    selectedFromStop,
    onSelectedFromStopChange: handleSelectedFromStopChange,
    selectedToStop,
    onSelectedToStopChange: handleSelectedToStopChange,
    nodeFormOpenValue: Open,
    setNodeFormOpenValue: setOpen,
    nodeFormClickInfo: ClickInfo,
    setNodeFormClickInfo: setClickInfo,
    parentStationId: stationId,
    requestedEditTarget,
    onRequestedEditTargetHandled: handleRequestedEditTargetHandled,
  };

  return (
    <FlowViewProvider value={flowViewProps}>
      <Outlet />
    </FlowViewProvider>
  );
}
