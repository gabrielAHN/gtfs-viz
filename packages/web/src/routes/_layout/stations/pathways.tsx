import {
  createFileRoute,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BiMap,
  BiTable,
  BiInfoCircle,
  BiMapAlt,
  BiGridAlt,
  BiNetworkChart,
} from "react-icons/bi";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchCheckStationInfo } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import { fetchStationPathwaysComplete } from "@/lib/duckdb/DataFetching/pathways";
import PathwaysLoadingSkeleton from "@/client/Stations/SelectedStations/StationPathways/LoadingSkeleton";
import { TabHeader } from "@/components/ui/tab-header";
import PageFooter from "@/components/PageFooter";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { logger } from "@/lib/logger";
import { usePathwaysNavigate } from "./pathways/-usePathwaysNavigate";

type PathwaysSearchParams = {
  selectedStationId?: string;
  selectedNodeId?: string;
  selectedPathwayId?: string;
  fromStop?: string;
  toStop?: string;
  wheelchairOnly?: boolean;
  editTarget?: "node" | "pathway";
};

const parseBooleanSearchParam = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  return value !== false && value !== "false";
};

export const Route = createFileRoute("/_layout/stations/pathways")({
  component: StationPathwaysLayout,
  validateSearch: (search: Record<string, unknown>): PathwaysSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      selectedNodeId: search.selectedNodeId as string | undefined,
      selectedPathwayId: search.selectedPathwayId as string | undefined,
      fromStop: search.fromStop as string | undefined,
      toStop: search.toStop as string | undefined,
      wheelchairOnly: parseBooleanSearchParam(search.wheelchairOnly),
      editTarget:
        search.editTarget === "node" || search.editTarget === "pathway"
          ? search.editTarget
          : undefined,
    };
  },
});

