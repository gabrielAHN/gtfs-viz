import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDuckDB } from "@/context/duckdb.client";
import { checkTripIdExists } from "@/lib/duckdb/DataFetching/fetchRouteData";
import { executeQuery } from "@/lib/duckdb/QueryHelper";
import { BiChevronDown, BiChevronRight } from "react-icons/bi";
import { PointsMapEditor } from "@/components/maps/PointsMapEditor";
import { FormActions } from "@/components/forms/shared/FormActions";

export function TripForm({ routeId, serviceId, onSave, onCancel, isPending, routeStops = [], initialData }: {
  routeId: string;
  serviceId: string;
  onSave: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
  routeStops?: Array<{ stop_id: string; stop_name?: string; stop_lat: number; stop_lon: number; location_type_name?: string }>;
  initialData?: any;
}) {
  const isEdit = !!initialData;
  const duckDB = useDuckDB();
  const conn = duckDB?.conn;
  const [tripId, setTripId] = useState(initialData?.trip_id || "");
  const [headsign, setHeadsign] = useState(initialData?.trip_headsign || "");
  const [directionId, setDirectionId] = useState<string>(initialData?.direction_id != null ? String(initialData.direction_id) : "");
  const existingShapeId = initialData?.shape_id || "";
  const [shapeId, setShapeId] = useState(existingShapeId);
  const [shapeEnabled, setShapeEnabled] = useState(!!existingShapeId);
  const [shapeOpen, setShapeOpen] = useState(false);
  const [shapePoints, setShapePoints] = useState<Array<{ lat: number; lon: number }>>([]);

  // Load existing shape points when editing a trip with a shape
  const { data: existingShapePoints } = useQuery({
    queryKey: ["shapePoints", existingShapeId],
    queryFn: async () => {
      const esc = existingShapeId.replace(/'/g, "''");
      const rows = await executeQuery(conn, `SELECT shape_pt_lat, shape_pt_lon FROM shapes WHERE shape_id = '${esc}' ORDER BY shape_pt_sequence`);
      return rows.map((r: any) => ({ lat: Number(r.shape_pt_lat), lon: Number(r.shape_pt_lon) })).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    },
    enabled: !!conn && !!existingShapeId && isEdit,
    staleTime: Infinity,
  });

  // Populate shape points from loaded data
  const shapePointsLoaded = useRef(false);
  useEffect(() => {
    if (existingShapePoints && existingShapePoints.length > 0 && !shapePointsLoaded.current) {
      shapePointsLoaded.current = true;
      setShapePoints(existingShapePoints);
    }
  }, [existingShapePoints]);

  const { data: tripIdExists = false } = useQuery({
    queryKey: ["tripIdExists", tripId],
    queryFn: () => checkTripIdExists(conn, tripId),
    enabled: !!conn && tripId.trim().length > 0 && tripId !== initialData?.trip_id,
    staleTime: 5000,
  });

  const shapeChanged = shapeEnabled && (
    shapeId !== existingShapeId ||
    shapePoints.length !== (existingShapePoints?.length || 0) ||
    shapePoints.some((p, i) => {
      const o = existingShapePoints?.[i];
      return !o || p.lat !== o.lat || p.lon !== o.lon;
    })
  );

  const hasTripChanges = isEdit
    ? (headsign !== (initialData?.trip_headsign || "") ||
       directionId !== (initialData?.direction_id != null ? String(initialData.direction_id) : "") ||
       shapeChanged)
    : !!tripId;

  return (
    <FormActions
      isBusy={isPending}
      isValid={!!tripId && !tripIdExists}
      hasChanges={hasTripChanges}
      onSave={() => onSave({
        trip_id: tripId, route_id: routeId, service_id: serviceId,
        trip_headsign: headsign || undefined,
        direction_id: directionId ? parseInt(directionId) : undefined,
        shape_id: (shapeEnabled && shapeId) ? shapeId : undefined,
      })}
      onCancel={onCancel}
      saveLabel={isEdit ? "Save" : "Add Trip"}
      busyLabel={isEdit ? "Saving..." : "Adding..."}
    >
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Trip ID</Label>
        <Input value={tripId} onChange={(e) => setTripId(e.target.value)} placeholder="Enter trip ID"
          className={tripIdExists ? "border-destructive" : ""} disabled={isEdit} />
        {tripIdExists && <p className="text-xs text-destructive">Trip ID already exists</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-muted-foreground">Route</Label>
          <Input value={routeId} disabled />
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground">Service</Label>
          <Input value={serviceId} disabled />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Headsign</Label>
        <Input value={headsign} onChange={(e) => setHeadsign(e.target.value)} placeholder="Trip headsign" />
      </div>
      <div className="space-y-2">
        <Label>Direction</Label>
        <Input value={directionId} onChange={(e) => setDirectionId(e.target.value)} placeholder="0 or 1" type="number" />
      </div>

      {/* Shape section */}
      <div className={`rounded-md border p-3 space-y-3 transition-colors ${shapeEnabled ? "border-primary/30 bg-primary/5" : ""}`}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => {
              if (shapeEnabled && shapeOpen) {
                setShapeEnabled(false); setShapeOpen(false);
                if (!isEdit) { setShapeId(""); setShapePoints([]); }
              } else {
                setShapeEnabled(true); setShapeOpen(true);
              }
            }}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {shapeEnabled && shapeOpen ? <BiChevronDown className="h-4 w-4" /> : <BiChevronRight className="h-4 w-4" />}
            <span>Shape{isEdit && existingShapeId ? ` (${existingShapeId})` : ""}</span>
          </button>
          <Switch checked={shapeEnabled} onCheckedChange={(checked) => { setShapeEnabled(checked); if (checked) setShapeOpen(true); else { setShapeOpen(false); if (!isEdit) { setShapeId(""); setShapePoints([]); } } }} />
        </div>
        {shapeEnabled && shapeOpen && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Shape ID</Label>
              <Input value={shapeId} onChange={(e) => setShapeId(e.target.value)} placeholder="Enter shape ID" disabled={isEdit} />
            </div>
            <PointsMapEditor points={shapePoints} onUpdatePoints={setShapePoints} contextStops={routeStops}
              originalPoints={isEdit && existingShapePoints ? existingShapePoints : undefined} />
          </div>
        )}
      </div>

    </div>
    </FormActions>
  );
}
