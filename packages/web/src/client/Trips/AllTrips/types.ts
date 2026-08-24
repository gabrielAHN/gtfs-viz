import type { TripInfo } from "@/lib/tripUtils";

export type TripRow = TripInfo & {
  route_id?: string;
  service_id?: string;
  route_name?: string;
  route_type_name?: string;
  route_color_hex?: string;
  status?: string;
};

export interface AllTripsProps {
  allTrips: TripRow[];
  tripTimeBounds: [number, number];
  hasStopTimes: boolean;
  search: {
    tripId?: string;
    routeId?: string;
    routeType?: string[];
    selectedTripId?: string;
    reroute?: boolean;
    view?: string;
    compareTripIds?: string;
  };
  updateSearch: (next: Record<string, any>) => void;
}
