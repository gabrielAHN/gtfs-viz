import { useEffect, useState } from "react";
import { StopTypeColors } from "@/components/style";

import { rgbToHex } from "@/components/colorUtil";
import { Checkbox } from "@/components/ui/checkbox";
import Combobox from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multiselect";
import { DualRangeSlider } from "@/components/ui/DualRangeSlider"
import { Skeleton } from "@/components/ui/skeleton";


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
  const [sliderMinMax, setSliderMinMax] = useState(null);
  const [isInitialRangeSet, setIsInitialRangeSet] = useState(false);

  const minDistance = 10;


  const onSliderChange = (newValue) => {
    if (Array.isArray(newValue)) {
      const [newMin, newMax] = newValue;

      if (newMax - newMin >= minDistance) {
        setTimeRange(newValue);
      } else {
        const [currentMin, currentMax] = TimeRange;
        if (newMin !== currentMin) {
          setTimeRange([newMin, newMin + minDistance]);
        } else {
          setTimeRange([newMax - minDistance, newMax]);
        }
      }
    }
  };

  useEffect(() => {
    if (timeIntervalRanges && timeIntervalRanges.length > 0) {

      const validRanges = timeIntervalRanges.filter(
        (range) =>
          typeof range.min === "number" && typeof range.max === "number"
      );

      if (validRanges.length === 0) {
        setSliderMinMax(null);
        return;
      }

      const min = Math.min(...validRanges.map((range) => range.min));
      const max = Math.max(...validRanges.map((range) => range.max));

      setSliderMinMax({ min, max });

      if (!isInitialRangeSet) {
        setTimeRange([min, max]);
        setIsInitialRangeSet(true);
      }
    }
  }, [timeIntervalRanges, isInitialRangeSet, setTimeRange]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 p-4">
      <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-col md:flex-row lg:flex-row items-start md:items-center gap-4">
        <div className="flex items-center w-full md:w-auto">
          <Checkbox
            checked={EmptyConnect}
            onCheckedChange={(val) => setEmptyConnect(val)}
          />
          <span className="ml-2">Empty Connect</span>
        </div>
        <div className="w-full">
          {!TimeRange ? (
            <Skeleton className="h-10 rounded-md flex-1 min-w-[200px]" />
          ) : !sliderMinMax ? (
            <div>
              <h1>No Time Interval Data</h1>
            </div>
          ) : (
            <DualRangeSlider
              label={(value) => <span>{value}</span>}
              value={TimeRange}
              onValueChange={onSliderChange}
              min={sliderMinMax.min}
              max={sliderMinMax.max}
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
                color: rgbToHex(StopTypeColors[item].color),
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
                color: rgbToHex(StopTypeColors[item].color),
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
