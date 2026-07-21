import { useRef, useState } from "react";
import { BiGridVertical, BiX } from "react-icons/bi";
import { EditIndicator } from "@/components/ui/EditIndicator";
import { type EditableStop, type RouteStopOption, timeToSec } from "@/lib/tripUtils";

export function EditableTimetable({ stops, onUpdate, routeStops: _routeStops = [], onCreateStop: _onCreateStop, addStopPreview, onInsertAt, originalStops, selectedStopIdx, onSelectStop, showOnlyChanged }: {
  stops: EditableStop[];
  onUpdate: (stops: EditableStop[]) => void;
  routeStops?: RouteStopOption[];
  onCreateStop?: () => void;
  addStopPreview?: { name: string; stopId?: string; arrival: string; departure: string; stopSequence?: number };
  onInsertAt?: (seq: number, arrival: string, departure: string) => void;
  originalStops?: Array<{ stop_id?: string; arrival_time?: string; departure_time?: string }>;
  selectedStopIdx?: number | null;
  onSelectStop?: (idx: number | null) => void;
  showOnlyChanged?: boolean;
}) {
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(idx);
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx == null || fromIdx === dropIdx) { setDragOver(null); return; }
    const next = [...stops];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(dropIdx, 0, moved);
    onUpdate(next.map((s, i) => ({ ...s, stop_sequence: i + 1 })));
    if (selectedStopIdx != null) {
      if (selectedStopIdx === fromIdx) onSelectStop?.(dropIdx);
      else if (fromIdx < selectedStopIdx && dropIdx >= selectedStopIdx) onSelectStop?.(selectedStopIdx - 1);
      else if (fromIdx > selectedStopIdx && dropIdx <= selectedStopIdx) onSelectStop?.(selectedStopIdx + 1);
    }
    dragIdx.current = null;
    setDragOver(null);
  };

  return (
    <div className="rounded-md border shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="px-1 py-2 w-8"></th>
              <th className="px-3 py-2 text-left text-xs font-medium">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Stop</th>
              <th className="px-3 py-2 text-left text-xs font-medium">ID</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Arrival</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Departure</th>
              <th className="px-3 py-2 text-left text-xs font-medium">Station</th>
              <th className="px-1 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const previewIdx = addStopPreview?.stopSequence ? addStopPreview.stopSequence - 1 : -1;
              const hasPreview = !!addStopPreview;
              const canInsert = !!onInsertAt;
              const rows: React.ReactNode[] = [];
              let seqOffset = 0;

              const stopStatus = new Map<number, string>();
              if (originalStops) {
                for (let i = 0; i < stops.length; i++) {
                  const st = stops[i];
                  // Use _idx to find this stop's original data (identity-based, not position-based)
                  const origIdx = st._idx;
                  const orig = origIdx != null && origIdx < originalStops.length ? originalStops[origIdx] : undefined;
                  if (!orig) {
                    stopStatus.set(i, "new");
                  } else if (
                    (st.stop_id || "") !== (orig.stop_id || "") ||
                    st.arrival_time !== orig.arrival_time ||
                    st.departure_time !== orig.departure_time
                  ) {
                    stopStatus.set(i, "edit");
                  }
                }
              }

              const midTime = (before: number, after: number): string => {
                const mid = Math.round((before + after) / 2 / 60) * 60;
                const mh = Math.floor(mid / 3600);
                const mm = Math.floor((mid % 3600) / 60);
                const ms = mid % 60;
                return `${String(mh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ms).padStart(2, "0")}`;
              };

              const handleInsertClick = (pos: number) => {
                const prevStop = pos > 1 ? stops[pos - 2] : undefined;
                const nextStop = pos <= stops.length ? stops[pos - 1] : undefined;
                const prevSec = timeToSec(prevStop?.departure_time) ?? timeToSec(prevStop?.arrival_time);
                const nextSec = timeToSec(nextStop?.arrival_time) ?? timeToSec(nextStop?.departure_time);
                let time = "";
                if (prevSec != null && nextSec != null) {
                  time = midTime(prevSec, nextSec);
                } else if (prevSec != null) {
                  time = midTime(prevSec, prevSec + 300);
                } else if (nextSec != null) {
                  time = midTime(Math.max(0, nextSec - 300), nextSec);
                }
                onInsertAt?.(pos, time, time);
              };

              const insertRow = (pos: number) => (
                <tr key={`insert-${pos}`}
                  className="cursor-pointer group transition-colors hover:bg-amber-50/50 dark:hover:bg-amber-950/10"
                  onClick={() => handleInsertClick(pos)}>
                  <td colSpan={8} className="py-0">
                    <div className="border-t-2 border-dashed border-transparent group-hover:border-amber-400 dark:group-hover:border-amber-600 flex items-center justify-center h-3">
                      <span className="text-[10px] px-2 text-transparent group-hover:text-amber-500 dark:group-hover:text-amber-400 select-none">
                        insert #{pos}
                      </span>
                    </div>
                  </td>
                </tr>
              );

              const previewRow = (seq: number) => (
                <tr key="preview" data-stop-preview="true" className="border-t border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
                  onClick={() => onInsertAt?.(seq, "", "")}>
                  <td className="px-1 py-2 text-amber-500"><BiX className="h-4 w-4" /></td>
                  <td className="px-3 py-2 text-amber-600 font-medium">{seq}</td>
                  <td className="px-3 py-2 font-medium text-amber-700 dark:text-amber-400">{addStopPreview!.name || <span className="italic text-amber-500/60">Select stop...</span>}</td>
                  <td className="px-3 py-2 text-amber-600/70 text-xs">{addStopPreview!.stopId || "\u2014"}</td>
                  <td className="px-3 py-2 text-amber-600">{addStopPreview!.arrival || "\u2014"}</td>
                  <td className="px-3 py-2 text-amber-600">{addStopPreview!.departure || "\u2014"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{"\u2014"}</td>
                  <td className="px-1 py-2"></td>
                </tr>
              );

              for (let i = 0; i <= stops.length; i++) {
                if (hasPreview && i === previewIdx) {
                  seqOffset = 1;
                  rows.push(previewRow(i + 1));
                } else if (canInsert) {
                  rows.push(insertRow(i + 1));
                }

                if (i < stops.length) {
                  const st = stops[i];
                  const seq = i + 1 + seqOffset;
                  const isSelected = selectedStopIdx === i;
                  if (showOnlyChanged && stopStatus.size > 0 && !stopStatus.has(i) && !isSelected) {
                    if (i === 0 || stopStatus.has(i - 1) || selectedStopIdx === i - 1) {
                      rows.push(
                        <tr key={`skip-${i}`} className="border-t">
                          <td colSpan={8} className="px-3 py-1 text-center text-[10px] text-muted-foreground">
                            ···
                          </td>
                        </tr>
                      );
                    }
                    continue;
                  }
                  rows.push(
                    <tr
                      key={st._idx}
                      data-stop-idx={i}
                      draggable
                      onDragStart={(e) => handleDragStart(e, i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDrop={(e) => handleDrop(e, i)}
                      onDragLeave={() => setDragOver(null)}
                      onClick={() => onSelectStop?.(isSelected ? null : i)}
                      className={`border-t transition-colors cursor-pointer ${
                        dragOver === i ? "border-t-2 border-t-primary bg-primary/5"
                        : isSelected ? "bg-amber-50 dark:bg-amber-950/20 border-l-2 border-l-amber-400"
                        : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="px-1 py-2 text-muted-foreground cursor-grab active:cursor-grabbing">
                        <BiGridVertical className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {stopStatus.has(i) && <EditIndicator status={stopStatus.get(i)} className="h-3.5 w-3.5" />}
                          <span>{seq}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium">{st.stop_name || "\u2014"}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{st.stop_id || "\u2014"}</td>
                      <td className="px-3 py-2 text-sm">{st.arrival_time || "\u2014"}</td>
                      <td className="px-3 py-2 text-sm">{st.departure_time || "\u2014"}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{st.station_name || "\u2014"}</td>
                      <td className="px-1 py-2">
                        <button onClick={(e) => { e.stopPropagation(); onUpdate(stops.filter((_, j) => j !== i).map((s, j) => ({ ...s, stop_sequence: j + 1 }))); if (selectedStopIdx === i) onSelectStop?.(null); }}
                            className="text-muted-foreground hover:text-destructive transition-colors" title="Remove stop">
                            <BiX className="h-4 w-4" />
                          </button>
                      </td>
                    </tr>,
                  );
                }
              }
              if (hasPreview && previewIdx > stops.length) {
                rows.push(previewRow(stops.length + 1));
              }
              if (rows.length === 0) {
                rows.push(<tr key="empty"><td colSpan={8} className="px-3 py-4 text-center text-muted-foreground">No stop times available</td></tr>);
              }
              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
