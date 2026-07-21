import { createFileRoute, redirect } from "@tanstack/react-router";
import { isCliSession } from "@/lib/cli/isCliSession";
import Intro from "@/client/Intro";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (isCliSession()) {
      throw redirect({ to: "/routes/table" });
    }
    // Non-CLI: check if data was already imported via browser
    if (typeof window !== "undefined" && localStorage.getItem("gtfs_data_initialized") === "true") {
      throw redirect({ to: "/routes/table" });
    }
  },
  component: Intro,
});
