import type { TripStopTime, EditableStop, RouteStopOption } from "@/lib/tripUtils";
import { TripStopSequence, TripStopPanel } from "./ReadOnlyTimetable";
import { EditableTimetable } from "./EditableTimetable";

export { TripStopPanel };

type BaseProps = {
  stopTimes: TripStopTime[];
  view?: "stops" | "stations";
};

type EditProps = {
  editable: true;
  stops: EditableStop[];
  onUpdate: (stops: EditableStop[]) => void;
  routeStops?: RouteStopOption[];
  onCreateStop?: () => void;
  addStopPreview?: { name: string; stopId?: string; arrival: string; departure: string; stopSequence?: number };
  onInsertAt?: (seq: number, arrival: string, departure: string) => void;
  originalStops?: TripStopTime[];
  selectedStopIdx?: number | null;
  onSelectStop?: (idx: number | null) => void;
  showOnlyChanged?: boolean;
};

type ReadOnlyProps = BaseProps & { editable?: false };

type TimetableProps = ReadOnlyProps | (EditProps & { stopTimes?: never; view?: never });

export function Timetable(props: TimetableProps) {
  if (props.editable) {
    const { editable: _, ...editProps } = props;
    return <EditableTimetable {...editProps} />;
  }

  return <TripStopSequence stopTimes={props.stopTimes} view={props.view} />;
}
