import type { TripInfo, TripStopTime, EditableStop } from "@/lib/tripUtils";

export type StopPoint = {
  lon: number;
  lat: number;
  name: string;
  stopId: string;
  sequence: number;
  stopIdx: number;
  arrivalTime?: string;
  departureTime?: string;
  parentStation?: string;
  tripIdx: number;
  disabled?: boolean;
};

export type Segment = {
  from: [number, number];
  to: [number, number];
  fromIdx: number;
  toIdx: number;
  fromName: string;
  toName: string;
  fromTime?: string;
  toTime?: string;
  tripIdx: number;
  disabled?: boolean;
  fromStopId?: string;
  toStopId?: string;
  fromStation?: string;
  toStation?: string;
};

export type RouteStop = {
  stop_id: string;
  stop_name: string;
  stop_lat?: number;
  stop_lon?: number;
  location_type_name?: string;
  parent_station?: string;
};

export interface TripMapProps {
  trips: Array<{ trip: TripInfo; stopTimes: (TripStopTime | EditableStop)[] }>;
  heightClassName?: string;
  highlightedSegmentRange?: { fromStopIdx: number; toStopIdx: number };
  editable?: boolean;
  onDeleteStop?: (stopIdx: number) => void;
  onRestoreStop?: (stopIdx: number) => void;
  deletedStopIndices?: Set<number>;
  onDragStop?: (stopIdx: number, lat: number, lon: number) => void;
  onUpdateStopTime?: (
    stopIdx: number,
    field: "arrival_time" | "departure_time",
    value: string,
  ) => void;
  onReplaceStop?: (stopIdx: number, newStop: RouteStop) => void;
  onAddStop?: (stop: RouteStop, arrival: string, departure: string) => void;
  routeStops?: RouteStop[];
  onCreateStop?: () => void;
  addStopPreview?: { lon: number; lat: number; name: string; stopSequence?: number } | null;
  originalStops?: TripStopTime[];
  selectedStopIdx?: number | null;
  onSelectStop?: (idx: number | null) => void;
  editPanel?: React.ReactNode;
  zoomToStopRef?: React.MutableRefObject<((stopIdx: number) => void) | null>;
  onClickAnyStop?: (stop: {
    tripIdx: number;
    stopIdx: number;
    name: string;
    stopId: string;
    arrivalTime?: string;
    departureTime?: string;
    parentStation?: string;
  }) => void;
  hiddenTripIndices?: Set<number>;
  onToggleTripVisibility?: (idx: number) => void;
}
