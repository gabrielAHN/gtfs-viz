import { lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"

const ColumnView = lazy(
  () => import("@/client/Stations/SelectedStations/StationPathways/FlowView/ColumnView"),
)

export const Route = createFileRoute("/_layout/stations/pathways/flow/column")({
  component: ColumnFlowPage,
})

function ColumnFlowPage() {
  return <ColumnView />
}