function StationPathwaysLayout() {
  const search = Route.useSearch();
  const navigate = usePathwaysNavigate();
  const location = useLocation();
  const { conn, initialized } = useDuckDB();

  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();
  const [MapViewState, setMapViewState] = useState(null);

  const stationId = search.selectedStationId;
  const selectedPathwayId = search.selectedPathwayId;
  const isMapRoute = location.pathname.includes("/pathways/map/");

  const {
    data: stationData,
    isLoading: stationLoading,
    error: stationError,
  } = useQuery({
    queryKey: ["fetchStationInfoData", stationId],
    queryFn: async () => {
      if (!stationId) {
        throw new Error("No station ID provided");
      }
      logger.log(`📍 Fetching station info for: ${stationId}`);
      return fetchCheckStationInfo({
        conn,
        stop_id: stationId,
      });
    },
    enabled: !!conn && !!stationId && initialized,
    retry: false,
  });

  const {
    data: pathwayDataComplete,
    isLoading: pathwaysLoading,
    error: pathwaysError,
  } = useQuery({
    queryKey: ["stationPathwaysComplete", stationId],
    queryFn: async () => {
      if (!stationId) {
        throw new Error("No station ID provided");
      }
      logger.log(`🔍 Fetching pathway data for station: ${stationId}`);
      const result = await fetchStationPathwaysComplete({
        conn,
        StationView: { stop_id: stationId },
      });
      logger.log(`✅ Pathway data loaded:`, {
        connections: result.connections?.length || 0,
        stops: result.stops?.length || 0,
      });
      return result;
    },
    enabled: !!conn && !!stationId && initialized,
    staleTime: Infinity,
    retry: false,
  });

  const hasValidMapConnections =
    pathwayDataComplete?.connections?.some(
      (conn: any) =>
        conn.from_lat !== null &&
        conn.from_lat !== undefined &&
        conn.from_lon !== null &&
        conn.from_lon !== undefined &&
        conn.to_lat !== null &&
        conn.to_lat !== undefined &&
        conn.to_lon !== null &&
        conn.to_lon !== undefined,
    ) ?? false;
  const hasPathwayConnections =
    (pathwayDataComplete?.connections?.length ?? 0) > 0;
  const hasTimeIntervalConnections =
    pathwayDataComplete?.connections?.some(
      (conn: any) =>
        conn.traversal_time !== null &&
        conn.traversal_time !== undefined &&
        conn.traversal_time !== "",
    ) ?? false;
  const pathwaysTabPath = hasValidMapConnections
    ? "/stations/pathways/map/directional"
    : "/stations/pathways/flow/column";

  useEffect(() => {
    if (!pathwayDataComplete) {
      return;
    }

    if (!hasPathwayConnections && isMapRoute) {
      logger.log("⚠️ Disabled pathways sub-route, redirecting to flow view");
      navigate({
        to: "/stations/pathways/flow/column",
        search: (prev) => prev,
        replace: true,
      });
      return;
    }

    if (hasPathwayConnections && isMapRoute && !hasValidMapConnections) {
      logger.log("⚠️ No valid map connections, redirecting to flow view");
      navigate({
        to: "/stations/pathways/flow/column",
        search: (prev) => prev,
        replace: true,
      });
    }
  }, [
    hasPathwayConnections,
    hasValidMapConnections,
    isMapRoute,
    navigate,
    pathwayDataComplete,
  ]);

  useEffect(() => {
    if (selectedPathwayId && pathwayDataComplete) {
      const pathway = pathwayDataComplete.connections?.find(
        (p: any) => p.pathway_id === selectedPathwayId,
      );
      if (pathway) {
        setClickInfo({ ...pathway });
      }
    } else if (!selectedPathwayId && ClickInfo) {
      setClickInfo(undefined);
    }
  }, [selectedPathwayId, pathwayDataComplete, location.pathname]);

  const handleSetClickInfo = useCallback(
    (value: any) => {
      setClickInfo(value);
      const clickData = value?.object || value;
      const pathwayId = clickData?.pathway_id;
      navigate({
        search: (prev) => ({
          ...prev,
          selectedPathwayId: pathwayId || undefined,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  if (!stationId) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          No station selected. Please add{" "}
          <code>?selectedStationId=YOUR_STATION_ID</code> to the URL.
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Example: /stations/pathways?selectedStationId=place-chncl
        </div>
      </div>
    );
  }

  if (stationError) {
    return (
      <div className="p-4">
        <div className="text-sm text-destructive">
          Error loading station data
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {String(stationError)}
        </div>
      </div>
    );
  }

  if (pathwaysError) {
    return (
      <div className="p-4">
        <div className="text-sm text-destructive">
          Error loading pathways data
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {String(pathwaysError)}
        </div>
      </div>
    );
  }

  if (stationLoading || pathwaysLoading) {
    return (
      <PathwaysLoadingSkeleton className="p-4" />
    );
  }

  if (!stationData) {
    return <div className="p-4">Error loading station information.</div>;
  }

  const MainTabs = [
    {
      value: "info",
      label: "Info",
      icon: <BiInfoCircle />,
      path: `/stations/info`,
    },
    {
      value: "parts",
      label: "Parts",
      icon: <BiGridAlt />,
      path: `/stations/parts/map`,
    },
  ];

  MainTabs.push({
    value: "pathways",
    label: "Pathways",
    icon: <BiMapAlt />,
    path: pathwaysTabPath,
  });

  const mapTab = {
    value: "map",
    label: "Map",
    icon: <BiMap className="w-5" />,
    path: "/stations/pathways/map/directional",
  };
  const flowTab = {
    value: "flow",
    label: "Flow",
    icon: <BiNetworkChart className="w-5" />,
    path: "/stations/pathways/flow/column",
  };
  const tableTab = {
    value: "table",
    label: "Table",
    icon: <BiTable className="w-5" />,
    path: "/stations/pathways/table/start",
  };

  const ToggleTabs = [
    ...(hasValidMapConnections ? [mapTab] : []),
    flowTab,
    tableTab,
    ...(!hasValidMapConnections
      ? [
          {
            ...mapTab,
            disabled: true,
            disabledReason: hasPathwayConnections
              ? "Add valid node coordinates to enable Map"
              : "Create pathway connections with coordinates to enable Map",
          },
        ]
      : []),
  ];

  const MapSubTabs = [
    {
      value: "directional",
      label: "Directional",
      path: `/stations/pathways/map/directional`,
    },
    {
      value: "timeInterval",
      label: "Time Interval",
      path: `/stations/pathways/map/timeInterval`,
    },
    {
      value: "pathwayTypes",
      label: "Pathway Types",
      path: `/stations/pathways/map/pathwayTypes`,
    },
  ];

  const TableSubTabs = [
    { value: "start", label: "Start", path: `/stations/pathways/table/start` },
    { value: "end", label: "End", path: `/stations/pathways/table/end` },
  ];

  const FlowSubTabs = [
    {
      value: "column",
      label: "Column",
      path: `/stations/pathways/flow/column`,
    },
    {
      value: "radial",
      label: "Radial",
      path: `/stations/pathways/flow/radial`,
    },
  ];

  return (
    <div className="p-4">
      <div className="text-4xl font-bold flex justify-center items-center gap-3 mb-6">
        <EditIndicator status={stationData?.status} className="h-8 w-8" />
        {stationData.stop_name}
      </div>

      {}
      <TabHeader
        tabs={MainTabs}
        searchParams={(prev) => ({ ...prev, selectedStationId: stationId })}
        customActiveCheck={(pathname, tab) =>
          pathname.startsWith(`/stations/${tab.value}`)
        }
        className="mb-4"
      />

      <div className="relative flex flex-col space-y-4">
        {}
        <TabHeader
          tabs={ToggleTabs}
          searchParams={(prev) => ({
            ...prev,
            selectedStationId: stationId,
            selectedNodeId: search.selectedNodeId,
            selectedPathwayId: search.selectedPathwayId,
            fromStop: search.fromStop,
            toStop: search.toStop,
            wheelchairOnly: search.wheelchairOnly,
          })}
          customActiveCheck={(pathname, tab) =>
            tab.value === "map"
              ? pathname.includes("/pathways/map/")
              : tab.value === "table"
                ? pathname.includes("/pathways/table/")
                : pathname.includes("/pathways/flow")
          }
          childTabs={[
            {
              condition: (pathname) => pathname.includes("/pathways/map/"),
              tabs: MapSubTabs,
            },
            {
              condition: (pathname) => pathname.includes("/pathways/table/"),
              tabs: TableSubTabs,
            },
            {
              condition: (pathname) => pathname.includes("/pathways/flow/"),
              tabs: FlowSubTabs,
            },
          ]}
          className="mb-2"
        />

        <Outlet
          context={{
            Open,
            setOpen,
            ClickInfo,
            setClickInfo: handleSetClickInfo,
            MapViewState,
            setMapViewState,
            stationData,
            pathwayDataComplete,
            hasPathwayConnections,
            hasTimeIntervalConnections,
            hasValidMapConnections,
            stationId,
          }}
        />
      </div>

      <PageFooter />
    </div>
  );
}
