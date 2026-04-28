import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/stations/pathways/flow/")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/stations/pathways/flow/column",
      search,
      replace: true,
    });
  },
});
