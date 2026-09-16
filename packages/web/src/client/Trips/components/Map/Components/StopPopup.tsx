import { useCallback, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { BiCrosshair, BiMapPin, BiPlus, BiTrash, BiUndo } from "react-icons/bi"
import { Button } from "@/components/ui/button"
import Combobox from "@/components/ui/combobox"
import { TimeInput } from "@/components/ui/TimeInput"
import type { StopPoint, RouteStop } from "../types"

export function StopPopup({
  stop,
  editable,
  routeStops,
  onDeleteStop,
  onRestoreStop,
  onReplaceStop,
  onCreateStop,
  deletedStopIndices,
  onPreviewStop,
  onClose,
  onUpdateStopTime,
  stopStatus,
  onZoomToStop,
}: {
  stop: StopPoint
  editable: boolean
  routeStops: RouteStop[]
  onDeleteStop?: (stopIdx: number) => void
  onRestoreStop?: (stopIdx: number) => void
  onReplaceStop?: (stopIdx: number, newStop: RouteStop) => void
  onCreateStop?: () => void
  deletedStopIndices?: Set<number>
  onPreviewStop?: (preview: { lon: number; lat: number; name: string } | null) => void
  onClose: () => void
  onUpdateStopTime?: (
    stopIdx: number,
    field: "arrival_time" | "departure_time",
    value: string,
  ) => void
  stopStatus?: string
  onZoomToStop?: () => void
}) {
  const [showReplace, setShowReplace] = useState(false)
  const [replaceValue, setReplaceValue] = useState<string | undefined>()

  const stopOptions = useMemo(() => {
    const onRoute: Array<{ value: string; label: string; searchLabel: string; color: string }> = []
    const offRoute: Array<{ value: string; label: string; searchLabel: string; color: string }> = []
    for (const rs of routeStops) {
      if (rs.stop_id === stop.stopId) continue
      const opt = {
        value: rs.stop_id,
        label: `${rs.stop_name || rs.stop_id} (${rs.stop_id})`,
        searchLabel: `${rs.stop_id} ${rs.stop_name || ""}`,
        color: (rs as any).on_route ? "#3b82f6" : "#9ca3af",
      }
      if ((rs as any).on_route) onRoute.push(opt)
      else offRoute.push(opt)
    }
    return [...onRoute, ...offRoute]
  }, [routeStops, stop.stopId])

  const selectedReplace = replaceValue
    ? routeStops.find((rs) => rs.stop_id === replaceValue)
    : undefined
  const isOnRoute = selectedReplace ? (selectedReplace as any).on_route : false

  const handleSelectReplace = useCallback(
    (val: string | undefined) => {
      setReplaceValue(val)
      if (val) {
        const rs = routeStops.find((s) => s.stop_id === val)
        if (rs && rs.stop_lat != null && rs.stop_lon != null) {
          onPreviewStop?.({
            lon: Number(rs.stop_lon),
            lat: Number(rs.stop_lat),
            name: rs.stop_name || rs.stop_id,
          })
        } else {
          onPreviewStop?.(null)
        }
      } else {
        onPreviewStop?.(null)
      }
    },
    [routeStops, onPreviewStop],
  )

  const handleReplace = () => {
    if (selectedReplace && onReplaceStop) {
      onReplaceStop(stop.stopIdx, selectedReplace)
      onPreviewStop?.(null)
      onClose()
    }
  }

  return (
    <div className="p-3 text-sm space-y-2">
      {!showReplace ? (
        <>
          <div className="flex items-center gap-2">
            {stopStatus && (
              <span
                className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[8px] ${stopStatus === "new" ? "bg-green-100 dark:bg-green-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}
              >
                {stopStatus === "new" ? "🆕" : "✏️"}
              </span>
            )}
            <span className="font-semibold">{stop.name}</span>
            {onZoomToStop && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onZoomToStop()
                }}
                className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                title="Zoom to stop"
              >
                <BiCrosshair className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{stop.stopId}</span>
            <span>·</span>
            <span>#{stop.sequence}</span>
            {stop.parentStation ? (
              <Link
                to="/stations/info"
                search={{ selectedStationId: stop.parentStation }}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors"
              >
                <BiMapPin className="h-3 w-3" />
                Station
              </Link>
            ) : (
              <Link
                to="/stops/map"
                search={{ selectedStopId: stop.stopId }}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors"
              >
                <BiMapPin className="h-3 w-3" />
                Stop
              </Link>
            )}
          </div>
          {editable && stop.tripIdx === 0 && onUpdateStopTime ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Arrival</div>
                <TimeInput
                  value={stop.arrivalTime || ""}
                  onChange={(v) => onUpdateStopTime(stop.stopIdx, "arrival_time", v)}
                  placeholder="HH:MM"
                />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Departure</div>
                <TimeInput
                  value={stop.departureTime || ""}
                  onChange={(v) => onUpdateStopTime(stop.stopIdx, "departure_time", v)}
                  placeholder="HH:MM"
                />
              </div>
            </div>
          ) : (
            <>
              {stop.arrivalTime && <div className="text-xs">Arr: {stop.arrivalTime}</div>}
              {stop.departureTime && <div className="text-xs">Dep: {stop.departureTime}</div>}
            </>
          )}

          {editable && stop.tripIdx === 0 && (
            <div className="flex gap-1 pt-1 border-t">
              {deletedStopIndices?.has(stop.stopIdx) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => {
                    onRestoreStop?.(stop.stopIdx)
                    onClose()
                  }}
                >
                  <BiUndo className="mr-1 h-3 w-3" />
                  Restore
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs h-7"
                    onClick={() => {
                      onDeleteStop?.(stop.stopIdx)
                      onClose()
                    }}
                  >
                    <BiTrash className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => {
                      setShowReplace(true)
                      setReplaceValue(undefined)
                    }}
                  >
                    Replace
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="font-semibold text-xs text-muted-foreground">Replace Stop</div>

          <div className="rounded-md border p-2 space-y-0.5">
            <div className="text-xs font-medium">{stop.name}</div>
            <div className="text-[10px] text-muted-foreground">{stop.stopId}</div>
          </div>

          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <span>
              {"\u2193"} {"\u2191"}
            </span>
          </div>

          {selectedReplace ? (
            <div
              className={`rounded-md border p-2 space-y-1 ${isOnRoute ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20" : "border-gray-300 bg-gray-50 dark:bg-gray-800/30"}`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-full shrink-0"
                  style={{
                    width: 6,
                    height: 6,
                    backgroundColor: isOnRoute ? "#3b82f6" : "#9ca3af",
                  }}
                />
                <div className="text-xs font-medium">
                  {selectedReplace.stop_name || selectedReplace.stop_id}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">{selectedReplace.stop_id}</div>
              <div className="text-[10px] text-muted-foreground">
                {isOnRoute ? "On this route" : "Not on this route"}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground text-center">
              Select a replacement stop below
            </div>
          )}

          <Combobox
            options={stopOptions}
            Message="Search by name or ID..."
            value={replaceValue}
            setValue={handleSelectReplace}
          />

          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 flex-1"
              onClick={() => {
                setShowReplace(false)
                onPreviewStop?.(null)
              }}
            >
              Back
            </Button>
            {selectedReplace && (
              <Button
                size="sm"
                variant="default"
                className="text-xs h-7 flex-1"
                onClick={handleReplace}
              >
                Confirm
              </Button>
            )}
          </div>

          {onCreateStop && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 w-full"
              onClick={onCreateStop}
            >
              <BiPlus className="mr-1 h-3 w-3" />
              Create Stop
            </Button>
          )}
        </>
      )}
    </div>
  )
}
