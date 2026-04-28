import { createFileRoute, redirect } from "@tanstack/react-router";

type FlowSearchParams = {
  selectedStationId?: string;
  selectedNodeId?: string;
  selectedPathwayId?: string;
};

export const Route = createFileRoute("/_layout/stations/flow")({
  validateSearch: (search: Record<string, unknown>): FlowSearchParams => {
    return {
      selectedStationId: search.selectedStationId as string | undefined,
      selectedNodeId: search.selectedNodeId as string | undefined,
      selectedPathwayId: search.selectedPathwayId as string | undefined,
    };
  },
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/stations/pathways/flow/column",
      search,
      replace: true,
    });
  },
});
