import {
  TextField,
  Autocomplete,
  Skeleton,
  Slider,
  Checkbox,
  Chip,
} from "@mui/material";
import { rgbToHex } from "@/util/colorUtil";
import { PathwayColors } from "@/util/gtfsStyling";
import { useEffect, useState } from "react";

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
  const [sliderMinMax, setSliderMinMax] = useState(null);

  const handleToStopChange = (event, value) => {
    setToStop(value);
  };

  const handleFromStopChange = (event, value) => {
    setFromStop(value);
  };

  const onSliderChange = (event, newValue) => {
    setTimeRange(newValue);
  };

  const ChangeCheckbox = (event) => {
    setEmptyArcs(event.target.checked);
  };

  const handleDirectionChange = (event, newValue) => {
    setDirectionTypes(newValue);
  };

  const handlePathwayTypeChange = (event, newValue) => {
    setPathwayTypes(newValue);
  };

  useEffect(() => {
    if (timeIntervalRanges && timeIntervalRanges.length > 0) {
      const min = Math.min(...timeIntervalRanges.map((range) => range.min));
      const max = Math.max(...timeIntervalRanges.map((range) => range.max));

      setSliderMinMax({ min, max });
      setTimeRange([min, max]);
    }
  }, [timeIntervalRanges]);

  return (
    <div className="flex flex-wrap md:flex-nowrap gap-4 mb-10">
      <div className="w-full md:w-1/2 flex flex-col">
        <div className="flex flex-wrap gap-4">
          <div className="w-full">
            {ToStopsData ? (
              <Autocomplete
                fullWidth
                disablePortal
                value={ToStop ?? null}
                options={ToStopsData}
                onChange={handleToStopChange}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="To" />}
              />
            ) : (
              <Skeleton variant="rounded" height={56} />
            )}
          </div>
          <div className="w-full">
            {fromStopsData ? (
              <Autocomplete
                fullWidth
                disablePortal
                value={FromStop ?? null}
                options={fromStopsData}
                onChange={handleFromStopChange}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="From" />}
              />
            ) : (
              <Skeleton variant="rounded" height={56} />
            )}
          </div>
        </div>
      </div>
      <div className="w-full md:w-1/2">
        {ConnectionType === "directional" ? (
          <>
            {DirectionData ? (
              <Autocomplete
                fullWidth
                disablePortal
                value={DirectionTypes ?? null}
                options={DirectionData}
                onChange={handleDirectionChange}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Direction Type" />
                )}
              />
            ) : (
              <Skeleton variant="rounded" height={56} />
            )}
          </>
        ) : ConnectionType === "timeInterval" ? (
          <div className="flex flex-wrap gap-4">
            <div className="w-full flex items-center">
              <Checkbox
                checked={EmptyArcs}
                onChange={ChangeCheckbox}
                color="primary"
              />
              <span>Remove Null Connections</span>
            </div>
            <div className="w-full">
              {RangesIsloading ? (
                <Skeleton variant="rectangular" height={10} />
              ) : !sliderMinMax ? (
                <div>
                  <h1>No Time Interval Data</h1>
                  <Slider disabled value={[0, 100]} />
                </div>
              ) : (
                <Slider
                  value={TimeRange}
                  onChange={onSliderChange}
                  valueLabelDisplay="auto"
                  disableSwap
                  min={sliderMinMax.min}
                  max={sliderMinMax.max}
                />
              )}
            </div>
          </div>
        ) : ConnectionType === "PathwayTypes" ? (
          <>
            {pathwayTypeData ? (
              <Autocomplete
                fullWidth
                disablePortal
                multiple
                value={PathwayTypes || []}
                options={pathwayTypeData || []}
                getOptionLabel={(option) => option?.pathway_mode_name || ""}
                isOptionEqualToValue={(option, value) =>
                  option?.pathway_mode_name === value?.pathway_mode_name
                }
                onChange={handlePathwayTypeChange}
                renderInput={(params) => (
                  <TextField {...params} label="Pathway Type" />
                )}
                renderTags={(selected, getTagProps) =>
                  selected.map((option, index) => {
                    const pathwayName = option.pathway_mode_name;
                    const chipColor =
                      PathwayColors[pathwayName]?.color || "#defaultColor";
                    return (
                      <Chip
                        {...getTagProps({ index })}
                        key={pathwayName}
                        label={pathwayName}
                        style={{
                          backgroundColor: rgbToHex(chipColor),
                          color: "#fff",
                        }}
                      />
                    );
                  })
                }
              />
            ) : (
              <Skeleton variant="rounded" height={56} />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default Header;
