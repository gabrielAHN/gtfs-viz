import { createFileRoute } from "@tanstack/react-router";
import Intro from "@/client/Intro";

export const Route = createFileRoute("/")({
  component: Intro,
});
