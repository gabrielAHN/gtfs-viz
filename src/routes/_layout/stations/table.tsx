import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";
import { useThemeContext } from "@/context/theme.client";
import { fetchStationsData } from "@/lib/duckdb/DataFetching/fetchGTFSData";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/components/ui/tab-header";
import { BiMap, BiTable } from "react-icons/bi";
import StationsHeader from "@/client/Stations/AllStations/Header";
import StationTable from "@/client/Stations/AllStations/StationTable";
import StopStationForm from "@/components/forms/StopStationForms";
import PageFooter from "@/components/PageFooter";
import { DATA_STATUS } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";

type StationsTableSearchParams = {
  stopId?: string;
  stopName?: string;
  pathwaysStatus?: string[];
  wheelchairStatus?: string[];
  selectedStationId?: string;
};

export const Route = createFileRoute("/_layout/stations/table")({
  component: StationsTablePage,
  validateSearch: (
    search: Record<string, unknown>,
  ): StationsTableSearchParams => {
    return {
      stopId: search.stopId as string | undefined,
      stopName: search.stopName as string | undefined,
      pathwaysStatus: Array.isArray(search.pathwaysStatus)
        ? (search.pathwaysStatus as string[])
        : search.pathwaysStatus
          ? [search.pathwaysStatus as string]
          : undefined,
      wheelchairStatus: Array.isArray(search.wheelchairStatus)
        ? (search.wheelchairStatus as string[])
        : search.wheelchairStatus
          ? [search.wheelchairStatus as string]
          : undefined,
      selectedStationId: search.selectedStationId as string | undefined,
    };
  },
});

const ToggleTabs = [
  { value: "map", label: "Map", icon: <BiMap />, path: "/stations/map" },
  {
    value: "table",
    label: "Table",
    icon: <BiTable />,
    path: "/stations/table",
  },
];

function StationsTablePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { conn } = useDuckDB();
  const { theme } = useThemeContext();

  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();
  const [tableSorting, setTableSorting] = useState([]);
  const [clearSortingTrigger, setClearSortingTrigger] = useState(0);

  const stopId = search.stopId;
  const stopName = search.stopName;
  const pathwaysStatus = search.pathwaysStatus;
  const wheelchairStatus = search.wheelchairStatus;

  const { data: allStations, isLoading: allStationsLoading } = useQuery({
    queryKey: ["fetchStationsData", "StationsTable"],
    queryFn: () =>
      fetchStationsData({
        conn,
        table: "StationsTable",
        StopIdDropdown: undefined,
        StopNameDropDown: undefined,
        PathwaysStatusDropDown: [],
        WheelChairStatusDropDown: [],
      }),
    enabled: !!conn,
    staleTime: Infinity,
  });

  const availableStopIds = useMemo(() => {
    if (!allStations || !Array.isArray(allStations)) return [];

    let filtered = allStations;

    if (stopName) {
      filtered = filtered.filter((s: any) => s.stop_name === stopName);
    }
    if (pathwaysStatus && pathwaysStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        pathwaysStatus.includes(s.pathways_status),
      );
    }
    if (wheelchairStatus && wheelchairStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        wheelchairStatus.includes(s.wheelchair_status),
      );
    }

    const stopIds = new Set<string>();
    filtered.forEach((s: any) => {
      if (s.stop_id) stopIds.add(s.stop_id);
    });

    if (stopId) stopIds.add(stopId);

    return Array.from(stopIds)
      .sort()
      .map((id) => ({ label: id, value: id }));
  }, [allStations, stopName, pathwaysStatus, wheelchairStatus, stopId]);

  const availableStopNames = useMemo(() => {
    if (!allStations || !Array.isArray(allStations)) return [];

    let filtered = allStations;

    if (stopId) {
      filtered = filtered.filter((s: any) => s.stop_id === stopId);
    }
    if (pathwaysStatus && pathwaysStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        pathwaysStatus.includes(s.pathways_status),
      );
    }
    if (wheelchairStatus && wheelchairStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        wheelchairStatus.includes(s.wheelchair_status),
      );
    }

    const stopNames = new Set<string>();
    filtered.forEach((s: any) => {
      if (s.stop_name) stopNames.add(s.stop_name);
    });

    if (stopName) stopNames.add(stopName);

    return Array.from(stopNames)
      .sort()
      .map((name) => ({ label: name, value: name }));
  }, [allStations, stopId, pathwaysStatus, wheelchairStatus, stopName]);

  const availablePathwaysStatus = useMemo(() => {
    if (!allStations || !Array.isArray(allStations)) return [];

    let filtered = allStations;

    if (stopId) {
      filtered = filtered.filter((s: any) => s.stop_id === stopId);
    }
    if (stopName) {
      filtered = filtered.filter((s: any) => s.stop_name === stopName);
    }
    if (wheelchairStatus && wheelchairStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        wheelchairStatus.includes(s.wheelchair_status),
      );
    }

    const statuses = new Set<string>();
    filtered.forEach((s: any) => {
      if (s.pathways_status) statuses.add(s.pathways_status);
    });

    if (pathwaysStatus) {
      pathwaysStatus.forEach((status) => statuses.add(status));
    }

    return Array.from(statuses)
      .sort()
      .map((status) => ({
        label: status,
        value: status,
        color: rgbToHex(DATA_STATUS[status]?.color || [128, 128, 128]),
      }));
  }, [allStations, stopId, stopName, wheelchairStatus, pathwaysStatus]);

  const availableWheelchairStatus = useMemo(() => {
    if (!allStations || !Array.isArray(allStations)) return [];

    let filtered = allStations;

    if (stopId) {
      filtered = filtered.filter((s: any) => s.stop_id === stopId);
    }
    if (stopName) {
      filtered = filtered.filter((s: any) => s.stop_name === stopName);
    }
    if (pathwaysStatus && pathwaysStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        pathwaysStatus.includes(s.pathways_status),
      );
    }

    const statuses = new Set<string>();
    filtered.forEach((s: any) => {
      if (s.wheelchair_status) statuses.add(s.wheelchair_status);
    });

    if (wheelchairStatus) {
      wheelchairStatus.forEach((status) => statuses.add(status));
    }

    return Array.from(statuses)
      .sort()
      .map((status) => ({
        label: status,
        value: status,
        color: rgbToHex(DATA_STATUS[status]?.color || [128, 128, 128]),
      }));
  }, [allStations, stopId, stopName, pathwaysStatus, wheelchairStatus]);

  const filteredData = useMemo(() => {
    if (!allStations || !Array.isArray(allStations)) return [];

    let filtered = allStations;

    if (stopId) {
      filtered = filtered.filter((s: any) => s.stop_id === stopId);
    }
    if (stopName) {
      filtered = filtered.filter((s: any) => s.stop_name === stopName);
    }
    if (pathwaysStatus && pathwaysStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        pathwaysStatus.includes(s.pathways_status),
      );
    }
    if (wheelchairStatus && wheelchairStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        wheelchairStatus.includes(s.wheelchair_status),
      );
    }

    return filtered;
  }, [allStations, stopId, stopName, pathwaysStatus, wheelchairStatus]);

  useEffect(() => {
    if (search.selectedStationId && allStations && Array.isArray(allStations)) {
      const station = allStations.find(
        (s: any) => s.stop_id === search.selectedStationId,
      );
      
      const currentStopId = ClickInfo?.object?.stop_id || ClickInfo?.stop_id;
      if (
        station &&
        (!ClickInfo || currentStopId !== search.selectedStationId)
      ) {
        setClickInfo(station);
      }
    } else if (!search.selectedStationId && ClickInfo) {
      setClickInfo(undefined);
    }
  }, [search.selectedStationId, allStations]);

  const handleSetClickInfo = useCallback(
    (value: any) => {
      setClickInfo(value);
      
      const stopId = value?.object?.stop_id || value?.stop_id;
      navigate({
        search: (prev) => ({
          ...prev,
          selectedStationId: stopId || undefined,
        }),
      });
    },
    [navigate],
  );

  const handleSetStopId = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          stopId: value || undefined,
        }),
      });
    },
    [navigate],
  );

  const handleSetStopName = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({
          ...prev,
          stopName: value || undefined,
        }),
      });
    },
    [navigate],
  );

  const handleSetPathwaysStatus = useCallback(
    (value: string[]) => {
      navigate({
        search: (prev) => ({
          ...prev,
          pathwaysStatus: value.length > 0 ? value : undefined,
        }),
      });
    },
    [navigate],
  );

  const handleSetWheelchairStatus = useCallback(
    (value: string[]) => {
      navigate({
        search: (prev) => ({
          ...prev,
          wheelchairStatus: value.length > 0 ? value : undefined,
        }),
      });
    },
    [navigate],
  );

  const isLoading = allStationsLoading;

  const hasActiveFilters = !!(
    stopId ||
    stopName ||
    (pathwaysStatus && pathwaysStatus.length > 0) ||
    (wheelchairStatus && wheelchairStatus.length > 0) ||
    tableSorting.length > 0
  );

  const handleClearFilters = useCallback(() => {
    handleSetStopId(undefined);
    handleSetStopName(undefined);
    handleSetPathwaysStatus([]);
    handleSetWheelchairStatus([]);
    setTableSorting([]);
    setClearSortingTrigger((prev) => prev + 1);
  }, [
    handleSetStopId,
    handleSetStopName,
    handleSetPathwaysStatus,
    handleSetWheelchairStatus,
  ]);

  return (
    <div className="p-4">
        <div className="flex flex-col gap-4">
          {}
          <TabHeader tabs={ToggleTabs} />

          {}
          <StationsHeader
            setOpen={setOpen}
            StopIdDropdown={stopId}
            setStopIdDropdown={handleSetStopId}
            StopsIdData={availableStopIds}
            PathwaysStatusData={availablePathwaysStatus}
            WheelchairStatusData={availableWheelchairStatus}
            StopsNameData={availableStopNames}
            StopNameDropDown={stopName}
            setStopNameDropDown={handleSetStopName}
            PathwaysStatusDropDown={pathwaysStatus || []}
            setPathwaysStatusDropDown={handleSetPathwaysStatus}
            setWheelChairStatusDropDown={handleSetWheelchairStatus}
            WheelChairStatusDropDown={wheelchairStatus || []}
            onResetFilters={handleClearFilters}
            isResetDisabled={!hasActiveFilters}
          />

          {}
          {isLoading ? (
            <Skeleton className="h-[74vh] w-full" />
          ) : (
            <>
              <StopStationForm
                Data={filteredData}
                OpenValue={Open}
                setOpenValue={setOpen}
                ClickInfo={ClickInfo?.object || ClickInfo}
                setClickInfo={handleSetClickInfo}
                type="station"
              />
              <StationTable
                data={filteredData}
                setOpen={setOpen}
                ClickInfo={ClickInfo?.object || ClickInfo}
                setClickInfo={handleSetClickInfo}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
                onSortingChange={setTableSorting}
                clearSortingTrigger={clearSortingTrigger}
              />
            </>
          )}
        </div>
        <PageFooter />
      </div>
  );
}
