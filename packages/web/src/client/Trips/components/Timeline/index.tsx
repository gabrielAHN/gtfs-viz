import type { TripStopTime, TripInfo, EditableStop, RouteStopOption } from "@/lib/tripUtils";
import { TripTimeline } from "./ReadOnlyTimeline";
import { EditableTimeline } from "./EditableTimeline";

type BaseProps = {
  trips: Array<{ trip: TripInfo; stopTimes: TripStopTime[] }>;
  selectedStopIdx?: number | null;
  onSelectStop?: (idx: number | null) => void;
  selectedTripIdx?: number;
  onSelectStopWithTrip?: (tripIdx: number, stopIdx: number | null) => void;
  hiddenTripIndices?: Set<number>;
};

type EditProps = {
  editable: true;
  trips: Array<{ trip: TripInfo; stops: EditableStop[] }>;
  onUpdateStop: (tripIdx: number, stopIdx: number, field: "arrival_time" | "departure_time", value: string) => void;
  onUpdateStopBoth?: (tripIdx: number, stopIdx: number, arrival: string, departure: string) => void;
  routeStops?: RouteStopOption[];
  onAddStop?: (stop: RouteStopOption, arrival: string, departure: string) => void;
  onCreateStop?: () => void;
  addStopPreview?: { name: string; arrival: string; departure: string; stopSequence?: number };
  onAddArrivalChange?: (v: string) => void;
  onAddDepartureChange?: (v: string) => void;
  originalStops?: TripStopTime[];
  onInsertAt?: (seq: number, arrival: string, departure: string) => void;
  onDragStart?: () => void;
};

type ReadOnlyProps = BaseProps & { editable?: false };

type TimelineProps = ReadOnlyProps | (Omit<BaseProps, "trips"> & EditProps);

export function Timeline(props: TimelineProps) {
  if (props.editable) {
    const { editable: _, trips, selectedStopIdx, onSelectStop, ...editProps } = props;
    return (
      <EditableTimeline
        trips={trips}
        selectedStopIdx={selectedStopIdx}
        onSelectStop={onSelectStop}
        {...editProps}
      />
    );
  }

  return (
    <TripTimeline
      trips={props.trips}
      selectedStopIdx={props.selectedStopIdx}
      onSelectStop={props.onSelectStop}
      selectedTripIdx={props.selectedTripIdx}
      onSelectStopWithTrip={props.onSelectStopWithTrip}
      hiddenTripIndices={props.hiddenTripIndices}
    />
  );
}
