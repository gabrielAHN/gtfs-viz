import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/stations/station/$stationId/parts/")({
  beforeLoad: ({ params }) => {
    
    throw redirect({ to: `/stations/station/${params.stationId}/parts/map` });
  },
});
