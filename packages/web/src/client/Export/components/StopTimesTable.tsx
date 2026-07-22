import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BiCheck, BiChevronDown, BiChevronUp, BiGitCompare, BiMap, BiRefresh, BiUndo, BiX } from "react-icons/bi";
import { useDuckDB } from "@/context/duckdb.client";
import { fetchTableData } from "@/lib/duckdb/DataFetching/fetchGTFSData";
import { fetchOriginalRows } from "@/lib/duckdb/DataFetching/fetchExportData";
import { mutationExportFn } from "@/lib/duckdb/DataEditing/editingFn";

type EditRow = {
  row_id: string;
  trip_id: string;
  stop_sequence: number;
  stop_id: string;
  arrival_time?: string;
  departure_time?: string;
  status: string;
  [key: string]: any;
};

type ServiceGroup = {
  serviceId: string;
  routeId: string;
  routeName: string;
  trips: TripGroup[];
};

type TripGroup = {
  tripId: string;
  headsign: string;
  rows: EditRow[];
};

function StatusBadge({ status }: { status: string }) {
  if (status === "deleted") return <Badge variant="destructive">Deleted</Badge>;
  if (status === "new") return <Badge variant="default">New</Badge>;
  if (status === "edit" || status === "new edit") return <Badge variant="secondary">Modified</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// LCS on stop_id to align original vs edited, detecting inserts/shifts
function diffStopLists(orig: any[], edited: any[]) {
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
  const result: DiffRow[] = [];
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

function CompareView({ tripId, editedRows, originalMap }: {
  tripId: string;
  editedRows: EditRow[];
  originalMap: Record<string, any>;
}) {
  const origRows = Object.values(originalMap)
    .filter((r: any) => r.trip_id === tripId)
    .sort((a: any, b: any) => (a.stop_sequence ?? 0) - (b.stop_sequence ?? 0));

  const editedSorted = [...editedRows].sort((a, b) => (a.stop_sequence ?? 0) - (b.stop_sequence ?? 0));

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

function TripSection({ trip, originalMap, allOriginalRows, onRevert }: {
  trip: TripGroup;
  originalMap: Record<string, any>;
  allOriginalRows: any[];
  onRevert: (tripId: string) => void;
}) {
  const [showCompare, setShowCompare] = useState(false);

  const changeCount = trip.rows.filter((r) => r.status !== "unchanged").length;
  const newCount = trip.rows.filter((r) => r.status === "new").length;
  const editCount = trip.rows.filter((r) => r.status === "edit" || r.status === "new edit").length;
  const deleteCount = trip.rows.filter((r) => r.status === "deleted").length;

  return (
    <div className="rounded-md border p-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to="/trips/table" search={{ selectedTripId: trip.tripId }}
          className="font-medium text-sm hover:text-primary transition-colors truncate max-w-[200px]">
          {trip.tripId}
        </Link>
        {trip.headsign && <span className="text-xs text-muted-foreground truncate max-w-[150px]">{trip.headsign}</span>}
        <div className="flex gap-1">
          {newCount > 0 && <Badge variant="default" className="text-[10px] h-5">{newCount} new</Badge>}
          {editCount > 0 && <Badge variant="secondary" className="text-[10px] h-5">{editCount} modified</Badge>}
          {deleteCount > 0 && <Badge variant="destructive" className="text-[10px] h-5">{deleteCount} deleted</Badge>}
        </div>
        <div className="ml-auto flex gap-1">
          <Button variant={showCompare ? "default" : "outline"} size="sm" className="h-7 text-xs"
            onClick={() => setShowCompare(!showCompare)}>
            <BiGitCompare className="mr-1 h-3 w-3" />{showCompare ? "Hide" : "Compare"}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link to="/trips/table" search={{ selectedTripId: trip.tripId }}>
              <BiMap className="mr-1 h-3 w-3" />View
            </Link>
          </Button>
        </div>
      </div>
      {showCompare && (
        <CompareView tripId={trip.tripId} editedRows={trip.rows} originalMap={originalMap} />
      )}
    </div>
  );
}

const StopTimesTable = ({ FileTypes, setFileTypes }: { FileTypes: any; setFileTypes: any }) => {
  const duckDB = useDuckDB();
  const conn = duckDB?.conn;
  const initialized = duckDB?.initialized ?? false;
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [clickInfo, setClickInfo] = useState<any>();

  // Fetch edit table
  const { data: tableData = [], isLoading, isError, error } = useQuery({
    queryKey: ["EditStopTimesTable"],
    queryFn: () => fetchTableData({ conn, table: "EditStopTimesTable" }),
    enabled: !!conn && initialized,
  });

  // Fetch trip metadata (service_id, route info, headsign) for grouping
  const tripIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of tableData) if (r.trip_id) ids.add(String(r.trip_id));
    return Array.from(ids);
  }, [tableData]);

  const { data: tripMeta = {} } = useQuery({
    queryKey: ["stopTimesExportTripMeta", tripIds],
    queryFn: async () => {
      if (!conn || tripIds.length === 0) return {};
      const idList = tripIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
      const result = await conn.query(`
        SELECT t.trip_id, t.service_id, t.trip_headsign,
               r.route_id, r.route_short_name, r.route_long_name
        FROM trips t
        LEFT JOIN routes r ON t.route_id = r.route_id
        WHERE t.trip_id IN (${idList})
      `);
      const rows = result.toArray().map((r: any) => r.toJSON());
      const map: Record<string, any> = {};
      for (const r of rows) map[String(r.trip_id)] = r;
      return map;
    },
    enabled: !!conn && initialized && tripIds.length > 0,
  });

  // Fetch original rows for comparison
  const [originalMap, setOriginalMap] = useState<Record<string, any>>({});
  useEffect(() => {
    async function fetchOriginal() {
      if (!conn || tableData.length === 0) { setOriginalMap({}); return; }
      const edited = tableData.filter((r: any) => r.status === "edit" || r.status === "new edit");
      if (edited.length === 0) { setOriginalMap({}); return; }
      const ids = edited.map((r: any) => String(r.row_id));
      const map = await fetchOriginalRows(conn, "stop_times", "row_id", ids);
      setOriginalMap(map);
    }
    fetchOriginal();
  }, [conn, tableData.length]);

  // Also fetch ALL original stop_times for compare (deleted ones won't be in edit table)
  const { data: allOriginalByTrip = {} } = useQuery({
    queryKey: ["stopTimesExportOriginals", tripIds],
    queryFn: async () => {
      if (!conn || tripIds.length === 0) return {};
      const idList = tripIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");
      const result = await conn.query(`SELECT rowid as row_id, * FROM stop_times WHERE trip_id IN (${idList}) ORDER BY trip_id, stop_sequence`);
      const rows = result.toArray().map((r: any) => r.toJSON());
      const map: Record<string, any> = {};
      for (const r of rows) map[String(r.row_id)] = r;
      return map;
    },
    enabled: !!conn && initialized && tripIds.length > 0,
  });

  const hasData = tableData.length > 0;

  // Sync hasData with FileTypes
  useEffect(() => {
    setFileTypes((prev: any) => {
      if (prev.stop_times !== hasData) return { ...prev, stop_times: hasData };
      return prev;
    });
  }, [hasData, setFileTypes]);

  // Group by service_id
  const serviceGroups = useMemo<ServiceGroup[]>(() => {
    const byService = new Map<string, Map<string, EditRow[]>>();
    for (const row of tableData) {
      const tid = String(row.trip_id);
      const meta = tripMeta[tid];
      const sid = meta?.service_id || "unknown";
      if (!byService.has(sid)) byService.set(sid, new Map());
      const tripMap = byService.get(sid)!;
      if (!tripMap.has(tid)) tripMap.set(tid, []);
      tripMap.get(tid)!.push(row);
    }

    return Array.from(byService.entries()).map(([serviceId, tripMap]) => {
      const trips: TripGroup[] = Array.from(tripMap.entries()).map(([tripId, rows]) => {
        const meta = tripMeta[tripId];
        return { tripId, headsign: meta?.trip_headsign || "", rows };
      });
      const firstMeta = tripMeta[trips[0]?.tripId];
      const routeName = firstMeta?.route_short_name || firstMeta?.route_long_name || firstMeta?.route_id || "";
      return { serviceId, routeId: firstMeta?.route_id || "", routeName, trips };
    }).sort((a, b) => a.serviceId.localeCompare(b.serviceId));
  }, [tableData, tripMeta]);

  const mutation = useMutation({
    mutationFn: async (mutateType: string) =>
      mutationExportFn({
        conn,
        mutateType,
        SelectStation: undefined,
        selectedRow: clickInfo,
        TableName: "EditStopTimesTable",
        tableName: "EditStopTimesTable",
        rowIdField: "row_id",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["EditStopTimesTable"] });
      queryClient.invalidateQueries({ queryKey: ["fetchServiceTripStopTimesData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchAllTripsData"] });
      queryClient.invalidateQueries({ queryKey: ["fetchTripsTimeBounds"] });
      setClickInfo(undefined);
    },
  });

  const handleButtonClick = () => {
    setFileTypes((prev: any) => ({ ...prev, stop_times: !prev.stop_times }));
  };

  if (isLoading) return <div className="border rounded p-4 animate-pulse h-16" />;
  if (isError) return <div className="text-red-500 p-2">Error: {(error as any)?.message}</div>;

  const buttonClasses = !hasData
    ? "flex items-center rounded-sm justify-center w-12 h-12 bg-stone-300 text-stone-400 cursor-not-allowed dark:bg-stone-800"
    : FileTypes.stop_times
      ? "flex items-center justify-center w-12 h-12 bg-green-500 hover:bg-green-600 rounded-sm"
      : "flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 rounded-sm";

  const triggerClasses = !hasData
    ? "flex w-full justify-between items-center px-4 py-2.5 bg-stone-300 text-stone-500 dark:bg-stone-700 dark:text-stone-400 rounded-sm cursor-not-allowed"
    : FileTypes.stop_times
      ? "flex w-full justify-between items-center px-4 py-2.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-sm cursor-pointer transition-colors"
      : "flex w-full justify-between items-center px-4 py-2.5 bg-stone-300 dark:bg-stone-600 hover:bg-stone-200 dark:hover:bg-stone-500 rounded-sm cursor-pointer transition-colors";

  const totalEdits = tableData.length;
  const editedTrips = tripIds.length;

  return (
    <Collapsible open={hasData && isExpanded} onOpenChange={(open) => { if (hasData) setIsExpanded(open); }} className="border rounded p-2">
      <div className="flex gap-2">
        <button onClick={handleButtonClick} disabled={!hasData} className={buttonClasses}>
          {FileTypes.stop_times ? <BiCheck size={24} /> : <BiX size={24} />}
        </button>
        {hasData ? (
          <CollapsibleTrigger asChild>
            <button type="button" className={triggerClasses}>
              <div className="flex items-center w-full">
                <span className="flex items-center">
                  {isExpanded ? <BiChevronUp size={16} /> : <BiChevronDown size={16} />}
                  <span className="ml-1 text-lg font-bold">stop_times.txt</span>
                </span>
                <span className="ml-3 text-sm text-muted-foreground">
                  {totalEdits} edit{totalEdits !== 1 ? "s" : ""} across {editedTrips} trip{editedTrips !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          </CollapsibleTrigger>
        ) : (
          <div className={triggerClasses} aria-disabled="true">
            <span className="text-lg font-bold">stop_times.txt</span>
          </div>
        )}
      </div>
      {hasData && (
        <CollapsibleContent className="mt-2 w-full">
          <div className="space-y-3 rounded-md border shadow-sm p-3">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => mutation.mutate("table")}>
                <BiRefresh className="mr-1 h-4 w-4" />Revert All Changes
              </Button>
            </div>

            {serviceGroups.map((sg) => (
              <div key={sg.serviceId} className="space-y-2">
                <div className="flex items-center gap-2 border-b pb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service</span>
                  <span className="text-sm font-bold">{sg.serviceId}</span>
                  {sg.routeName && <span className="text-xs text-muted-foreground">({sg.routeName})</span>}
                  <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                    {sg.trips.length} trip{sg.trips.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                {sg.trips.map((trip) => (
                  <TripSection
                    key={trip.tripId}
                    trip={trip}
                    originalMap={{ ...originalMap, ...allOriginalByTrip }}
                    allOriginalRows={[]}
                    onRevert={() => {}}
                  />
                ))}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export default StopTimesTable;
