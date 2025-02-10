import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Map } from 'lucide-react';

import MapSection from "./MapSection";

function MapInput({ parts, control }) {
  const { watch, setValue } = useFormContext();

  const latValue = watch(parts.lat.name) || "";
  const lonValue = watch(parts.lon.name) || "";

  const latForMap = parseFloat(latValue);
  const lonForMap = parseFloat(lonValue);
  const validLat = !isNaN(latForMap);
  const validLon = !isNaN(lonForMap);

  const [hideValue, setHideValue] = useState(true);

  
  const onLatitudeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(parts.lat.name, e.target.value, { shouldDirty: true });
  };

  
  const onLongitudeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(parts.lon.name, e.target.value, { shouldDirty: true });
  };

  
  const onMapClick = (newLon: number, newLat: number) => {
    setValue(parts.lat.name, String(newLat), { shouldDirty: true });
    setValue(parts.lon.name, String(newLon), { shouldDirty: true });
  };

  return (
    <div className="mt-2">
      <div className="text-sm text-primary font-medium mb-3">
        Lat and Lon
      </div>
      <div className="border h-full rounded-sm p-3">
        <div className="space-y-2">
          <FormField
            key={parts.lat.name}
            control={control}
            name={parts.lat.name}
            rules={parts.lat.rules}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{parts.lat.label}</FormLabel>
                <FormControl>
                  {parts.lat.renderInput({
                    ...field,
                    value: latValue,
                    onChange: onLatitudeChange,
                  })}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            key={parts.lon.name}
            control={control}
            name={parts.lon.name}
            rules={parts.lon.rules}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{parts.lon.label}</FormLabel>
                <FormControl>
                  {parts.lon.renderInput({
                    ...field,
                    value: lonValue,
                    onChange: onLongitudeChange,
                  })}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="button" onClick={() => setHideValue(!hideValue)}>
            {
            hideValue ? (
              <>Add from Map<Map className="ml-3"/></>) : 
              "Hide Map"
            }
          </Button>
        </div>
        {!hideValue && (
          <div className="border h-full p-1 rounded-md mt-2">
            <div className="text-sm text-stone-500 p-2">
              Click the map to input lat/lon
            </div>
            <MapSection
              Data={parts.data}
              lat={validLat ? latForMap : undefined}
              lon={validLon ? lonForMap : undefined}
              onMapClick={onMapClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default MapInput;
