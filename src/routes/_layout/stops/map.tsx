import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchStationsData } from "@/lib/duckdb/DataFetching/fetchGTFSData";
import { Skeleton } from "@/components/ui/skeleton";
import { TabHeader } from "@/components/ui/tab-header";
import { BiMap, BiTable } from "react-icons/bi";
import StopsHeader from "@/client/Stops/AllStops/Header";
import StopsMap from "@/client/Stops/AllStops/StopsMap";
import StopStationForm from "@/components/forms/StopStationForms";
import PageFooter from "@/components/PageFooter";
import { WHEELCHAIR_STATUS, getStopColor } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";
import { useThemeContext } from "@/context/theme.client";

type StopsMapSearchParams = {
  stopId?: string;
  stopName?: string;
  locationType?: string[];
  wheelchairStatus?: string[];
  editStatus?: string[];
  selectedStopId?: string;
};

export const Route = createFileRoute("/_layout/stops/map")({
  component: StopsMapPage,
  validateSearch: (search: Record<string, unknown>): StopsMapSearchParams => {
    return {
      stopId: search.stopId as string | undefined,
      stopName: search.stopName as string | undefined,
      locationType: Array.isArray(search.locationType)
        ? (search.locationType as string[])
        : search.locationType
          ? [search.locationType as string]
          : undefined,
      wheelchairStatus: Array.isArray(search.wheelchairStatus)
        ? (search.wheelchairStatus as string[])
        : search.wheelchairStatus
          ? [search.wheelchairStatus as string]
          : undefined,
      editStatus: Array.isArray(search.editStatus)
        ? (search.editStatus as string[])
        : search.editStatus
          ? [search.editStatus as string]
          : undefined,
      selectedStopId: search.selectedStopId as string | undefined,
    };
  },
});

const ToggleTabs = [
  { value: "map", label: "Map", icon: <BiMap />, path: "/stops/map" },
  { value: "table", label: "Table", icon: <BiTable />, path: "/stops/table" },
];

function StopsMapPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { conn } = useDuckDB();
  const { theme } = useThemeContext();

  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();
  const [viewState, setViewState] = useState();

  const stopId = search.stopId;
  const stopName = search.stopName;
  const locationType = search.locationType;
  const wheelchairStatus = search.wheelchairStatus;
  const editStatus = search.editStatus;

  const { data: allStops, isLoading: allStopsLoading } = useQuery({
    queryKey: ["fetchStopsData", "StopsTable"],
    queryFn: () =>
      fetchStationsData({
        conn,
        table: "StopsTable",
        StopIdDropdown: undefined,
        StopNameDropDown: undefined,
        PathwaysStatusDropDown: [],
        WheelChairStatusDropDown: [],
      }),
    enabled: !!conn,
    staleTime: Infinity,
  });

  const availableStopIds = useMemo(() => {
    if (!allStops || !Array.isArray(allStops)) return [];

    let filtered = allStops.filter((s: any) => {
      const type = s.location_type_name;
      return !type || type === '' || type === 'Stop';
    });

    if (stopName) {
      filtered = filtered.filter((s: any) => s.stop_name === stopName);
    }
    if (locationType && locationType.length > 0) {
      filtered = filtered.filter((s: any) =>
        locationType.includes(s.location_type_name),
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
  }, [allStops, stopName, locationType, wheelchairStatus, stopId]);

  const availableStopNames = useMemo(() => {
    if (!allStops || !Array.isArray(allStops)) return [];

    let filtered = allStops.filter((s: any) => {
      const type = s.location_type_name;
      return !type || type === '' || type === 'Stop';
    });

    if (stopId) {
      filtered = filtered.filter((s: any) => s.stop_id === stopId);
    }
    if (locationType && locationType.length > 0) {
      filtered = filtered.filter((s: any) =>
        locationType.includes(s.location_type_name),
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
  }, [allStops, stopId, locationType, wheelchairStatus, stopName]);

  const availableLocationTypes = useMemo(() => {
    if (!allStops || !Array.isArray(allStops)) return [];

    let filtered = allStops.filter((s: any) => {
      const type = s.location_type_name;
      return !type || type === '' || type === 'Stop';
    });

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

    const types = new Set<string>();
    filtered.forEach((s: any) => {
      if (s.location_type_name) types.add(s.location_type_name);
    });

    if (locationType) {
      locationType.forEach((type) => {

        if (type === 'Stop') {
          types.add(type);
        }
      });
    }

    return Array.from(types)
      .sort()
      .map((type) => ({
        label: type,
        value: type,
        color: rgbToHex(getStopColor(type, theme)),
      }));
  }, [allStops, stopId, stopName, wheelchairStatus, locationType, theme]);

  const availableWheelchairStatus = useMemo(() => {
    if (!allStops || !Array.isArray(allStops)) return [];

    let filtered = allStops.filter((s: any) => {
      const type = s.location_type_name;
      return !type || type === '' || type === 'Stop';
    });

    if (stopId) {
      filtered = filtered.filter((s: any) => s.stop_id === stopId);
    }
    if (stopName) {
      filtered = filtered.filter((s: any) => s.stop_name === stopName);
    }
    if (locationType && locationType.length > 0) {
      filtered = filtered.filter((s: any) =>
        locationType.includes(s.location_type_name),
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
        color: rgbToHex(WHEELCHAIR_STATUS[status]?.color || [128, 128, 128]),
      }));
  }, [allStops, stopId, stopName, locationType, wheelchairStatus]);

  const filteredData = useMemo(() => {
    if (!allStops || !Array.isArray(allStops)) return [];

    let filtered = allStops.filter((s: any) => {
      const type = s.location_type_name;
      return !type || type === '' || type === 'Stop';
    });

    if (stopId) {
      filtered = filtered.filter((s: any) => s.stop_id === stopId);
    }
    if (stopName) {
      filtered = filtered.filter((s: any) => s.stop_name === stopName);
    }
    if (locationType && locationType.length > 0) {
      filtered = filtered.filter((s: any) =>
        locationType.includes(s.location_type_name),
      );
    }
    if (wheelchairStatus && wheelchairStatus.length > 0) {
      filtered = filtered.filter((s: any) =>
        wheelchairStatus.includes(s.wheelchair_status),
      );
    }
    if (editStatus && editStatus.length > 0) {
      const isEdited = editStatus.includes("edited");
      const isNotEdited = editStatus.includes("not_edited");

      if (isEdited && !isNotEdited) {
        filtered = filtered.filter((s: any) => s.status && s.status !== '');
      } else if (isNotEdited && !isEdited) {
        filtered = filtered.filter((s: any) => !s.status || s.status === '');
      }
    }

    return filtered;
  }, [allStops, stopId, stopName, locationType, wheelchairStatus, editStatus]);

  useEffect(() => {
    if (search.selectedStopId && allStops && Array.isArray(allStops)) {
      const stop = allStops.find(
        (s: any) => s.stop_id === search.selectedStopId,
      );
      
      const currentStopId = ClickInfo?.object?.stop_id || ClickInfo?.stop_id;

      if (stop && (!ClickInfo || currentStopId !== search.selectedStopId)) {
        setClickInfo(stop);
      }
    } else if (!search.selectedStopId && ClickInfo) {
      setClickInfo(undefined);
    }
  }, [search.selectedStopId, allStops]);

  const handleSetClickInfo = useCallback(
    (value: any) => {
      setClickInfo(value);
      
      const stopId = value?.object?.stop_id || value?.stop_id;
      navigate({
        search: (prev) => ({
          ...prev,
          selectedStopId: stopId || undefined,
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

  const handleSetLocationType = useCallback(
    (value: string[]) => {
      navigate({
        search: (prev) => ({
          ...prev,
          locationType: value.length > 0 ? value : undefined,
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

  const handleSetEditStatus = useCallback(
    (value: string[]) => {
      navigate({
        search: (prev) => ({
          ...prev,
          editStatus: value.length > 0 ? value : undefined,
        }),
      });
    },
    [navigate],
  );

  const handleZoomToLocation = useCallback(
    (lat: number, lon: number) => {
      setViewState({
        latitude: lat,
        longitude: lon,
        zoom: 18,
      });
    },
    [],
  );

  const isLoading = allStopsLoading;

  const hasEditedItems = useMemo(() => {
    if (!allStops || !Array.isArray(allStops)) return false;
    return allStops.some((stop: any) => stop.status && stop.status !== '');
  }, [allStops]);

  return (
    <div className="p-4">
        <div className="flex flex-col gap-4">
          {}
          <TabHeader tabs={ToggleTabs} />

          {}
          <StopsHeader
            setOpen={setOpen}
            StopIdDropdown={stopId}
            setStopIdDropdown={handleSetStopId}
            StopsIdData={availableStopIds}
            LocationTypeData={availableLocationTypes}
            WheelChairStatusData={availableWheelchairStatus}
            StopsNameData={availableStopNames}
            StopNameDropDown={stopName}
            setStopNameDropDown={handleSetStopName}
            LocationTypeDropDown={locationType || []}
            setLocationTypeDropDown={handleSetLocationType}
            setWheelChairStatusDropDown={handleSetWheelchairStatus}
            WheelChairStatusDropDown={wheelchairStatus || []}
            EditStatusDropDown={editStatus || []}
            setEditStatusDropDown={handleSetEditStatus}
            hasEditedItems={hasEditedItems}
          />

          {}
          {isLoading ? (
            <div className="relative h-[74vh] w-full overflow-hidden flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : !filteredData ||
            !Array.isArray(filteredData) ||
            filteredData.length === 0 ? (
            <div className="relative h-[74vh] w-full border p-1 rounded-md overflow-hidden flex items-center justify-center">
              <div className="text-sm text-muted-foreground">
                No stops data available.
              </div>
            </div>
          ) : (
            <>
              <StopStationForm
                Data={filteredData}
                OpenValue={Open}
                setOpenValue={setOpen}
                ClickInfo={ClickInfo?.object || ClickInfo}
                setClickInfo={handleSetClickInfo}
                type="stop"
                onZoomToLocation={handleZoomToLocation}
              />
              <div className="relative h-[74vh] w-full overflow-hidden">
                <StopsMap
                  data={filteredData}
                  setOpen={setOpen}
                  ClickInfo={ClickInfo}
                  setClickInfo={handleSetClickInfo}
                  externalViewState={viewState}
                />
              </div>
            </>
          )}
        </div>
        <PageFooter />
      </div>
  );
}
