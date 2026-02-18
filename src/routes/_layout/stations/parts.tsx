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
import {
  fetchCheckStationData,
  fetchCheckStationInfo,
} from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/components/ui/tab-header";
import PageFooter from "@/components/PageFooter";
import { EditIndicator } from "@/components/ui/EditIndicator";

type PartsSearchParams = {
  selectedStationId?: string;
  selectedNodeId?: string;
  locationTypes?: string[];
  stopId?: string;
  timeRangeMin?: number;
  timeRangeMax?: number;
};

export const Route = createFileRoute("/_layout/stations/parts")({
  component: StationPartsLayout,
  validateSearch: (search: Record<string, unknown>): PartsSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      selectedNodeId: search.selectedNodeId as string | undefined,
      locationTypes: Array.isArray(search.locationTypes)
        ? (search.locationTypes as string[])
        : search.locationTypes
          ? [search.locationTypes as string]
          : undefined,
      stopId: search.stopId as string | undefined,
      timeRangeMin: search.timeRangeMin as number | undefined,
      timeRangeMax: search.timeRangeMax as number | undefined,
    };
  },
});

function StationPartsLayout() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const { conn, initialized } = useDuckDB();

  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();

  const stationId = search.selectedStationId;

  const { data: stationData, isLoading: stationLoading } = useQuery({
    queryKey: ["fetchStationInfoData", stationId],
    queryFn: async () => {
      return fetchCheckStationInfo({
        conn,
        table: "StopsView",
        stop_id: stationId!,
      });
    },
    enabled: !!conn && !!stationId && initialized,
    retry: false,
  });

  const { data: allStationParts } = useQuery({
    queryKey: ["fetchStationData", stationId],
    queryFn: async () => {
      const result = await fetchCheckStationData({
        conn,
        table: "StopsView",
        StationView: { stop_id: stationId! },
        LocationsList: [],
        StopsID: undefined,
      });
      return result;
    },
    enabled: !!conn && !!stationId && initialized,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (
      search.selectedNodeId &&
      allStationParts &&
      Array.isArray(allStationParts)
    ) {
      const part = allStationParts.find(
        (p: any) => p.stop_id === search.selectedNodeId,
      );
      if (part) {
        
        setClickInfo({ ...part });
      }
    } else if (!search.selectedNodeId && ClickInfo) {
      setClickInfo(undefined);
    }
  }, [search.selectedNodeId, allStationParts, location.pathname]);

  const handleSetClickInfo = useCallback(
    (value: any) => {
      setClickInfo(value);
      const nodeId = value?.object?.stop_id || value?.stop_id;

      navigate({
        search: (prev) => ({
          ...prev,
          selectedNodeId: nodeId || undefined,
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
            No station selected. Please select a station from the stations list.
          </div>
        </div>
    );
  }

  if (stationLoading) {
    return (
      <div className="p-4">
        {}
        <Skeleton className="h-12 w-2/3 mx-auto mb-6" />

        {}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>

        {}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>

        {}
        <Skeleton className="h-[70vh] w-full" />
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

  const ToggleTabs = [
    {
      value: "map",
      label: "Map",
      icon: <BiMap className="w-5" />,
      path: `/stations/parts/map`,
    },
    {
      value: "table",
      label: "Table",
      icon: <BiTable className="w-5" />,
      path: `/stations/parts/table`,
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
            })}
            className="mb-2"
          />

          <Outlet
            context={{
              Open,
              setOpen,
              ClickInfo,
              setClickInfo: handleSetClickInfo,
            }}
          />
        </div>

        <PageFooter />
      </div>
  );
}
