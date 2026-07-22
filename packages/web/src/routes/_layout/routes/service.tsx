import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { isCliSession } from "@/lib/cli/isCliSession";
import { useQuery } from "@tanstack/react-query";
import { BiCalendar, BiInfoCircle } from "react-icons/bi";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/components/ui/tab-header";
import PageFooter from "@/components/PageFooter";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { useDuckDB } from "@/context/duckdb.client";
import RouteService from "@/client/Routes/SelectedRoutes/RouteService";
import { getRouteTypeColor } from "@/client/Routes/routeTypeColors";
import {
  fetchServiceRouteInfoData,
  fetchServiceRouteServicesData,
} from "@/lib/duckdb/DataFetching/fetchRouteData";

type RouteServiceSearchParams = {
  selectedRouteId?: string;
  selectedServiceId?: string;
};

export const Route = createFileRoute("/_layout/routes/service")({
  component: RouteServicePage,
  validateSearch: (search: Record<string, unknown>): RouteServiceSearchParams => {
    const strip = (v: unknown) => v != null ? String(v).replace(/^"|"$/g, "") || undefined : undefined;
    return {
      selectedRouteId: strip(search.selectedRouteId),
      selectedServiceId: strip(search.selectedServiceId),
    };
  },
  beforeLoad: ({ search }) => {
    if (isCliSession()) return;
    const hasTrips = localStorage.getItem("gtfs_has_trips") === "true";
    if (!hasTrips) {
      throw redirect({
        to: "/routes/info",
        search: { selectedRouteId: (search as any).selectedRouteId },
      });
    }
  },
});

const ToggleTabs = [
  { value: "info", label: "Info", icon: <BiInfoCircle />, path: "/routes/info" },
  { value: "service", label: "Service", icon: <BiCalendar />, path: "/routes/service" },
];

function RouteServicePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const duckDB = useDuckDB();
  const conn = duckDB?.conn;
  const initialized = duckDB?.initialized ?? false;
  const hasStopTimes = duckDB?.hasStopTimes ?? false;
  const routeId = search.selectedRouteId;

  const updateSearch = (next: Partial<RouteServiceSearchParams>) => {
    navigate({
      to: "/routes/service",
      search: (prev) => ({ ...prev, ...next }),
      resetScroll: false,
    });
  };

  const {
    data: routeData,
    error: routeError,
    isLoading: routeLoading,
  } = useQuery({
    queryKey: ["fetchServiceRouteInfoData", routeId],
    queryFn: async () => fetchServiceRouteInfoData(conn, routeId!),
    enabled: !!conn && !!routeId && initialized,
    retry: false,
  });

  const {
    data: services = [],
    error: servicesError,
    isLoading: servicesLoading,
  } = useQuery({
    queryKey: ["fetchServiceRouteServicesData", routeId],
    queryFn: async () => fetchServiceRouteServicesData(conn, routeId!),
    enabled: !!conn && !!routeId && initialized,
    retry: false,
  });

  if (!routeId) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          No route selected. Please select a route from the routes list.
        </div>
      </div>
    );
  }

  if (!conn || !initialized || routeLoading || servicesLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mx-auto mb-6 h-12 w-2/3" />
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="h-[74vh] w-full" />
      </div>
    );
  }

  if (routeError || servicesError || !routeData) {
    return <div className="p-4">Error loading route service.</div>;
  }

  const routeColor = routeData.route_color_hex || getRouteTypeColor(routeData.route_type_name);

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center justify-center gap-3 text-4xl font-bold">
        <EditIndicator status={routeData?.status} className="h-8 w-8" />
        <span className="h-5 w-14 rounded-sm border" style={{ backgroundColor: routeColor }} />
        <span>{routeData.route_name || routeData.route_id}</span>
      </div>
      <TabHeader
        tabs={ToggleTabs}
        searchParams={(prev) => ({ ...prev, selectedRouteId: routeId })}
        customActiveCheck={(pathname, tab) => pathname.startsWith(`/routes/${tab.value}`)}
        className="mb-4"
      />
      <RouteService
        routeId={routeId}
        services={services}
        selectedServiceId={search.selectedServiceId}
        routeTypeName={routeData.route_type_name}
        hasStopTimes={hasStopTimes}
        onSelectionChange={(serviceId) =>
          updateSearch({
            selectedServiceId: serviceId || undefined,
          })
        }
      />
      <PageFooter />
    </div>
  );
}
