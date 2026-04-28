import { useState, useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { BiMap, BiHide } from "react-icons/bi";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import MapSection from "./MapSection";

interface MapInputProps {
  parts: {
    data: any[];
    lat: {
      name: string;
      label: string;
      renderInput: (field: any) => React.ReactNode;
      rules?: any;
      editLabel?: any;
    };
    lon: {
      name: string;
      label: string;
      renderInput: (field: any) => React.ReactNode;
      rules?: any;
      editLabel?: any;
    };
  };
  control: any;
  isLoading?: boolean;
  submittedData?: any | null;
}

function MapInput({ parts, control, isLoading = false, submittedData = null }: MapInputProps) {
  const { watch, setValue, trigger } = useFormContext();

  const latValue = isLoading && submittedData ? submittedData[parts.lat.name] : (watch(parts.lat.name) || "");
  const lonValue = isLoading && submittedData ? submittedData[parts.lon.name] : (watch(parts.lon.name) || "");
  const locationType = watch("location_type_name") || "";

  const [isMapVisible, setIsMapVisible] = useState(false);

  const coordinates = useMemo(() => {
    const lat = parseFloat(latValue);
    const lon = parseFloat(lonValue);
    return {
      lat,
      lon,
      isValid: !isNaN(lat) && !isNaN(lon),
    };
  }, [latValue, lonValue]);

  const onLatitudeChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(parts.lat.name, e.target.value, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      await trigger(parts.lat.name);
    },
    [setValue, trigger, parts.lat.name],
  );

  const onLongitudeChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(parts.lon.name, e.target.value, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      await trigger(parts.lon.name);
    },
    [setValue, trigger, parts.lon.name],
  );

  const onMapClick = useCallback(
    async (newLon: number, newLat: number) => {
      setValue(parts.lat.name, String(newLat), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      setValue(parts.lon.name, String(newLon), { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      await trigger([parts.lat.name, parts.lon.name]);
    },
    [setValue, trigger, parts.lat.name, parts.lon.name],
  );

  const toggleMapVisibility = useCallback(() => {
    setIsMapVisible((prev) => !prev);
  }, []);

  return (
    <div className="mt-3">
      <div className="text-sm text-primary font-medium mb-2">
        Location Coordinates
      </div>
      <div className="border rounded-md p-3 space-y-3 overflow-hidden">
        {}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            key={parts.lat.name}
            control={control}
            name={parts.lat.name}
            rules={parts.lat.rules}
            render={({ field, fieldState }) => {
              const shouldShowError =
                !isLoading &&
                fieldState.error &&
                (fieldState.isTouched || fieldState.isDirty);

              const wrappedOnChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                await onLatitudeChange(e);
              };

              return (
                <FormItem>
                  <FormLabel>{parts.lat.label}</FormLabel>
                  {!isLoading && parts.lat.editLabel && (
                    <div className="text-xs text-muted-foreground">
                      Current: {parts.lat.editLabel}
                    </div>
                  )}
                  <FormControl>
                    {parts.lat.renderInput({
                      ...field,
                      value: latValue,
                      onChange: wrappedOnChange,
                      disabled: isLoading,
                    })}
                  </FormControl>
                  {shouldShowError && <FormMessage />}
                </FormItem>
              );
            }}
          />
          <FormField
            key={parts.lon.name}
            control={control}
            name={parts.lon.name}
            rules={parts.lon.rules}
            render={({ field, fieldState }) => {
              const shouldShowError =
                !isLoading &&
                fieldState.error &&
                (fieldState.isTouched || fieldState.isDirty);

              const wrappedOnChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                await onLongitudeChange(e);
              };

              return (
                <FormItem>
                  <FormLabel>{parts.lon.label}</FormLabel>
                  {!isLoading && parts.lon.editLabel && (
                    <div className="text-xs text-muted-foreground">
                      Current: {parts.lon.editLabel}
                    </div>
                  )}
                  <FormControl>
                    {parts.lon.renderInput({
                      ...field,
                      value: lonValue,
                      onChange: wrappedOnChange,
                      disabled: isLoading,
                    })}
                  </FormControl>
                  {shouldShowError && <FormMessage />}
                </FormItem>
              );
            }}
          />
        </div>

        {}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={toggleMapVisibility}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isMapVisible ? (
              <>
                <BiHide className="mr-2 h-4 w-4" />
                Hide Map
              </>
            ) : (
              <>
                <BiMap className="mr-2 h-4 w-4" />
                Select from Map
              </>
            )}
          </Button>
          {coordinates.isValid && !isMapVisible && (
            <span className="text-xs text-muted-foreground">
              {coordinates.lat.toFixed(6)}, {coordinates.lon.toFixed(6)}
            </span>
          )}
        </div>

        {}
        {isMapVisible && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              Click on the map to select coordinates
            </div>
            <div className="w-full overflow-hidden rounded-md">
              <MapSection
                Data={parts.data}
                lat={coordinates.isValid ? coordinates.lat : undefined}
                lon={coordinates.isValid ? coordinates.lon : undefined}
                onMapClick={onMapClick}
                locationType={locationType}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MapInput;
