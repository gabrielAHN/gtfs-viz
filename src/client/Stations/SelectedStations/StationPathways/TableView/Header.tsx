import { useEffect, useState } from "react";
import { getStopColor } from "@/components/style";
import { useThemeContext } from "@/context/theme.client";
import { logger } from "@/lib/logger";

import { rgbToHex } from "@/components/colorUtil";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Combobox from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multiselect";
import { SmartRangeSlider } from "@/components/ui/SmartRangeSlider"
import { Skeleton } from "@/components/ui/skeleton";
import { BiReset } from "react-icons/bi";

function Header({
  EmptyConnect,
  setEmptyConnect,
  StartStops,
  StartDropdown,
  setStartDropdown,
  StartStopTypes,
  StartStopTypesDropdown,
  setStartStopTypesDropdown,
  EndStops,
  EndDropdown,
  setEndDropdown,
  EndStopTypes,
  EndStopTypesDropdown,
  setEndStopTypesDropdown,
  timeIntervalRanges,
  TimeRange,
  setTimeRange,
}) {
  const { theme } = useThemeContext();
  const [availableValues, setAvailableValues] = useState<number[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (timeIntervalRanges && timeIntervalRanges.length > 0 && !isInitialized) {
      
      const values = new Set<number>();
      timeIntervalRanges.forEach((range) => {
        if (typeof range.min === "number" && typeof range.max === "number") {
          values.add(range.min);
          values.add(range.max);
        }
      });

      const sortedValues = Array.from(values).sort((a, b) => a - b);
      setAvailableValues(sortedValues);

      if (sortedValues.length > 0) {
        logger.log('[Header] Setting initial TimeRange:', [sortedValues[0], sortedValues[sortedValues.length - 1]]);
        setTimeRange([sortedValues[0], sortedValues[sortedValues.length - 1]]);
        setIsInitialized(true);
      }
    }
  }, [timeIntervalRanges]);

  const handleReset = () => {
    setEmptyConnect(false);
    setStartDropdown(undefined);
    setStartStopTypesDropdown([]);
    setEndDropdown(undefined);
    setEndStopTypesDropdown([]);

    if (availableValues.length > 0) {
      setTimeRange([availableValues[0], availableValues[availableValues.length - 1]]);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 p-4">
      <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-end mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="gap-2"
        >
          <BiReset className="h-4 w-4" />
          Reset Filters
        </Button>
      </div>
      <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col md:flex-row lg:flex-row items-start md:items-center gap-4">
        <div className="flex items-center w-full md:w-auto">
          <Checkbox
            checked={EmptyConnect}
            onCheckedChange={(val) => setEmptyConnect(val)}
          />
          <span className="ml-2">Remove Null Connections</span>
        </div>
        <div className="w-full">
          {!TimeRange ? (
            <Skeleton className="h-10 rounded-md flex-1 min-w-[200px]" />
          ) : availableValues.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No Time Interval Data
            </div>
          ) : (
            <SmartRangeSlider
              values={availableValues}
              selectedRange={TimeRange as [number, number]}
              onRangeChange={(range) => setTimeRange(range)}
              label={(value) => `${value}s`}
            />
          )}
        </div>
      </div>
      <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col md:flex-row lg:flex-row items-start gap-4">
        <div className="w-full md:w-1/2">
          {StartStops && StartStops.length > 0 ? (
            <Combobox
              Selections={StartStops.map((item) => item.stop_id)}
              Message="Start Stop ID"
              value={StartDropdown}
              setValue={(val) => setStartDropdown(val)}
            />
          ) : (
            <Skeleton className="h-12 rounded-md w-full" />
          )}
        </div>
        <div className="w-full md:w-1/2">
          {StartStopTypes && StartStopTypes.length > 0 ? (
            <MultiSelect
              options={StartStopTypes.map((item) => ({
                label: item,
                value: item,
                color: rgbToHex(getStopColor(item, theme)),
              }))}
              onValueChange={(newValue) => setStartStopTypesDropdown(newValue)}
              defaultValue={StartStopTypesDropdown}
              placeholder="Start Stop Type"
            />
          ) : (
            <Skeleton className="h-12 rounded-md w-full" />
          )}
        </div>
      </div>
      <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col md:flex-row lg:flex-row items-start gap-4">
        <div className="w-full md:w-1/2">
          {EndStops && EndStops.length > 0 ? (
            <Combobox
              Selections={EndStops.map((item) => item.stop_id)}
              Message="End Stop ID"
              value={EndDropdown}
              setValue={(val) => setEndDropdown(val)}
            />
          ) : (
            <Skeleton className="h-12 rounded-md w-full" />
          )}
        </div>
        <div className="w-full md:w-1/2">
          {EndStopTypes && EndStopTypes.length > 0 ? (
            <MultiSelect
              options={EndStopTypes.map((item) => ({
                label: item,
                value: item,
                color: rgbToHex(getStopColor(item, theme)),
              }))}
              onValueChange={(newValue) => setEndStopTypesDropdown(newValue)}
              defaultValue={EndStopTypesDropdown}
              placeholder="End Stop Type"
            />
          ) : (
            <Skeleton className="h-12 rounded-md w-full" />
          )}
        </div>
      </div>
    </div>

  );
}

export default Header;
