import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
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
} from "react-icons/bi";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchCheckStationInfo } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import { fetchStationPathwaysComplete } from "@/lib/duckdb/DataFetching/pathways";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/components/ui/tab-header";
import PageFooter from "@/components/PageFooter";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { logger } from "@/lib/logger";

type PathwaysSearchParams = {
  selectedStationId?: string;
  selectedPathwayId?: string;
};

export const Route = createFileRoute("/_layout/stations/pathways")({
  component: StationPathwaysLayout,
  validateSearch: (search: Record<string, unknown>): PathwaysSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      selectedPathwayId: search.selectedPathwayId as string | undefined,
    };
  },
});

function StationPathwaysLayout() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const { conn, initialized } = useDuckDB();

  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();
  const [MapViewState, setMapViewState] = useState(null);

  const stationId = search.selectedStationId;
  const selectedPathwayId = search.selectedPathwayId;
  const isMapRoute = location.pathname.includes("/pathways/map/");
  const isTableRoute = location.pathname.includes("/pathways/table/");

  const { data: stationData, isLoading: stationLoading, error: stationError } = useQuery({
    queryKey: ["fetchStationInfoData", stationId],
    queryFn: async () => {
      if (!stationId) {
        throw new Error('No station ID provided');
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

  const { data: pathwayDataComplete, isLoading: pathwaysLoading, error: pathwaysError } = useQuery({
    queryKey: ["stationPathwaysComplete", stationId],
    queryFn: async () => {
      if (!stationId) {
        throw new Error('No station ID provided');
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

  const hasValidMapConnections = pathwayDataComplete?.connections?.some((conn: any) =>
    conn.from_lat !== null && conn.from_lat !== undefined &&
    conn.from_lon !== null && conn.from_lon !== undefined &&
    conn.to_lat !== null && conn.to_lat !== undefined &&
    conn.to_lon !== null && conn.to_lon !== undefined
  ) ?? false;

  useEffect(() => {
    if (pathwayDataComplete && isMapRoute && !hasValidMapConnections) {
      logger.log('⚠️ No valid map connections, redirecting to table view');
      navigate({
        to: '/stations/pathways/table/start',
        search: (prev) => prev,
        replace: true,
      });
    }
  }, [pathwayDataComplete, isMapRoute, hasValidMapConnections, navigate]);

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
            No station selected. Please add <code>?selectedStationId=YOUR_STATION_ID</code> to the URL.
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
          <div className="text-sm text-destructive">Error loading station data</div>
          <div className="text-xs text-muted-foreground mt-2">{String(stationError)}</div>
        </div>
    );
  }

  if (pathwaysError) {
    return (
        <div className="p-4">
          <div className="text-sm text-destructive">Error loading pathways data</div>
          <div className="text-xs text-muted-foreground mt-2">{String(pathwaysError)}</div>
        </div>
    );
  }

  if (stationLoading || pathwaysLoading) {
    return (
      <div className="p-4">
        {}
        <Skeleton className="h-12 w-2/3 mx-auto mb-6" />

        {}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>

        {}
        <div className="flex gap-2 mb-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>

        {}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>

        {}
        <Skeleton className="h-[65vh] w-full" />
      </div>
    );
  }

  if (!stationData) {
    return (
        <div className="p-4">Error loading station information.</div>
    );
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

  if (stationData.pathways_status === "✅") {
    MainTabs.push({
      value: "pathways",
      label: "Pathways",
      icon: <BiMapAlt />,
      path: `/stations/pathways/map/directional`,
    });
  }

  const ToggleTabs = hasValidMapConnections ? [
    {
      value: "map",
      label: "Map",
      icon: <BiMap className="w-5" />,
      path: `/stations/pathways/map/directional`,
    },
    {
      value: "table",
      label: "Table",
      icon: <BiTable className="w-5" />,
      path: `/stations/pathways/table/start`,
    },
  ] : [
    {
      value: "table",
      label: "Table",
      icon: <BiTable className="w-5" />,
      path: `/stations/pathways/table/start`,
    },
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
            selectedPathwayId: search.selectedPathwayId,
          })}
          customActiveCheck={(pathname, tab) =>
            tab.value === "map"
              ? pathname.includes("/pathways/map/")
              : pathname.includes("/pathways/table/")
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
          }}
        />
      </div>

      <PageFooter />
    </div>
  );
}
