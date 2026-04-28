import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/stations/station/$stationId/")({
  beforeLoad: ({ params }) => {
    
    throw redirect({ to: `/stations/station/${params.stationId}/info` });
  },
});
