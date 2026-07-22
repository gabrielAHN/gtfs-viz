import { createFileRoute } from "@tanstack/react-router";

type TripsTableSearchParams = {
  tripId?: string;
  routeId?: string;
  routeType?: string[];
  selectedTripId?: string;
  view?: string;
  compareTripIds?: string;
};

export const Route = createFileRoute("/_layout/trips/table")({
  validateSearch: (search: Record<string, unknown>): TripsTableSearchParams => {
    return {
      tripId: search.tripId as string | undefined,
      routeId: search.routeId as string | undefined,
      routeType: Array.isArray(search.routeType)
        ? (search.routeType as string[])
        : search.routeType
          ? [search.routeType as string]
          : undefined,
      selectedTripId: search.selectedTripId as string | undefined,
      view: search.view as string | undefined,
      compareTripIds: search.compareTripIds as string | undefined,
    };
  },
});
