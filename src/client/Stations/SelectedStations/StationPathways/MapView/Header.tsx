import { useEffect, useState } from "react";

import { rgbToHex } from "@/components/colorUtil";
import Combobox from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multiselect";
import { Skeleton } from "@/components/ui/skeleton";
import { DualRangeSlider } from "@/components/ui/DualRangeSlider";


import { PathwayColors } from "@/components/style";


function Header({
  ConnectionType,
  ToStopsData,
  ToStop,
  setToStop,
  fromStopsData,
  FromStop,
  setFromStop,
  EmptyArcs,
  setEmptyArcs,
  setTimeRange,
  DirectionData,
  DirectionTypes,
  setDirectionTypes,
  TimeRange,
  timeIntervalRanges,
  pathwayTypeData,
  PathwayTypes,
  setPathwayTypes,
  RangesIsloading,
}) {
  const [sliderMinMax, setSliderMinMax] = useState();

  useEffect(() => {
    if (timeIntervalRanges && timeIntervalRanges.length > 0) {
      const min = Math.min(...timeIntervalRanges.map((range) => range.min));
      const max = Math.max(...timeIntervalRanges.map((range) => range.max));

      setSliderMinMax({ min, max });
      setTimeRange([min, max]);
    }
  }, [timeIntervalRanges]);

  return (
    <div className="flex flex-wrap md:flex-nowrap gap-3 mb-4">
      <div className="w-full md:w-1/2 flex flex-col">
        <div className="flex flex-wrap gap-2">
          <div className="w-full">
            {ToStopsData ? (
              <Combobox
                Selections={ToStopsData.map((item) => item.label)}
                Message="To Stop"
                value={ToStop}
                setValue={(val) => setToStop(val)}
              />
            ) : (
              <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
            )}
          </div>
          <div className="w-full">
            {fromStopsData ? (
              <Combobox
                Selections={fromStopsData.map((item) => item.label)}
                Message="From Stop"
                value={FromStop}
                setValue={(val) => setFromStop(val)}
              />
            ) : (
              <Skeleton className="h-12 rounded-md" />
            )}
          </div>
        </div>
      </div>
      <div className="w-full md:w-1/2">
        {
          ConnectionType === "directional" && (
            <>
              {DirectionData ? (
                <Combobox
                  Selections={DirectionData.map((item) => item.label)}
                  Message="Direction Type"
                  value={DirectionTypes}
                  setValue={(val) => setDirectionTypes(val)}
                />
              ) : (
                <Skeleton className="h-14 rounded-md " />
              )}
            </>
          )
        }
        {ConnectionType === "timeInterval" && (
          <div className="flex flex-wrap gap-4">
            <div className="w-full flex items-center">
              <Checkbox
                checked={EmptyArcs}
                onCheckedChange={(val) => setEmptyArcs(val)}
              />
              <span className="ml-2">Remove Null Connections</span>
            </div>
            <div className="w-full mt-4">
              {RangesIsloading ? (
                <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
              ) : !sliderMinMax ? (
                <div>
                  <h1>No Time Interval Data</h1>
                </div>
              ) : (
                <DualRangeSlider
                  label={(value) => <span>{value}</span>}
                  value={TimeRange}
                  onValueChange={(e) => setTimeRange(e)}
                  min={sliderMinMax.min}
                  max={sliderMinMax.max}
                />
              )}
            </div>
          </div>
        )
        }
        {
          ConnectionType === "PathwayTypes" && (
            <>
              {pathwayTypeData ? (
                <MultiSelect
                  options={pathwayTypeData.map(value => ({
                    ...value,
                    color: rgbToHex(PathwayColors[value.label].color),
                  }))}
                  onValueChange={(newValue) => setPathwayTypes(newValue)}
                  defaultValue={PathwayTypes}
                  placeholder="Connection Types"
                />
              ) : (
                <Skeleton className="h-12 rounded-md" />
              )
              }
            </>
          )
        }
      </div>
    </div>
  );
}

export default Header;
