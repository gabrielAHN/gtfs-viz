import { BiCrosshair, BiPlus, BiTrash, BiX } from "react-icons/bi"
import { Button } from "@/components/ui/button"
import Combobox from "@/components/ui/combobox"
import { TimeInput } from "@/components/ui/TimeInput"
import type { EditableStop } from "@/lib/tripUtils"

interface StopEditPanelProps {
  compact?: boolean
  isEditing: boolean
  editStops: EditableStop[]
  selectedEditIdx: number | null
  noStops?: boolean
  addStopId?: string
  addArrival: string
  addDeparture: string
  addStopSequence: number
  addStopSeqManual: number | null
  addStopOptions: Array<{ value: string; label: string; searchLabel?: string; color?: string }>
  selectedAddStop: any
  onPushEdit: (stops: EditableStop[]) => void
  onSetSelectedEditIdx: (idx: number | null) => void
  onSetAddStopId: (id: string | undefined) => void
  onSetAddArrival: (v: string) => void
  onSetAddDeparture: (v: string) => void
  onSetAddStopSeqManual: (v: number | null) => void
  onHandleReorderStop: (fromIdx: number, toPos: number) => void
  onHandleAddStopConfirm: () => void
  onScrollToStop: (idx: number | null, isPreview?: boolean) => void
  editStopsRef: React.RefObject<EditableStop[]>
  onEditStopReplace?: (newStopId: string) => void
}

