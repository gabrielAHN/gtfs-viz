import {
  createFileRoute,
  redirect,
  Outlet,
  Link,
  useLocation,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchCheckStationInfo } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import { Skeleton } from "@/components/ui/skeleton";
import { BiInfoCircle, BiMapAlt, BiGridAlt } from "react-icons/bi";
import PageFooter from "@/components/PageFooter";
import { logger } from "@/lib/logger";
import { EditIndicator } from "@/components/ui/EditIndicator";

type StationSearchParams = {
  selectedStationId?: string;
};

export const Route = createFileRoute("/_layout/stations/station/$stationId")({
  component: StationLayout,
  validateSearch: (search: Record<string, unknown>): StationSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
    };
  },
  beforeLoad: () => {
    const initialized =
      localStorage.getItem("gtfs_data_initialized") === "true";
    if (!initialized) {
      throw redirect({ to: "/" });
    }
  },
});

function StationLayout() {
  const { stationId } = Route.useParams();
  const search = Route.useSearch();
  const { conn, initialized } = useDuckDB();
  const location = useLocation();

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["fetchStationInfoData", stationId],
    queryFn: async () => {
      return fetchCheckStationInfo({
        conn,
        table: "StopsView",
        stop_id: stationId,
      });
    },
    enabled: !!conn && !!stationId && initialized,
    retry: false,
  });

  if (isLoading || isFetching) {
    return (
        <div className="p-4">
          <Skeleton className="h-30" />
          <br />
          <Skeleton className="h-30" />
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-4">Error loading station information.</div>
    );
  }

  if (!data) {
    return (
        <div className="p-4">No station information available.</div>
    );
  }

  const ToggleTabs = [
    {
      value: "info",
      label: "Info",
      icon: <BiInfoCircle />,
      path: `/stations/station/${stationId}/info`,
    },
    {
      value: "parts",
      label: "Parts",
      icon: <BiGridAlt />,
      path: `/stations/station/${stationId}/parts`,
    },
  ];

  if (data.pathways_status === "✅") {
    ToggleTabs.push({
      value: "pathways",
      label: "Pathways",
      icon: <BiMapAlt />,
      path: `/stations/station/${stationId}/pathways`,
    });
  }

  logger.log("[StationLayout] pathname:", location.pathname);
  logger.log(
    "[StationLayout] Active tabs:",
    ToggleTabs.map((tab) => ({
      value: tab.value,
      isActive: location.pathname.includes(`/${tab.value}`),
    })),
  );

  return (
      <div className="p-4">
        <div className="text-4xl font-bold flex justify-center items-center gap-3 mb-6">
          <EditIndicator status={data?.status} className="h-8 w-8" />
          {data.stop_name}
        </div>
        <div className="flex gap-2 mb-4 border-b">
          {ToggleTabs.map((tab) => {
            const isActive = location.pathname.includes(`/${tab.value}`);
            return (
              <Link
                key={tab.value}
                to={tab.path}
                search={(prev) => ({
                  ...prev,
                  selectedStationId: search.selectedStationId,
                })}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-md transition-colors hover:bg-accent ${
                  isActive
                    ? "bg-background border border-b-0 border-border font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
        <Outlet context={{ stationData: data }} />
        <PageFooter />
      </div>
  );
}
