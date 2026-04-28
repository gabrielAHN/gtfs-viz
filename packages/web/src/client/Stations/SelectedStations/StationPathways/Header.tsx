import { useEffect, useState } from "react";
import { Accessibility } from "lucide-react";
import { rgbToHex } from "@/components/colorUtil";
import Combobox from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { BiHide, BiShow, BiReset } from "react-icons/bi";
import { MultiSelect } from "@/components/ui/multiselect";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartRangeSlider } from "@/components/ui/SmartRangeSlider";
import { Switch } from "@/components/ui/switch";
import { getPathwayColor, getStopColor } from "@/components/style";
import { useThemeContext } from "@/context/theme.client";

const getNullButtonLabel = (hasNullConnections: boolean, isHidden: boolean): string => {
  if (!hasNullConnections) {
    return "No Null Connections";
  }
  return isHidden ? "Show Null Connections" : "Showing Null Connections";
};

interface PathwaysHeaderProps {
  mode: "map" | "table";
  isLoading?: boolean;

  connectionType?: "directional" | "timeInterval" | "PathwayTypes";
  ToStopsData?: any[];
  ToStop?: any;
  setToStop?: (value: any) => void;
  fromStopsData?: any[];
  FromStop?: any;
  setFromStop?: (value: any) => void;
  EmptyArcs?: boolean;
  setEmptyArcs?: (value: boolean) => void;
  hasNullConnections?: boolean;
  DirectionData?: any[];
  DirectionTypes?: any;
  setDirectionTypes?: (value: any) => void;
  pathwayTypeData?: any[];
  PathwayTypes?: any[];
  setPathwayTypes?: (value: any[]) => void;
  ShowOnlyConnected?: boolean;
  setShowOnlyConnected?: (value: boolean) => void;

  viewType?: "start" | "end";
  EmptyConnect?: boolean;
  setEmptyConnect?: (value: boolean) => void;
  StartDropdown?: any;
  setStartDropdown?: (value: any) => void;
  EndDropdown?: any;
  setEndDropdown?: (value: any) => void;
  StartStops?: any[];
  setStartStops?: (value: any[]) => void;
  EndStops?: any[];
  setEndStops?: (value: any[]) => void;
  StartStopTypes?: any[];
  setStartStopTypes?: (value: any[]) => void;
  StartStopTypesDropdown?: any[];
  setStartStopTypesDropdown?: (value: any[]) => void;
  EndStopTypes?: any[];
  setEndStopTypes?: (value: any[]) => void;
  EndStopTypesDropdown?: any[];
  setEndStopTypesDropdown?: (value: any[]) => void;
  hasNullConnections?: boolean;
  wheelchairAccessibleOnly?: boolean;
  onWheelchairAccessibleOnlyChange?: (value: boolean) => void;
  showWheelchairAccessibleSwitch?: boolean;
  hasTimedConnections?: boolean;

  timeIntervalRanges?: any[];
  timeIntervalValues?: number[];
  showTimeRangeSlider?: boolean;
  TimeRange?: [number, number];
  defaultTimeRange?: [number, number];
  setTimeRange?: (value: [number, number] | undefined | { exclude: number }) => void;
  ExcludeTime?: number;
  onReset?: () => void;
  sliderResetKey?: string | number;
}