export function StopEditPanel({
  compact,
  isEditing,
  editStops,
  selectedEditIdx,
  noStops,
  addStopId,
  addArrival,
  addDeparture,
  addStopSequence,
  addStopSeqManual,
  addStopOptions,
  selectedAddStop,
  onPushEdit,
  onSetSelectedEditIdx,
  onSetAddStopId,
  onSetAddArrival,
  onSetAddDeparture,
  onSetAddStopSeqManual,
  onHandleReorderStop,
  onHandleAddStopConfirm,
  onScrollToStop,
  editStopsRef,
  onEditStopReplace,
}: StopEditPanelProps) {
  const isEdit = selectedEditIdx != null
  const isAdd = !isEdit && (addStopSeqManual != null || addStopId)

  const sequence = isEdit ? selectedEditIdx! + 1 : addStopSequence

  if (!isEditing) return null
  if (!isEdit && !isAdd) return null

  const maxSequence = isEdit ? editStops.length : editStops.length + 1
  const label = isEdit ? `Edit Stop #${sequence}` : `Add Stop #${sequence}`

  const handleStopChange = (newId: string | undefined) => {
    onSetAddStopId(newId)
    if (isEdit && newId) {
      onEditStopReplace?.(newId)
    }
  }

  const handleArrivalChange = (v: string) => {
    onSetAddArrival(v)
    if (isEdit) {
      onPushEdit(editStops.map((s, i) => (i === selectedEditIdx ? { ...s, arrival_time: v } : s)))
    }
  }

  const handleDepartureChange = (v: string) => {
    onSetAddDeparture(v)
    if (isEdit) {
      onPushEdit(editStops.map((s, i) => (i === selectedEditIdx ? { ...s, departure_time: v } : s)))
    }
  }

  const handleSequenceChange = (v: number) => {
    if (isEdit) {
      if (v >= 1 && v <= editStops.length) onHandleReorderStop(selectedEditIdx!, v)
    } else {
      if (v >= 1 && v <= editStops.length + 1) onSetAddStopSeqManual(v)
    }
  }

  const handleDelete = () => {
    onPushEdit(
      editStopsRef
        .current!.filter((_, j) => j !== selectedEditIdx)
        .map((s, j) => ({ ...s, stop_sequence: j + 1 })),
    )
    onSetSelectedEditIdx(null)
    onSetAddStopId(undefined)
    onSetAddArrival("")
    onSetAddDeparture("")
  }

  const handleClose = () => {
    onSetAddStopId(undefined)
    onSetAddArrival("")
    onSetAddDeparture("")
    if (isEdit) {
      onSetSelectedEditIdx(null)
    } else {
      onSetAddStopSeqManual(null)
    }
  }

  if (compact) {
    return (
      <div className="space-y-2 overflow-hidden">
        <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{label}</div>
        <div className="space-y-1">
          <div className="flex gap-2">
            <div className="w-10 shrink-0">
              <div className="text-[10px] text-muted-foreground mb-0.5">#</div>
              <input
                type="number"
                min={1}
                max={maxSequence}
                value={sequence}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  if (Number.isFinite(v)) handleSequenceChange(v)
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-1 py-1 text-xs text-center font-medium text-amber-600 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-muted-foreground mb-0.5">Stop</div>
              <Combobox
                options={addStopOptions}
                Message="Search stop..."
                value={addStopId}
                setValue={handleStopChange}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">Arrival</div>
            <TimeInput value={addArrival} onChange={handleArrivalChange} placeholder="HH:MM" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">Departure</div>
            <TimeInput value={addDeparture} onChange={handleDepartureChange} placeholder="HH:MM" />
          </div>
        </div>
        <div className="flex gap-1 pt-1 border-t">
          {isEdit ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <BiTrash className="mr-1 h-3 w-3" />
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7"
                title="Zoom to stop"
                onClick={() => onScrollToStop(selectedEditIdx)}
              >
                <BiCrosshair className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={handleClose}>
                <BiX className="mr-1 h-3 w-3" />
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="default"
                className="text-xs h-7"
                disabled={!selectedAddStop || !addArrival || !addDeparture}
                onClick={onHandleAddStopConfirm}
              >
                <BiPlus className="mr-1 h-3 w-3" />
                Add
              </Button>
              {selectedAddStop && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  title="Zoom to stop"
                  onClick={() => onScrollToStop(null, true)}
                >
                  <BiCrosshair className="h-3 w-3" />
                </Button>
              )}
              {!noStops && (
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={handleClose}>
                  <BiX className="mr-1 h-3 w-3" />
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="text-xs font-medium text-amber-600 dark:text-amber-400">{label}</div>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-14 shrink-0">
          <div className="text-[10px] text-muted-foreground mb-1">Order</div>
          <input
            type="number"
            min={1}
            max={maxSequence}
            value={sequence}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              if (Number.isFinite(v)) handleSequenceChange(v)
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm text-center font-medium text-amber-600 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="text-[10px] text-muted-foreground mb-1">Stop</div>
          <Combobox
            options={addStopOptions}
            Message="Search stop..."
            value={addStopId}
            setValue={handleStopChange}
          />
        </div>
        <div className="w-24 shrink-0">
          <div className="text-[10px] text-muted-foreground mb-1">Arrival</div>
          <TimeInput value={addArrival} onChange={handleArrivalChange} placeholder="HH:MM" />
        </div>
        <div className="w-24 shrink-0">
          <div className="text-[10px] text-muted-foreground mb-1">Departure</div>
          <TimeInput value={addDeparture} onChange={handleDepartureChange} placeholder="HH:MM" />
        </div>
        <div className="shrink-0">
          <div className="text-[10px] text-transparent mb-1">.</div>
          <div className="flex gap-1">
            {isEdit ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-10"
                  title="Zoom to stop"
                  onClick={() => onScrollToStop(selectedEditIdx)}
                >
                  <BiCrosshair className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete stop"
                  onClick={handleDelete}
                >
                  <BiTrash className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-10"
                  title="Close"
                  onClick={handleClose}
                >
                  <BiX className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="text-xs h-10"
                  disabled={!selectedAddStop || !addArrival || !addDeparture}
                  onClick={onHandleAddStopConfirm}
                >
                  <BiPlus className="mr-1 h-3 w-3" />
                  Add
                </Button>
                {!noStops && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-10"
                    title="Scroll to position"
                    onClick={() => onScrollToStop(null, true)}
                  >
                    <BiCrosshair className="h-4 w-4" />
                  </Button>
                )}
                {!noStops && (
                  <Button size="sm" variant="ghost" className="text-xs h-10" onClick={handleClose}>
                    <BiX className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
