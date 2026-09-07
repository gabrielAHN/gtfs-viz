import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useDuckDB } from "@/context/duckdb.client"

import { BiDownload } from "react-icons/bi"
import { Button } from "@/components/ui/button"

import { exportingData } from "@/lib/duckdb/DataExporting/exportingData"

import StopsTable from "./components/StopsTable"
import PathwaysTable from "./components/PathwaysTable"
import RoutesTable from "./components/RoutesTable"
import StopTimesTable from "./components/StopTimesTable"
import CalendarTable from "./components/CalendarTable"
import CalendarDatesTable from "./components/CalendarDatesTable"
import TripsEditTable from "./components/TripsEditTable"
import ChangeSummary from "./components/ChangeSummary"
import CategoryView from "./CategoryView"
import { useEditsOverview } from "./hooks/useEditsOverview"

type ExportView = "category" | "table"

function Export({
  view,
  selectedTripId,
  compareView,
  onViewChange,
}: {
  view: ExportView
  selectedTripId?: string
  compareView: "table" | "map"
  onViewChange: (view: ExportView) => void
}) {
  const [FileTypes, setFileTypes] = useState({})
  const duckDB = useDuckDB()
  const { conn } = duckDB || {}
  const { data: editsOverview, isLoading: editsOverviewLoading } = useEditsOverview()

  const { isLoading: exportLoading, refetch } = useQuery({
    queryKey: ["ExportingData", FileTypes],
    queryFn: () => exportingData({ conn, FileTypes }),
    enabled: false,
    staleTime: 0,
  })

  const EditsStatus = Object.values(FileTypes).some((value) => value === true)
  const pendingEditCount = editsOverview
    ? editsOverview.trips.length +
      editsOverview.stopTimes.length +
      editsOverview.calendar.length +
      editsOverview.calendarDates.length +
      editsOverview.stops.length +
      editsOverview.pathways.length +
      editsOverview.routes.length
    : 0
  const hasPendingEdits = pendingEditCount > 0
  const canChooseView = !editsOverviewLoading && hasPendingEdits

  useEffect(() => {
    if (!editsOverviewLoading && !hasPendingEdits && view !== "category") {
      onViewChange("category")
    }
  }, [editsOverviewLoading, hasPendingEdits, onViewChange, view])

  useEffect(() => {
    if (exportLoading && duckDB) {
      duckDB.setIsResetting(true)
      duckDB.setLoadingMessage("Exporting data...")
      duckDB.setLoadingSubMessage("Preparing GTFS files for download")
    } else if (!exportLoading && duckDB) {
      duckDB.setIsResetting(false)
      duckDB.setLoadingMessage("")
      duckDB.setLoadingSubMessage("")
    }
  }, [exportLoading, duckDB])

  const handleExport = async () => {
    await refetch()
  }

  const tabBtn = (key: ExportView, label: string) => (
    <Button
      variant={view === key ? "default" : "outline"}
      onClick={() => onViewChange(key)}
      className="min-w-[8rem]"
      disabled={!canChooseView}
      title={
        !canChooseView ? "View selection is available when there are pending edits" : undefined
      }
    >
      {label}
    </Button>
  )

  return (
    <div>
      <h1 className="font-extrabold text-3xl mb-2">Edits &amp; Export</h1>
      <p className="text-inherit mb-4">
        Review pending edits by category or by file, then export the merged GTFS.
      </p>

      {editsOverviewLoading || hasPendingEdits ? <ChangeSummary /> : null}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {tabBtn("category", "By category")}
        {tabBtn("table", "By table")}
        <div className="flex-1" />
        <Button
          size="lg"
          onClick={handleExport}
          disabled={exportLoading || !hasPendingEdits || !EditsStatus}
          variant="secondary"
          className="flex items-center"
        >
          {exportLoading ? (
            "Exporting..."
          ) : (
            <span className="flex items-center">
              <BiDownload className="mr-2" />
              {hasPendingEdits && EditsStatus ? "Export Edit Files" : "No Changes to Export"}
            </span>
          )}
        </Button>
      </div>

      {!editsOverviewLoading && !hasPendingEdits ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <h2 className="font-semibold mb-1">No edits to review</h2>
          <p className="text-sm text-muted-foreground">
            View selection is disabled because both views would be empty. Make an edit in a route,
            trip, station, or pathway editor to enable the category and table views.
          </p>
        </div>
      ) : (
        <>
          <div className={view === "category" ? "" : "hidden"}>
            <CategoryView selectedTripId={selectedTripId} compareView={compareView} />
          </div>
          <div className={view === "table" ? "space-y-2" : "hidden"}>
            <StopsTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
            <PathwaysTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
            <RoutesTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
            <TripsEditTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
            <StopTimesTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
            <CalendarTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
            <CalendarDatesTable setFileTypes={setFileTypes} FileTypes={FileTypes} />
          </div>
        </>
      )}
    </div>
  )
}

export default Export
