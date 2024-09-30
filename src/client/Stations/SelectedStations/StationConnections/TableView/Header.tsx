import { useEffect, useState } from "react";
import {
  Checkbox,
  Autocomplete,
  TextField,
  FormGroup,
  FormControlLabel,
  Skeleton,
  Chip,
  Slider,
} from "@mui/material";
import { StopTypeColors } from "@/util/gtfsStyling";
import { rgbToHex } from "@/util/colorUtil";

function Header({
  EmptyConnect,
  setEmptyConnect,
  StartStops,
  setStartDropdown,
  EndStops,
  setEndDropdown,
  setStartStopTypesDropdown,
  StartStopTypes,
  setEndStopTypesDropdown,
  EndStopTypes,
  timeIntervalRanges,
  TimeRange,
  setTimeRange,
}) {
  const [sliderMinMax, setSliderMinMax] = useState(null);
  const [isInitialRangeSet, setIsInitialRangeSet] = useState(false);

  const minDistance = 10;

  const ChangeCheckbox = (event) => {
    setEmptyConnect(event.target.checked);
  };

  const handleStartStopChange = (event, value) => {
    setStartDropdown(value);
  };
  const handleEndStopChange = (event, value) => {
    setEndDropdown(value);
  };

  const handleStartStopTypesChange = (event, value) => {
    setStartStopTypesDropdown(value);
  };
  const handleEndStopTypesChange = (event, value) => {
    setEndStopTypesDropdown(value);
  };

  const onSliderChange = (event, newValue) => {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4">
      <div className="col-span-1 md:col-span-2 lg:col-span-2 flex flex-col md:flex-row lg:flex-row items-start md:items-center gap-4">
        <FormGroup className="w-full md:w-auto">
          <FormControlLabel
            control={
              <Checkbox
                checked={EmptyConnect}
                onChange={ChangeCheckbox}
                color="primary"
              />
            }
            label="Empty Connect"
          />
        </FormGroup>

        <div className="w-full md:flex-1">
          {!TimeRange ? (
            <Skeleton variant="rectangular" height={40} />
          ) : !sliderMinMax ? (
            <div>
              <h1 className="text-red-500">No Time Interval Data</h1>
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
              marks={[
                { value: sliderMinMax.min, label: `${sliderMinMax.min}` },
                { value: sliderMinMax.max, label: `${sliderMinMax.max}` },
              ]}
              aria-labelledby="time-range-slider"
              className="w-full"
            />
          )}
        </div>
      </div>

      <div className="col-span-1">
        {StartStops && StartStops.length > 0 ? (
          <Autocomplete
            fullWidth
            disablePortal
            options={StartStops.map((item) => item.stop_id)}
            onChange={handleStartStopChange}
            isOptionEqualToValue={(option, value) => option === value}
            renderInput={(params) => (
              <TextField {...params} label="Start Stop ID" />
            )}
          />
        ) : (
          <Skeleton variant="rounded" height={56} />
        )}
      </div>

      <div className="col-span-1">
        {StartStopTypes && StartStopTypes.length > 0 ? (
          <Autocomplete
            fullWidth
            disablePortal
            multiple
            options={StartStopTypes}
            onChange={handleStartStopTypesChange}
            isOptionEqualToValue={(option, value) => option === value}
            renderInput={(params) => (
              <TextField {...params} label="Start Stop Types" />
            )}
            renderTags={(selected, getTagProps) =>
              selected.map((option, index) => {
                const chipColor =
                  StopTypeColors[option]?.color || "#defaultColor";
                return (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
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
      </div>

      <div className="col-span-1">
        {EndStops && EndStops.length > 0 ? (
          <Autocomplete
            fullWidth
            disablePortal
            options={EndStops.map((item) => item.stop_id)}
            onChange={handleEndStopChange}
            isOptionEqualToValue={(option, value) => option === value}
            renderInput={(params) => (
              <TextField {...params} label="End Stop ID" />
            )}
          />
        ) : (
          <Skeleton variant="rounded" height={56} />
        )}
      </div>

      <div className="col-span-1">
        {EndStopTypes && EndStopTypes.length > 0 ? (
          <Autocomplete
            fullWidth
            disablePortal
            multiple
            options={EndStopTypes}
            onChange={handleEndStopTypesChange}
            isOptionEqualToValue={(option, value) => option === value}
            renderInput={(params) => (
              <TextField {...params} label="End Stop Types" />
            )}
            renderTags={(selected, getTagProps) =>
              selected.map((option, index) => {
                const chipColor =
                  StopTypeColors[option]?.color || "#defaultColor";
                return (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
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
      </div>
    </div>
  );
}

export default Header;