function PathwaysHeader(props: PathwaysHeaderProps) {
  const {
    mode,
    isLoading,
    timeIntervalRanges,
    timeIntervalValues,
    TimeRange,
    defaultTimeRange,
    setTimeRange,
    showTimeRangeSlider = true,
    connectionType,
    ToStop,
    FromStop,
    StartDropdown,
    EndDropdown,
    sliderResetKey = 'default',
  } = props;
  const { theme } = useThemeContext();
  const [availableValues, setAvailableValues] = useState<number[]>([]);
  const [prevFilters, setPrevFilters] = useState<{ toStop?: any; fromStop?: any; startDropdown?: any; endDropdown?: any }>({});

  useEffect(() => {
    
    let sortedValues: number[] = [];

    if (timeIntervalValues && timeIntervalValues.length > 0) {
      
      sortedValues = [...timeIntervalValues].sort((a, b) => a - b);
    } else if (timeIntervalRanges && timeIntervalRanges.length > 0) {
      
      const values = new Set<number>();
      timeIntervalRanges.forEach((range) => {
        if (typeof range.min === "number" && typeof range.max === "number") {
          values.add(range.min);
          values.add(range.max);
        }
      });
      sortedValues = Array.from(values).sort((a, b) => a - b);
    }

    const valuesChanged = sortedValues.length !== availableValues.length ||
      sortedValues.some((val, idx) => val !== availableValues[idx]);

    if (valuesChanged) {
      setAvailableValues(sortedValues);
    }

    const filtersChanged =
      prevFilters.toStop !== ToStop ||
      prevFilters.fromStop !== FromStop ||
      prevFilters.startDropdown !== StartDropdown ||
      prevFilters.endDropdown !== EndDropdown;

    if (sortedValues.length > 0 && setTimeRange && TimeRange) {
      if (filtersChanged) {
        const filtersAreSet = ToStop || FromStop || StartDropdown || EndDropdown;
        if (filtersAreSet) {
          setTimeRange([sortedValues[0], sortedValues[sortedValues.length - 1]]);
        }
        setPrevFilters({ toStop: ToStop, fromStop: FromStop, startDropdown: StartDropdown, endDropdown: EndDropdown });
      } else if (TimeRange[0] < sortedValues[0] || TimeRange[1] > sortedValues[sortedValues.length - 1]) {
        const newMin = Math.max(TimeRange[0], sortedValues[0]);
        const newMax = Math.min(TimeRange[1], sortedValues[sortedValues.length - 1]);
        setTimeRange([newMin, newMax]);
      }
    }

    if (filtersChanged && !TimeRange) {
      setPrevFilters({ toStop: ToStop, fromStop: FromStop, startDropdown: StartDropdown, endDropdown: EndDropdown });
    }
  }, [timeIntervalRanges, timeIntervalValues, setTimeRange, TimeRange, ToStop, FromStop, StartDropdown, EndDropdown, prevFilters.toStop, prevFilters.fromStop, prevFilters.startDropdown, prevFilters.endDropdown, availableValues]);

  if (mode === "map") {
    const {
      connectionType,
      ToStopsData,
      ToStop,
      setToStop,
      fromStopsData,
      FromStop,
      setFromStop,
      EmptyArcs,
      setEmptyArcs,
      hasNullConnections,
      DirectionData,
      DirectionTypes,
      setDirectionTypes,
      pathwayTypeData,
      PathwayTypes,
      setPathwayTypes,
      ShowOnlyConnected,
      setShowOnlyConnected,
    } = props;

    if (connectionType === "timeInterval") {
      const { onReset, ExcludeTime } = props;

      const isSliderChanged = TimeRange !== undefined &&
        defaultTimeRange !== undefined &&
        (TimeRange[0] !== defaultTimeRange[0] ||
         TimeRange[1] !== defaultTimeRange[1]);

      const hasActiveFilters = !!(
        ToStop ||
        FromStop ||
        EmptyArcs ||
        isSliderChanged ||
        (ExcludeTime !== undefined) ||
        ShowOnlyConnected
      );

      return (
        <div className="flex flex-wrap md:flex-nowrap gap-3 mb-4">
          <div className="w-full md:w-1/2 flex gap-2">
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={onReset}
                disabled={!hasActiveFilters}
                className="w-fit max-w-[112px] h-8 gap-2 px-2.5 text-xs justify-center"
                title="Reset filters"
              >
                <BiReset className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant={ShowOnlyConnected ? "default" : "outline"}
                onClick={() => setShowOnlyConnected?.(!ShowOnlyConnected)}
                className="flex-1 gap-2 text-xs"
                title="Show only stops with connections"
              >
                {ShowOnlyConnected ? "Connected Only" : "Show All Stops"}
              </Button>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-full">
                {ToStopsData ? (
                  <Combobox
                    Selections={ToStopsData.map((item) => item.value)}
                    Message="To Stop"
                    value={ToStop}
                    setValue={(val) => setToStop?.(val)}
                  />
                ) : (
                  <Skeleton className="h-12 rounded-md" />
                )}
              </div>
              <div className="w-full">
                {fromStopsData ? (
                  <Combobox
                    Selections={fromStopsData.map((item) => item.value)}
                    Message="From Stop"
                    value={FromStop}
                    setValue={(val) => setFromStop?.(val)}
                  />
                ) : (
                  <Skeleton className="h-12 rounded-md" />
                )}
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 flex items-center justify-center">
            <div className="w-full max-w-md flex flex-col gap-2">
              {isLoading ? (
                <Skeleton className="h-12 rounded-md" />
              ) : availableValues.length === 0 ? (
                
                <div className="flex justify-center">
                  <Button
                    variant={!EmptyArcs ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEmptyArcs?.(!EmptyArcs)}
                    disabled={!hasNullConnections}
                    className="gap-2"
                  >
                    {!EmptyArcs ? <BiShow className="h-4 w-4" /> : <BiHide className="h-4 w-4" />}
                    {getNullButtonLabel(hasNullConnections, !EmptyArcs)}
                  </Button>
                </div>
              ) : (
                
                <>
                  <div className="flex justify-center">
                    <Button
                      variant={!EmptyArcs ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEmptyArcs?.(!EmptyArcs)}
                      disabled={!hasNullConnections}
                      className="gap-2"
                    >
                      {!EmptyArcs ? <BiShow className="h-4 w-4" /> : <BiHide className="h-4 w-4" />}
                      {getNullButtonLabel(hasNullConnections, !EmptyArcs)}
                    </Button>
                  </div>
                  <div className="flex-1">
                    <SmartRangeSlider
                      key={`slider-${sliderResetKey}`}
                      values={availableValues}
                      selectedRange={TimeRange}
                      onRangeChange={(range) => setTimeRange?.(range)}
                      label={(value) => `${value}s`}
                      excludeValue={ExcludeTime}
                    />
                  </div>
</>
              )}
            </div>
          </div>
        </div>
      );
    }

    const { onReset } = props;

    const hasActiveFilters = !!(
      ToStop ||
      FromStop ||
      DirectionTypes ||
      (PathwayTypes && PathwayTypes.length > 0) ||
      ShowOnlyConnected
    );

    return (
      <div className="flex flex-wrap md:flex-nowrap gap-3 mb-4">
        <div className="w-full md:w-1/2 flex gap-2">
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={onReset}
              disabled={!hasActiveFilters}
              className="w-fit max-w-[112px] h-8 gap-2 px-2.5 text-xs justify-center"
              title="Reset filters"
            >
              <BiReset className="h-4 w-4" />
              Reset
            </Button>
            <Button
              variant={ShowOnlyConnected ? "default" : "outline"}
              onClick={() => setShowOnlyConnected?.(!ShowOnlyConnected)}
              className="flex-1 gap-2 text-xs"
              title="Show only stops with connections"
            >
              {ShowOnlyConnected ? "Connected Only" : "Show All Stops"}
            </Button>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="w-full">
              {ToStopsData ? (
                <Combobox
                  Selections={ToStopsData.map((item) => item.value)}
                  Message="To Stop"
                  value={ToStop}
                  setValue={(val) => setToStop?.(val)}
                />
              ) : (
                <Skeleton className="h-12 rounded-md flex-1 min-w-[200px]" />
              )}
            </div>
            <div className="w-full">
              {fromStopsData ? (
                <Combobox
                  Selections={fromStopsData.map((item) => item.value)}
                  Message="From Stop"
                  value={FromStop}
                  setValue={(val) => setFromStop?.(val)}
                />
              ) : (
                <Skeleton className="h-12 rounded-md" />
              )}
            </div>
          </div>
        </div>
        <div className="w-full md:w-1/2">
          {connectionType === "directional" && (
            <>
              {DirectionData ? (
                <Combobox
                  Selections={DirectionData.map((item) => item.value)}
                  Message="Direction Type"
                  value={DirectionTypes}
                  setValue={(val) => setDirectionTypes?.(val)}
                />
              ) : (
                <Skeleton className="h-14 rounded-md" />
              )}
            </>
          )}
          {connectionType === "PathwayTypes" && (
            <>
              {pathwayTypeData ? (
                <MultiSelect
                  options={pathwayTypeData.map(value => ({
                    ...value,
                    color: rgbToHex(getPathwayColor(value.value, theme)),
                  }))}
                  onValueChange={(newValue) => setPathwayTypes?.(newValue)}
                  defaultValue={PathwayTypes}
                  placeholder="Connection Types"
                />
              ) : (
                <Skeleton className="h-12 rounded-md" />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const {
    EmptyConnect,
    setEmptyConnect,
    setStartDropdown,
    setEndDropdown,
    StartStops,
    EndStops,
    hasNullConnections = false,
    wheelchairAccessibleOnly = false,
    onWheelchairAccessibleOnlyChange,
    showWheelchairAccessibleSwitch = false,
    hasTimedConnections = true,
    onReset,
    ExcludeTime,
  } = props;

  const isSliderChanged = TimeRange !== undefined &&
    defaultTimeRange !== undefined &&
    (TimeRange[0] !== defaultTimeRange[0] ||
     TimeRange[1] !== defaultTimeRange[1]);

  const hasActiveFilters = !!(
    StartDropdown ||
    EndDropdown ||
    (hasTimedConnections && EmptyConnect === false) ||
    wheelchairAccessibleOnly ||
    isSliderChanged ||
    (ExcludeTime !== undefined)
  );
  const showNullConnectionSwitch =
    hasNullConnections || EmptyConnect === false || !hasTimedConnections;
  const nullConnectionsChecked = !hasTimedConnections || EmptyConnect === false;
  const nullConnectionsDisabled = !hasTimedConnections;

  return (
    <div className="p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="h-8 gap-2 px-2.5 text-xs justify-center w-fit max-w-[112px]"
            title="Reset filters"
          >
            <BiReset className="h-4 w-4" />
            Reset
          </Button>

          {showWheelchairAccessibleSwitch ? (
            <label className="inline-flex w-fit items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium shrink-0">
              <span className="flex items-center gap-2">
                <Accessibility className="h-3.5 w-3.5" />
                Wheelchair
              </span>
              <Switch
                checked={wheelchairAccessibleOnly}
                onCheckedChange={(checked) =>
                  onWheelchairAccessibleOnlyChange?.(checked)
                }
                aria-label="Wheelchair accessible routes only"
                className="scale-90 origin-right"
              />
            </label>
          ) : null}

          {showNullConnectionSwitch ? (
            <label className="inline-flex w-fit items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium shrink-0">
              <span>Show Null Connections</span>
              <Switch
                checked={nullConnectionsChecked}
                onCheckedChange={(checked) => setEmptyConnect?.(!checked)}
                disabled={nullConnectionsDisabled}
                aria-label="Show null connections"
                className="scale-90 origin-right"
              />
            </label>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {showTimeRangeSlider ? (
            <div className="flex flex-col gap-2">
              {isLoading ? (
                <Skeleton className="h-12 rounded-md w-full" />
              ) : availableValues.length === 0 ? null : (
                <SmartRangeSlider
                  key={`slider-${sliderResetKey}`}
                  values={availableValues}
                  selectedRange={TimeRange}
                  onRangeChange={(range) => setTimeRange?.(range)}
                  label={(value) => `${value}s`}
                  excludeValue={ExcludeTime}
                />
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              {StartStops && StartStops.length > 0 ? (
                <Combobox
                  options={StartStops.map((item) => ({
                    value: item.stop_id,
                    label: item.stop_id,
                    color: rgbToHex(
                      getStopColor(item.location_type ?? "Unknown", theme),
                    ),
                    searchLabel: item.stop_id,
                  }))}
                  Message="From Nodes"
                  value={StartDropdown}
                  setValue={(val) => setStartDropdown?.(val)}
                />
              ) : (
                <Skeleton className="h-12 rounded-md w-full" />
              )}
            </div>

            <div className="flex flex-col gap-4">
              {EndStops && EndStops.length > 0 ? (
                <Combobox
                  options={EndStops.map((item) => ({
                    value: item.stop_id,
                    label: item.stop_id,
                    color: rgbToHex(
                      getStopColor(item.location_type ?? "Unknown", theme),
                    ),
                    searchLabel: item.stop_id,
                  }))}
                  Message="To Nodes"
                  value={EndDropdown}
                  setValue={(val) => setEndDropdown?.(val)}
                />
              ) : (
                <Skeleton className="h-12 rounded-md w-full" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PathwaysHeader;
