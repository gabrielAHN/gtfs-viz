import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { BiMap, BiTable } from "react-icons/bi";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchCheckStationData } from "@/lib/duckdb/DataFetching/fetchStationInfoData";

type PartsSearchParams = {
  selectedPartId?: string;
};

export const Route = createFileRoute("/_layout/stations/station/$stationId/parts")({
  component: StationPartsLayout,
  validateSearch: (search: Record<string, unknown>): PartsSearchParams => {
    return {
      selectedPartId: search.selectedPartId as string | undefined,
    };
  },
});

function StationPartsLayout() {
  const { stationId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { conn } = useDuckDB();

  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();

  const { data: allStationParts } = useQuery({
    queryKey: ["fetchStationData", stationId],
    queryFn: async () => {
      const result = await fetchCheckStationData({
        conn,
        table: "StopsView",
        StationView: { stop_id: stationId },
        LocationsList: [],
        StopsID: undefined,
      });
      return result;
    },
    enabled: !!conn && !!stationId,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (
      search.selectedPartId &&
      allStationParts &&
      Array.isArray(allStationParts) &&
      !ClickInfo
    ) {
      const part = allStationParts.find(
        (p: any) => p.stop_id === search.selectedPartId,
      );
      if (part) {
        setClickInfo(part);
      }
    }
  }, [search.selectedPartId, allStationParts]);

  const handleSetClickInfo = useCallback(
    (value: any) => {
      setClickInfo(value);
      navigate({
        search: (prev) => ({
          ...prev,
          selectedPartId: value?.stop_id || undefined,
        }),
      });
    },
    [navigate],
  );

  const stationData = queryClient.getQueryData([
    "fetchStationInfoData",
    stationId,
  ]);

  if (!stationData) {
    return null; 
  }

  const ToggleTabs = [
    {
      value: "map",
      label: "Map",
      icon: <BiMap className="w-5" />,
      path: `/stations/station/${stationId}/parts/map`,
    },
    {
      value: "table",
      label: "Table",
      icon: <BiTable className="w-5" />,
      path: `/stations/station/${stationId}/parts/table`,
    },
  ];

  return (
    <div className="relative flex flex-col space-y-4">
      {}
      <div className="flex gap-2 border-b">
        {ToggleTabs.map((tab) => (
          <Link
            key={tab.value}
            to={tab.path}
            search={(prev) => ({
              ...prev,
              selectedPartId: search.selectedPartId,
            })} 
            activeOptions={{
              exact: true,
              includeSearch: false, 
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm transition-colors hover:bg-accent"
            activeProps={{
              className:
                "bg-background border border-b-0 border-border font-medium",
            }}
            inactiveProps={{
              className: "text-muted-foreground",
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>

      <Outlet
        context={{ Open, setOpen, ClickInfo, setClickInfo: handleSetClickInfo }}
      />
    </div>
  );
}
