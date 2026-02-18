import { useMemo, useCallback, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useDuckDB } from "@/context/duckdb.client";
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  mutationAddStationFn,
  mutationEditStationFn,
  mutationUpgradeToStationFn,
  mutationDowngradeToStopFn,
} from "@/lib/duckdb/DataEditing/editingFn";
import { validateTableData } from "@/lib/duckdb/DataEditing/validatingData";
import { logger } from "@/lib/logger";
import { createStationsTable, createStopsTable, createStopsView } from "@/lib/extensions";
import { LOCATION_TYPE_CONFIGS } from "@/components/forms/FormComponent";

const INVALIDATION_KEYS = [
  "createStationTable",
  "createStopsTable",
  "fetchStationsData",
  "fetchStopsData",
  "fetchStopsIdData",
  "fetchStopsNamesData",
  "fetchStationData",
  "fetchStationInfoData",
] as const;

type UseStopStationFormProps = {
  Data: any[];
  ClickInfo: any;
  type: "station" | "stop";
  mode: "add" | "edit";
  parentStation?: string;
  onSuccess?: () => void;
  onZoomToLocation?: (lat: number, lon: number) => void;
};

export function useStopStationForm({
  Data,
  ClickInfo,
  type,
  mode,
  parentStation,
  onSuccess,
  onZoomToLocation,
}: UseStopStationFormProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const routerState = useRouterState();
  const duckDB = useDuckDB();
  const { conn } = duckDB || {};

  const isStation = type === "station";
  const isAddMode = mode === "add";
  const isEditMode = mode === "edit";
  const isChildNode = !!parentStation;

  const tableName = isStation ? "StationsTable" : "StopsTable";
  const entityName = isStation ? "Station" : "Stop";
  const placeholder = isStation ? "place-CM-0493" : "stop-123";
  const formHeader = isAddMode ? `Add ${entityName}` : `Edit ${entityName}`;
  const buttonLabel = isAddMode ? "Create" : "Edit";

  const locationTypeConfig = isStation
    ? LOCATION_TYPE_CONFIGS.STATION
    : isChildNode
    ? LOCATION_TYPE_CONFIGS.NODE
    : LOCATION_TYPE_CONFIGS.STOP;

  const refreshProcedures = useCallback(async () => {
    await createStopsView(conn);
    await createStationsTable(conn);
    await createStopsTable(conn);
  }, [conn]);

  const invalidateQueries = useCallback(() => {
    INVALIDATION_KEYS.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  }, [queryClient]);

  const handleMutationSuccess = useCallback(
    async (result: { stopId: string; lat?: number; lon?: number }) => {
      await refreshProcedures();
      invalidateQueries();
      onSuccess?.();

      if (result.stopId) {
        const currentPath = routerState.location.pathname;

        const isPart = !!parentStation;
        const searchParam = isPart
          ? "selectedNodeId"
          : isStation
          ? "selectedStationId"
          : "selectedStopId";

        let targetRoute = currentPath;

        if (currentPath.includes("/parts")) {
          if (currentPath.includes("/map")) {
            targetRoute = "/stations/parts/map";
          } else if (currentPath.includes("/table")) {
            targetRoute = "/stations/parts/table";
          } else {
            targetRoute = "/stations/parts/map";
          }
        } else if (currentPath.includes("/info")) {
          targetRoute = isStation ? "/stations/info" : "/stops/map";
        } else if (currentPath.includes("/pathways")) {
          targetRoute = "/stations/pathways/map/directional";
        } else if (currentPath.includes("/map")) {
          targetRoute = `${isStation ? "/stations" : "/stops"}/map`;
        } else if (currentPath.includes("/table")) {
          targetRoute = `${isStation ? "/stations" : "/stops"}/table`;
        } else {
          targetRoute = `${isStation ? "/stations" : "/stops"}/map`;
        }

        logger.log(`Navigating to ${targetRoute} with ${searchParam}: ${result.stopId}`);

        router.navigate({
          to: targetRoute,
          search: (prev) => ({ ...prev, [searchParam]: result.stopId }),
        });

        if (currentPath.includes("/map") && result.lat && result.lon && onZoomToLocation) {
          setTimeout(() => {
            onZoomToLocation(result.lat!, result.lon!);
          }, 100);
        }
      }
    },
    [refreshProcedures, invalidateQueries, router, routerState, isStation, parentStation, onZoomToLocation, onSuccess]
  );

  const mutationAddFn = useCallback(
    async (formData: any) => {
      await mutationAddStationFn({
        conn: conn,
        formData: formData,
      });
      return {
        stopId: formData.stopId,
        lat: parseFloat(formData.lat),
        lon: parseFloat(formData.lon),
      };
    },
    [conn]
  );

  const mutationEditFn = useCallback(
    async (formData: any) => {
      await mutationEditStationFn({
        conn: conn,
        formData: formData,
        SelectStation: ClickInfo,
      });
      return {
        stopId: formData.stopId || ClickInfo?.stop_id,
        lat: parseFloat(formData.lat) || parseFloat(ClickInfo?.stop_lat),
        lon: parseFloat(formData.lon) || parseFloat(ClickInfo?.stop_lon),
      };
    },
    [conn, ClickInfo]
  );

  const [isFormMutating, setIsFormMutating] = useState(false);

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      await mutationUpgradeToStationFn({
        conn: conn,
        SelectStation: ClickInfo,
      });
    },
    onSuccess: async () => {
      await refreshProcedures();
      invalidateQueries();
      onSuccess?.();

      const stationId = ClickInfo?.stop_id;
      const lat = parseFloat(ClickInfo?.stop_lat);
      const lon = parseFloat(ClickInfo?.stop_lon);

      if (stationId) {
        const currentPath = routerState.location.pathname;
        const isMapRoute = currentPath.includes("/map");
        const isTableRoute = currentPath.includes("/table");
        const routeSuffix = isMapRoute ? "/map" : isTableRoute ? "/table" : "/map";

        logger.log(`Navigating to /stations${routeSuffix} with selectedStationId: ${stationId}`);
        router.navigate({
          to: `/stations${routeSuffix}`,
          search: (prev) => ({ ...prev, selectedStationId: stationId }),
        });

        if (isMapRoute && lat && lon && onZoomToLocation) {
          setTimeout(() => {
            onZoomToLocation(lat, lon);
          }, 100);
        }
      }
    },
  });

  const downgradeMutation = useMutation({
    mutationFn: async () => {
      await mutationDowngradeToStopFn({
        conn: conn,
        SelectStation: ClickInfo,
      });
    },
    onSuccess: async () => {
      await refreshProcedures();
      invalidateQueries();
      onSuccess?.();

      const stopId = ClickInfo?.stop_id;
      const lat = parseFloat(ClickInfo?.stop_lat);
      const lon = parseFloat(ClickInfo?.stop_lon);

      if (stopId) {
        const currentPath = routerState.location.pathname;
        const isMapRoute = currentPath.includes("/map");
        const isTableRoute = currentPath.includes("/table");
        const routeSuffix = isMapRoute ? "/map" : isTableRoute ? "/table" : "/map";

        logger.log(`Navigating to /stops${routeSuffix} with selectedStopId: ${stopId}`);
        router.navigate({
          to: `/stops${routeSuffix}`,
          search: (prev) => ({ ...prev, selectedStopId: stopId }),
        });

        if (isMapRoute && lat && lon && onZoomToLocation) {
          setTimeout(() => {
            onZoomToLocation(lat, lon);
          }, 100);
        }
      }
    },
  });

  const inputData = useMemo(() => {
    const fields = [];

    if (isAddMode) {
      fields.push({
        name: "stopId",
        label: "Stop Id",
        type: "formField" as const,
        parts: {
          renderInput: (field: any) => (
            <Input
              ref={field.ref}
              type="text"
              placeholder={`eg. ${placeholder}`}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={field.disabled}
            />
          ),
          rules: {
            required: "Stop Id is required",
            pattern: {
              value: /^[a-zA-Z0-9-_]+$/,
              message: "Invalid Stop Id format",
            },
            validate: {
              checkDuplicate: async (value: string) => {
                if (!value || !/^[a-zA-Z0-9-_]+$/.test(value)) {
                  return true;
                }
                const queryResult = await validateTableData({
                  conn: conn,
                  table: tableName,
                  column: "stop_id",
                  value: value,
                });
                return queryResult || "Stop Id already exists";
              },
            },
          },
        },
      });
    }

    fields.push({
      name: "name",
      label: "Name",
      type: "formField" as const,
      parts: {
        ...(isEditMode && { editLabel: ClickInfo?.stop_name }),
        renderInput: (field: any) => (
          <Input
            ref={field.ref}
            type="text"
            placeholder={isStation ? "eg. Place de la Concorde" : "eg. Main Street"}
            value={field.value}
            onChange={field.onChange}
            disabled={field.disabled}
          />
        ),
        rules: {
          required: "Name is required",
        },
      },
    });

    fields.push({
      name: "wheelchair",
      label: "Wheelchair Accessible",
      type: "formField" as const,
      parts: {
        ...(isEditMode && { editLabel: ClickInfo?.wheelchair_status }),
        renderInput: ({ value, onChange, ref, disabled }: any) => (
          <Select
            value={value || ""}
            onValueChange={(val) => {
              onChange(val);
            }}
            disabled={disabled}
          >
            <SelectTrigger ref={ref}>
              <SelectValue placeholder="Select wheelchair accessibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="🔵">No Information 🔵</SelectItem>
              <SelectItem value="🟢">Accessible 🟢</SelectItem>
              <SelectItem value="🔴">Not Accessible 🔴</SelectItem>
              <SelectItem value="🟡">Unknown 🟡</SelectItem>
            </SelectContent>
          </Select>
        ),
        rules: {
          required: "Wheelchair accessibility is required",
        },
      },
    });

    fields.push({
      name: "location",
      type: "map" as const,
      parts: {
        data: Data,
        lat: {
          name: "lat",
          label: "Latitude",
          ...(isEditMode && { editLabel: ClickInfo?.stop_lat }),
          renderInput: (field: any) => (
            <Input
              ref={field.ref}
              type="number"
              placeholder="eg. 48.865"
              step={0.00000000000000001}
              value={field.value}
              onChange={field.onChange}
              disabled={field.disabled}
            />
          ),
          rules: {
            required: "Latitude is required",
            min: { value: -90, message: "Latitude must be >= -90" },
            max: { value: 90, message: "Latitude must be <= 90" },
          },
        },
        lon: {
          name: "lon",
          label: "Longitude",
          ...(isEditMode && { editLabel: ClickInfo?.stop_lon }),
          renderInput: (field: any) => (
            <Input
              ref={field.ref}
              type="number"
              placeholder="eg. 2.321"
              step={0.00000000000000001}
              value={field.value}
              onChange={field.onChange}
              disabled={field.disabled}
            />
          ),
          rules: {
            required: "Longitude is required",
            min: { value: -180, message: "Longitude must be >= -180" },
            max: { value: 180, message: "Longitude must be <= 180" },
          },
        },
      },
    });

    return fields;
  }, [ClickInfo, Data, conn, tableName, placeholder, isStation, isAddMode, isEditMode]);

  const defaultValues = useMemo(() => {
    if (isAddMode) {
      return {
        stopId: "",
        name: "",
        location_type_name: locationTypeConfig.defaultValue || "",
        wheelchair: "",
        parent_station: parentStation || "",
        lat: "",
        lon: "",
      };
    } else {
      return {
        stopId: ClickInfo?.stop_id || "",
        name: ClickInfo?.stop_name || "",
        location_type_name: ClickInfo?.location_type_name || "",
        wheelchair: ClickInfo?.wheelchair_status || "",
        parent_station: ClickInfo?.parent_station || "",
        lat: ClickInfo?.stop_lat || "",
        lon: ClickInfo?.stop_lon || "",
      };
    }
  }, [mode, ClickInfo, parentStation, isAddMode, locationTypeConfig]);

  const customActions = useMemo(() => {
    if (!isEditMode) return null;

    const canUpgrade = !isStation && ClickInfo?.location_type_name === "Stop";
    const canDowngrade = isStation && ClickInfo?.location_type_name === "Station";

    return (
      <>
        {!isStation && (
          <button
            type="button"
            onClick={() => upgradeMutation.mutate()}
            disabled={upgradeMutation.isPending || !canUpgrade || isFormMutating}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canUpgrade ? "Only stops with type 'Stop' can be upgraded to stations" : ""}
          >
            {upgradeMutation.isPending ? "Upgrading..." : "Upgrade to Station"}
          </button>
        )}
        {isStation && (
          <button
            type="button"
            onClick={() => downgradeMutation.mutate()}
            disabled={downgradeMutation.isPending || !canDowngrade || isFormMutating}
            className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canDowngrade ? "Only stations with type 'Station' can be downgraded" : ""}
          >
            {downgradeMutation.isPending ? "Downgrading..." : "Downgrade to Stop"}
          </button>
        )}
      </>
    );
  }, [isEditMode, isStation, ClickInfo, upgradeMutation, downgradeMutation, isFormMutating]);

  return {
    inputData,
    mutationFn: isAddMode ? mutationAddFn : mutationEditFn,
    header: formHeader,
    buttonLabel,
    onSuccess: handleMutationSuccess,
    onReset: invalidateQueries,
    defaultValues,
    customActions,
    disableInputs: upgradeMutation.isPending || downgradeMutation.isPending || isFormMutating,
    locationType: isAddMode ? locationTypeConfig : undefined,
    validationMode: "onChange" as const,
    onMutationStateChange: setIsFormMutating,
  };
}
