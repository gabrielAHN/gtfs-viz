import { createFileRoute } from "@tanstack/react-router";
import RadialView from "@/client/Stations/SelectedStations/StationPathways/FlowView/RadialView";

export const Route = createFileRoute("/_layout/stations/pathways/flow/radial")({
  component: RadialFlowPage,
});

function RadialFlowPage() {
  return <RadialView />;
}
