import { createFileRoute } from "@tanstack/react-router";
import { useDuckDB } from "@/context/duckdb.client";
import { useQuery } from "@tanstack/react-query";
import { fetchCheckStationInfo } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/components/ui/tab-header";
import PageFooter from "@/components/PageFooter";
import { BiInfoCircle, BiMapAlt, BiGridAlt } from "react-icons/bi";
import StationInfo from "@/client/Stations/SelectedStations/StationInfo";
import { EditIndicator } from "@/components/ui/EditIndicator";

type StationInfoSearchParams = {
  selectedStationId?: string;
};

export const Route = createFileRoute("/_layout/stations/info")({
  component: StationInfoPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): StationInfoSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
    };
  },
});

function StationInfoPage() {
  const search = Route.useSearch();
  const { conn, initialized } = useDuckDB();
  const stationId = search.selectedStationId;

  const {
    data: stationData,
    error,
    isLoading,
  } = useQuery({
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
      <div className="p-4">
        {}
        <Skeleton className="h-12 w-2/3 mx-auto mb-6" />

        {}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>

        {}
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <Skeleton className="h-10 w-full md:w-32" />
          <Skeleton className="h-10 w-full md:w-32" />
        </div>

        {}
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !stationData) {
    return <div className="p-4">Error loading station information.</div>;
  }

  const ToggleTabs = [
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
    ToggleTabs.push({
      value: "pathways",
      label: "Pathways",
      icon: <BiMapAlt />,
      path: `/stations/pathways/map/directional`,
    });
  }

  return (
    <div className="p-4">
      <div className="text-4xl font-bold flex justify-center items-center gap-3 mb-6">
        <EditIndicator status={stationData?.status} className="h-8 w-8" />
        {stationData.stop_name}
      </div>
      <TabHeader
        tabs={ToggleTabs}
        searchParams={(prev) => ({ ...prev, selectedStationId: stationId })}
        customActiveCheck={(pathname, tab) =>
          pathname.startsWith(`/stations/${tab.value}`)
        }
        className="mb-4"
      />

      <StationInfo Data={stationData} />

      <PageFooter />
    </div>
  );
}
