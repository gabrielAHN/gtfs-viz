import { BiReset } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import Combobox from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multiselect";
import { formatTimeRange } from "@/lib/tripUtils";

interface TripsHeaderProps {
  hasStopTimes: boolean;
  tripId?: string;
  routeId?: string;
  routeType?: string[];
  availableTripIds: Array<{ value: string; label: string }>;
  availableRouteIds: Array<{ value: string; label: string; searchLabel?: string; color?: string }>;
  availableRouteTypes: Array<{ value: string; label: string; color?: string }>;
  timeRange: [number, number];
  sliderBounds: [number, number];
  tripsCount: number;
  hasActiveFilters: boolean;
  tableSortingCount: number;
  updateSearch: (next: Record<string, any>) => void;
  setTimeRange: (v: [number, number]) => void;
  clearFilters: () => void;
  extraButtons?: React.ReactNode;
}

export function TripsHeader({
  hasStopTimes, tripId, routeId, routeType,
  availableTripIds, availableRouteIds, availableRouteTypes,
  timeRange, sliderBounds, tripsCount,
  hasActiveFilters, tableSortingCount,
  updateSearch, setTimeRange, clearFilters, extraButtons,
}: TripsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasStopTimes ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-2 mb-1`}>
        <Combobox options={availableTripIds} Message="Trip ID" value={tripId || ""} setValue={(val) => updateSearch({ tripId: val || undefined })} />
        <Combobox options={availableRouteIds} Message="Route" value={routeId || ""} setValue={(val) => updateSearch({ routeId: val || undefined })} />
        <MultiSelect options={availableRouteTypes} onValueChange={(values) => updateSearch({ routeType: values.length ? values : undefined })}
          defaultValue={routeType || []} placeholder="Route Type" />
        {hasStopTimes && (
          <div className="grid gap-2 px-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Time Range</span><span>{formatTimeRange(timeRange)}</span>
            </div>
            <Slider value={timeRange} min={sliderBounds[0]} max={sliderBounds[1]} step={300} disabled={tripsCount === 0}
              onValueChange={(v) => setTimeRange([v[0] ?? sliderBounds[0], v[1] ?? sliderBounds[1]] as [number, number])} />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button disabled={!hasActiveFilters && tableSortingCount === 0} variant="outline" onClick={clearFilters}
          className="w-full md:w-auto flex items-center justify-center">
          <BiReset className="mr-2 h-5 w-5" />Reset
        </Button>
        {extraButtons}
      </div>
    </div>
  );
}
