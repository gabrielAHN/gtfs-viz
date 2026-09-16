import { useState } from "react"
import { BiTrash, BiUndo } from "react-icons/bi"
import { Button } from "@/components/ui/button"
import { parseTime, timeToSec } from "@/lib/tripUtils"
import type { Segment } from "../types"

export function SegmentPopup({
  segment,
  editable,
  onUpdateTime,
  onDeleteStop,
  onRestoreStop,
  deletedStopIndices,
  onClose,
}: {
  segment: Segment
  editable: boolean
  onUpdateTime?: (stopIdx: number, field: "arrival_time" | "departure_time", value: string) => void
  onDeleteStop?: (stopIdx: number) => void
  onRestoreStop?: (stopIdx: number) => void
  deletedStopIndices?: Set<number>
  onClose: () => void
}) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [invalid, setInvalid] = useState(false)

  const fromSec = timeToSec(segment.fromTime)
  const toSec = timeToSec(segment.toTime)
  const durationMin =
    fromSec != null && toSec != null ? Math.round((toSec - fromSec) / 60) : undefined

  const startEdit = (field: string, value: string) => {
    setEditingField(field)
    setDraft(value)
    setInvalid(false)
  }

  const commitEdit = () => {
    if (!editingField || !onUpdateTime) return
    const parsed = parseTime(draft)
    if (!parsed && draft.trim() !== "") {
      setInvalid(true)
      return
    }
    const value = parsed || ""
    if (editingField === "fromDep") onUpdateTime(segment.fromIdx, "departure_time", value)
    else if (editingField === "toArr") onUpdateTime(segment.toIdx, "arrival_time", value)
    setEditingField(null)
    setInvalid(false)
  }

  const renderTimeField = (label: string, value: string | undefined, fieldKey: string) => {
    if (editingField === fieldKey) {
      return (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-12">{label}</span>
          <input
            autoFocus
            className={`w-20 rounded border px-1 py-0.5 text-xs outline-none ${invalid ? "border-red-500 bg-red-50 dark:bg-red-950" : "border-primary/50 bg-background"}`}
            value={draft}
            placeholder="HH:MM:SS"
            onChange={(e) => {
              setDraft(e.target.value)
              setInvalid(false)
            }}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit()
              if (e.key === "Escape") {
                setEditingField(null)
                setInvalid(false)
              }
            }}
          />
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground w-12">{label}</span>
        <span
          className={`text-xs ${editable ? "cursor-pointer rounded px-1 py-0.5 hover:bg-primary/10 text-primary/80 transition-colors" : ""}`}
          onClick={editable ? () => startEdit(fieldKey, value || "") : undefined}
        >
          {value || "\u2014"}
        </span>
      </div>
    )
  }

  return (
    <div className="p-3 text-sm space-y-2">
      <div className="font-semibold text-xs text-muted-foreground">Connection</div>

      <div className="rounded-md border p-2 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium">{segment.fromName}</div>
          {editable &&
            (deletedStopIndices?.has(segment.fromIdx) ? (
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-5 px-1.5"
                onClick={() => {
                  onRestoreStop?.(segment.fromIdx)
                  onClose()
                }}
              >
                <BiUndo className="mr-0.5 h-2.5 w-2.5" />
                Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-5 px-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  onDeleteStop?.(segment.fromIdx)
                  onClose()
                }}
              >
                <BiTrash className="mr-0.5 h-2.5 w-2.5" />
                Remove
              </Button>
            ))}
        </div>
        {renderTimeField("Dep:", segment.fromTime, "fromDep")}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>{"\u2193"}</span>
        {durationMin != null && (
          <span className="bg-muted rounded px-1.5 py-0.5">{durationMin} min</span>
        )}
      </div>

      <div className="rounded-md border p-2 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium">{segment.toName}</div>
          {editable &&
            (deletedStopIndices?.has(segment.toIdx) ? (
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-5 px-1.5"
                onClick={() => {
                  onRestoreStop?.(segment.toIdx)
                  onClose()
                }}
              >
                <BiUndo className="mr-0.5 h-2.5 w-2.5" />
                Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-5 px-1.5 text-destructive hover:text-destructive"
                onClick={() => {
                  onDeleteStop?.(segment.toIdx)
                  onClose()
                }}
              >
                <BiTrash className="mr-0.5 h-2.5 w-2.5" />
                Remove
              </Button>
            ))}
        </div>
        {renderTimeField("Arr:", segment.toTime, "toArr")}
      </div>

      {segment.disabled && (
        <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded p-1.5">
          Segment disabled (stop removed)
        </div>
      )}
    </div>
  )
}
