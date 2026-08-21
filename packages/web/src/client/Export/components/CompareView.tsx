export type EditRow = {
  row_id: string;
  trip_id: string;
  stop_sequence: number;
  stop_id: string;
  arrival_time?: string;
  departure_time?: string;
  status: string;
  [key: string]: any;
};

// LCS on stop_id to align original vs edited, detecting inserts/shifts
export function diffStopLists(orig: any[], edited: any[]) {
  const oIds = orig.map((r) => String(r.stop_id));
  const eIds = edited.map((r) => String(r.stop_id));
  const m = oIds.length, n = eIds.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oIds[i - 1] === eIds[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Backtrack to produce aligned rows
  type DiffRow = { orig: any | null; edited: any | null; type: "match" | "changed" | "added" | "removed" };
  let i = m, j = n;
  const stack: DiffRow[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oIds[i - 1] === eIds[j - 1]) {
      const o = orig[i - 1], e = edited[j - 1];
      const changed = o.arrival_time !== e.arrival_time || o.departure_time !== e.departure_time || o.stop_sequence !== e.stop_sequence;
      stack.push({ orig: o, edited: e, type: changed ? "changed" : "match" });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ orig: null, edited: edited[j - 1], type: "added" });
      j--;
    } else {
      stack.push({ orig: orig[i - 1], edited: null, type: "removed" });
      i--;
    }
  }
  stack.reverse();
  return stack;
}

/**
 * Side-by-side original-vs-edited stop-times table for one trip. `editedRows` is the trip's
 * EditStopTimesTable rows (the full edited sequence as new/new edit, plus deleted tombstones);
 * the deleted tombstones are dropped from the edited column so removed stops surface as removals.
 * `originalMap` is any row-id → base-row map covering this trip's original stop_times.
 */
export function CompareView({ tripId, editedRows, originalMap }: {
  tripId: string;
  editedRows: EditRow[];
  originalMap: Record<string, any>;
}) {
  const origRows = Object.values(originalMap)
    .filter((r: any) => String(r.trip_id) === String(tripId))
    .sort((a: any, b: any) => (a.stop_sequence ?? 0) - (b.stop_sequence ?? 0));

  // The edited sequence is the non-tombstoned rows; deleted rows are shown as removals via the diff.
  const editedSorted = [...editedRows]
    .filter((r) => r.status !== "deleted")
    .sort((a, b) => (a.stop_sequence ?? 0) - (b.stop_sequence ?? 0));

  const diffRows = diffStopLists(origRows, editedSorted);

  const cellClass = (origVal: any, editVal: any) => {
    const o = origVal == null || origVal === "" ? null : String(origVal);
    const e = editVal == null || editVal === "" ? null : String(editVal);
    return o !== e ? "font-medium" : "text-muted-foreground";
  };

  const fields: Array<{ key: string; label: string }> = [
    { key: "stop_sequence", label: "#" },
    { key: "stop_id", label: "Stop ID" },
    { key: "arrival_time", label: "Arrival" },
    { key: "departure_time", label: "Departure" },
  ];

  const renderCell = (row: any | null, field: string) => row?.[field] ?? "—";

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="overflow-auto max-h-[50vh]">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              {/* Original side */}
              <th className="px-2 py-1.5 text-left font-semibold text-red-700 dark:text-red-400 border-r w-6">
              </th>
              {fields.map((f) => (
                <th key={`o-${f.key}`} className="px-2 py-1.5 text-left font-medium border-r last:border-r-2 last:border-r-border">
                  {f.label}
                </th>
              ))}
              {/* Edited side */}
              <th className="px-2 py-1.5 text-left font-semibold text-green-700 dark:text-green-400 w-6">
              </th>
              {fields.map((f) => (
                <th key={`e-${f.key}`} className="px-2 py-1.5 text-left font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
            <tr>
              <th colSpan={fields.length + 1} className="px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 border-r-2 border-r-border text-center">
                Original
              </th>
              <th colSpan={fields.length + 1} className="px-2 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20 text-center">
                Edited
              </th>
            </tr>
          </thead>
          <tbody>
            {diffRows.map((d, i) => {
              if (d.type === "removed") {
                return (
                  <tr key={i} className="border-t">
                    <td className="px-1 py-1 text-center text-red-500 border-r">
                      <span className="text-[10px] font-bold">-</span>
                    </td>
                    {fields.map((f) => (
                      <td key={f.key} className="px-2 py-1 bg-red-50 dark:bg-red-950/20 text-red-600 line-through border-r last:border-r-2 last:border-r-border">
                        {renderCell(d.orig, f.key)}
                      </td>
                    ))}
                    {/* Empty edited side */}
                    <td className="px-1 py-1 border-r-0" />
                    {fields.map((f) => (
                      <td key={f.key} className="px-2 py-1 bg-muted/30" />
                    ))}
                  </tr>
                );
              }

              if (d.type === "added") {
                return (
                  <tr key={i} className="border-t">
                    {/* Empty original side */}
                    <td className="px-1 py-1 border-r" />
                    {fields.map((f) => (
                      <td key={f.key} className="px-2 py-1 bg-muted/30 border-r last:border-r-2 last:border-r-border" />
                    ))}
                    <td className="px-1 py-1 text-center text-green-500">
                      <span className="text-[10px] font-bold">+</span>
                    </td>
                    {fields.map((f) => (
                      <td key={f.key} className="px-2 py-1 bg-green-50 dark:bg-green-950/20 text-green-600 font-medium">
                        {renderCell(d.edited, f.key)}
                      </td>
                    ))}
                  </tr>
                );
              }

              // match or changed
              const isChanged = d.type === "changed";
              return (
                <tr key={i} className={`border-t ${isChanged ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}>
                  <td className="px-1 py-1 text-center border-r">
                    {isChanged && <span className="text-[10px] font-bold text-amber-500">~</span>}
                  </td>
                  {fields.map((f) => (
                    <td key={f.key} className={`px-2 py-1 border-r last:border-r-2 last:border-r-border ${
                      isChanged ? cellClass(d.orig?.[f.key], d.edited?.[f.key]) === "font-medium"
                        ? "text-red-500 line-through" : "text-muted-foreground"
                      : "text-muted-foreground"
                    }`}>
                      {renderCell(d.orig, f.key)}
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center">
                    {isChanged && <span className="text-[10px] font-bold text-amber-500">~</span>}
                  </td>
                  {fields.map((f) => (
                    <td key={f.key} className={`px-2 py-1 ${
                      isChanged ? cellClass(d.orig?.[f.key], d.edited?.[f.key]) === "font-medium"
                        ? "text-green-600 font-medium" : "text-muted-foreground"
                      : "text-muted-foreground"
                    }`}>
                      {renderCell(d.edited, f.key)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CompareView;
