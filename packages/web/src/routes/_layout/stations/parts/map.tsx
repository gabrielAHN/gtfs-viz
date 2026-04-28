import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchCheckStationData } from "@/lib/duckdb/DataFetching/fetchStationInfoData";
import PartsHeader from "@/client/Stations/SelectedStations/StationParts/Header";
import StopStationForm from "@/components/forms/StopStationForms";
import PartsMap from "@/client/Stations/SelectedStations/StationParts/MapView";
import { WHEELCHAIR_STATUS } from "@/components/style";
import { rgbToHex } from "@/components/colorUtil";

type PartsMapSearchParams = {
  selectedStationId?: string;
  locationTypes?: string[];
  stopId?: string;
  wheelchairStatus?: string[];
  editStatus?: string[];
  selectedNodeId?: string;
  timeRangeMin?: number;
  timeRangeMax?: number;
};

export const Route = createFileRoute("/_layout/stations/parts/map")({
  component: PartsMapPage,
  validateSearch: (search: Record<string, unknown>): PartsMapSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      locationTypes: Array.isArray(search.locationTypes)
        ? search.locationTypes as string[]
        : search.locationTypes
        ? [search.locationTypes as string]
        : undefined,
      stopId: search.stopId as string | undefined,
      wheelchairStatus: Array.isArray(search.wheelchairStatus)
        ? search.wheelchairStatus as string[]
        : search.wheelchairStatus
        ? [search.wheelchairStatus as string]
        : undefined,
      editStatus: Array.isArray(search.editStatus)
        ? search.editStatus as string[]
        : search.editStatus
        ? [search.editStatus as string]
        : undefined,
      selectedNodeId: search.selectedNodeId as string | undefined,
      timeRangeMin: search.timeRangeMin as number | undefined,
      timeRangeMax: search.timeRangeMax as number | undefined,
    };
  },
});

function PartsMapPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { conn } = useDuckDB();

  const [Open, setOpen] = useState({ formType: null, state: false });
  const [ClickInfo, setClickInfo] = useState();
  const [viewState, setViewState] = useState();

  const stationId = search.selectedStationId;
  const locationTypes = search.locationTypes;
  const stopId = search.stopId;
  const wheelchairStatus = search.wheelchairStatus;
  const editStatus = search.editStatus;
  const selectedNodeId = search.selectedNodeId;

  const { data: allStationParts, isLoading } = useQuery({
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
    enabled: !!conn && !!stationId,
    staleTime: Infinity,
  });

  const availableStopIds = useMemo(() => {
    if (!allStationParts || !Array.isArray(allStationParts)) return [];

    let parts = allStationParts;

    if (locationTypes && locationTypes.length > 0) {
      parts = allStationParts.filter((part: any) =>
        locationTypes.includes(part.location_type_name)
      );
    }

    const stopIds = new Set<string>();
    parts.forEach((part: any) => {
      if (part.stop_id) stopIds.add(part.stop_id);
    });

    if (stopId) {
      stopIds.add(stopId);
    }

    return Array.from(stopIds).sort().map(id => ({
      label: id,
      value: id
    }));
  }, [allStationParts, locationTypes, stopId]);

  const availablePartTypes = useMemo(() => {
    if (!allStationParts || !Array.isArray(allStationParts)) return [];

    let parts = allStationParts;

    if (stopId) {
      parts = allStationParts.filter((part: any) => part.stop_id === stopId);
    }

    const types = new Set<string>();
    parts.forEach((part: any) => {
      if (part.location_type_name) types.add(part.location_type_name);
    });

    if (locationTypes && locationTypes.length > 0) {
      locationTypes.forEach(type => types.add(type));
    }

    return Array.from(types).sort().map(typeName => ({
      label: typeName,
      value: typeName,
    }));
  }, [allStationParts, stopId, locationTypes]);

  const availableWheelchairStatus = useMemo(() => {
    if (!allStationParts || !Array.isArray(allStationParts)) return [];

    let parts = allStationParts;

    if (stopId) {
      parts = parts.filter((part: any) => part.stop_id === stopId);
    }
    if (locationTypes && locationTypes.length > 0) {
      parts = parts.filter((part: any) =>
        locationTypes.includes(part.location_type_name)
      );
    }

    const statuses = new Set<string>();
    parts.forEach((part: any) => {
      if (part.wheelchair_status) statuses.add(part.wheelchair_status);
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
  }, [allStationParts, stopId, locationTypes, wheelchairStatus]);

  const data = useMemo(() => {
    if (!allStationParts || !Array.isArray(allStationParts)) return [];

    let filtered = allStationParts;

    if (locationTypes && locationTypes.length > 0) {
      filtered = filtered.filter((part: any) =>
        locationTypes.includes(part.location_type_name)
      );
    }

    if (stopId) {
      filtered = filtered.filter((part: any) => part.stop_id === stopId);
    }

    if (wheelchairStatus && wheelchairStatus.length > 0) {
      filtered = filtered.filter((part: any) =>
        wheelchairStatus.includes(part.wheelchair_status)
      );
    }

    if (editStatus && editStatus.length > 0) {
      const isEdited = editStatus.includes("edited");
      const isNotEdited = editStatus.includes("not_edited");

      if (isEdited && !isNotEdited) {
        filtered = filtered.filter((part: any) => part.status && part.status !== '');
      } else if (isNotEdited && !isEdited) {
        filtered = filtered.filter((part: any) => !part.status || part.status === '');
      }
    }

    return filtered;
  }, [allStationParts, locationTypes, stopId, wheelchairStatus, editStatus]);

  useEffect(() => {
    if (selectedNodeId && allStationParts && Array.isArray(allStationParts)) {
      const part = allStationParts.find((p: any) => p.stop_id === selectedNodeId);
      if (part) {
        setClickInfo({ ...part });
      }
    } else if (!selectedNodeId && ClickInfo) {
      setClickInfo(undefined);
    }
  }, [selectedNodeId, allStationParts]);

  const handleSetClickInfo = useCallback((value: any) => {
    setClickInfo(value);
    const nodeId = value?.object?.stop_id || value?.stop_id;
    navigate({
      search: (prev) => ({
        ...prev,
        selectedNodeId: nodeId || undefined
      }),
      replace: true,
    });
  }, [navigate]);

  const hasEditedItems = useMemo(() => {
    if (!allStationParts || !Array.isArray(allStationParts)) return false;
    return allStationParts.some((part: any) =>
      part.location_type !== 1 && part.status && part.status !== ''
    );
  }, [allStationParts]);

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

  if (!stationId) {
    return (
      <div className="relative h-[70vh] w-full border p-1 rounded-md overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          No station selected.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="relative h-[70vh] w-full border p-1 rounded-md overflow-hidden flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading platform data...</div>
      </div>
    );
  }

  return (
    <div>
      <PartsHeader
        StationPartTypes={availablePartTypes}
        LocationsList={locationTypes || []}
        setLocationsList={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              locationTypes: value && value.length > 0 ? value : undefined
            })
          });
        }}
        StationStopIds={availableStopIds}
        StopsID={stopId}
        setStopsID={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              stopId: value || undefined
            })
          });
        }}
        WheelchairStatusData={availableWheelchairStatus}
        WheelchairStatusList={wheelchairStatus || []}
        setWheelchairStatusList={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              wheelchairStatus: value && value.length > 0 ? value : undefined
            })
          });
        }}
        EditStatusList={editStatus || []}
        setEditStatusList={(value) => {
          navigate({
            search: (prev) => ({
              ...prev,
              editStatus: value && value.length > 0 ? value : undefined
            })
          });
        }}
        setOpen={setOpen}
        onReset={() => {
          navigate({
            search: (prev) => ({
              selectedStationId: prev.selectedStationId,
              selectedNodeId: prev.selectedNodeId
            })
          });
        }}
        hasEditedItems={hasEditedItems}
      />
      <StopStationForm
        Data={data}
        OpenValue={Open}
        setOpenValue={setOpen}
        ClickInfo={ClickInfo?.object || ClickInfo}
        setClickInfo={handleSetClickInfo}
        type="stop"
        parentStation={stationId}
        onZoomToLocation={handleZoomToLocation}
      />
      <div className="relative h-[74vh] w-full overflow-hidden">
        <PartsMap
          data={data}
          setOpen={setOpen}
          ClickInfo={ClickInfo}
          setClickInfo={handleSetClickInfo}
          externalViewState={viewState}
        />
      </div>
    </div>
  );
}
