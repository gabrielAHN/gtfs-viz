import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import StationInfo from "@/client/Stations/SelectedStations/StationInfo";

export const Route = createFileRoute("/_layout/stations/station/$stationId/info")({
  component: StationInfoPage,
});

function StationInfoPage() {
  const context = useRouteContext({ from: "/_layout/stations/station/$stationId" });
  const stationData = context?.stationData;

  if (!stationData) {
    return <div>Loading station information...</div>;
  }

  return <StationInfo Data={stationData} />;
}
