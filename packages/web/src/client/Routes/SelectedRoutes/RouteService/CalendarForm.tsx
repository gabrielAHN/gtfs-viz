import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { parseGtfsDate, toGtfsDate } from "@/lib/gtfsDateUtils";
import { FormActions } from "@/components/forms/shared/FormActions";

function DatePickerField({ label, value, onChange, fromDate, toDate }: {
  label: string; value: Date | undefined; onChange: (d: Date | undefined) => void;
  fromDate?: Date; toDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
            {value ? format(value, "MMM d, yyyy") : <span className="text-muted-foreground">Pick date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => { onChange(d); setOpen(false); }}
            startMonth={fromDate}
            endMonth={toDate}
            disabled={(d) => {
              if (fromDate && d < fromDate) return true;
              if (toDate && d > toDate) return true;
              return false;
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Safe number conversion that handles Arrow BigNum, BigInt, and regular values
const safeNum = (v: any): number => {
  if (v == null) return 0;
  try { return Number(v); } catch { return typeof v === "bigint" ? Number(v) : 0; }
};

export function CalendarForm({ initialData, onSave, onCancel, isPending }: {
  initialData?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  // Derive weekdays from exception dates when no regular calendar exists
  const hasCalendar = initialData && (initialData.start_date || safeNum(initialData.monday) || safeNum(initialData.tuesday) || safeNum(initialData.wednesday) || safeNum(initialData.thursday) || safeNum(initialData.friday) || safeNum(initialData.saturday) || safeNum(initialData.sunday));
  const exceptionDays = (() => {
    if (hasCalendar || !initialData?.added_exception_dates) return null;
    const daySet = new Set<number>();
    const dates = String(initialData.added_exception_dates).split(",");
    for (const d of dates) {
      const parsed = parseGtfsDate(d.trim());
      if (parsed) daySet.add(parsed.getDay());
    }
    // JS getDay(): 0=Sun,1=Mon,...,6=Sat → map to GTFS order
    return {
      monday: daySet.has(1) ? 1 : 0,
      tuesday: daySet.has(2) ? 1 : 0,
      wednesday: daySet.has(3) ? 1 : 0,
      thursday: daySet.has(4) ? 1 : 0,
      friday: daySet.has(5) ? 1 : 0,
      saturday: daySet.has(6) ? 1 : 0,
      sunday: daySet.has(0) ? 1 : 0,
    };
  })();

  const [serviceId, setServiceId] = useState(String(initialData?.service_id ?? ""));
  const [startDate, setStartDate] = useState<Date | undefined>(
    parseGtfsDate(initialData?.start_date) ?? parseGtfsDate(initialData?.first_exception_date)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    parseGtfsDate(initialData?.end_date) ?? parseGtfsDate(initialData?.last_exception_date)
  );
  const [days, setDays] = useState({
    monday: safeNum(initialData?.monday) ? 1 : (exceptionDays?.monday ?? 0),
    tuesday: safeNum(initialData?.tuesday) ? 1 : (exceptionDays?.tuesday ?? 0),
    wednesday: safeNum(initialData?.wednesday) ? 1 : (exceptionDays?.wednesday ?? 0),
    thursday: safeNum(initialData?.thursday) ? 1 : (exceptionDays?.thursday ?? 0),
    friday: safeNum(initialData?.friday) ? 1 : (exceptionDays?.friday ?? 0),
    saturday: safeNum(initialData?.saturday) ? 1 : (exceptionDays?.saturday ?? 0),
    sunday: safeNum(initialData?.sunday) ? 1 : (exceptionDays?.sunday ?? 0),
  });

  const dayLabels = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const dateError = startDate && endDate && startDate > endDate ? "End date must be after start date" : "";

  // Exception dates (editable)
  const [addedDates, setAddedDates] = useState<string[]>(() =>
    String(initialData?.added_exception_dates || "").split(",").filter(Boolean).map((d) => d.trim())
  );
  const [removedDates, setRemovedDates] = useState<string[]>(() =>
    String(initialData?.removed_exception_dates || "").split(",").filter(Boolean).map((d) => d.trim())
  );
  const [addExDateOpen, setAddExDateOpen] = useState(false);
  const [addExDateType, setAddExDateType] = useState<"added" | "removed">("added");
  const formatExDate = (d: string) => {
    const parsed = parseGtfsDate(d);
    return parsed ? format(parsed, "MMM d, yyyy") : d;
  };

  // Track changes for edit mode
  const origDays = initialData ? {
    monday: safeNum(initialData.monday) ? 1 : (exceptionDays?.monday ?? 0),
    tuesday: safeNum(initialData.tuesday) ? 1 : (exceptionDays?.tuesday ?? 0),
    wednesday: safeNum(initialData.wednesday) ? 1 : (exceptionDays?.wednesday ?? 0),
    thursday: safeNum(initialData.thursday) ? 1 : (exceptionDays?.thursday ?? 0),
    friday: safeNum(initialData.friday) ? 1 : (exceptionDays?.friday ?? 0),
    saturday: safeNum(initialData.saturday) ? 1 : (exceptionDays?.saturday ?? 0),
    sunday: safeNum(initialData.sunday) ? 1 : (exceptionDays?.sunday ?? 0),
  } : null;
  const origStartDate = initialData ? (parseGtfsDate(initialData.start_date) ?? parseGtfsDate(initialData.first_exception_date)) : undefined;
  const origEndDate = initialData ? (parseGtfsDate(initialData.end_date) ?? parseGtfsDate(initialData.last_exception_date)) : undefined;

  const origAddedDates = String(initialData?.added_exception_dates || "").split(",").filter(Boolean).map((d) => d.trim());
  const origRemovedDates = String(initialData?.removed_exception_dates || "").split(",").filter(Boolean).map((d) => d.trim());
  const exDatesChanged = addedDates.join(",") !== origAddedDates.join(",") || removedDates.join(",") !== origRemovedDates.join(",");

  const hasChanges = initialData
    ? (dayLabels.some((d) => days[d] !== (origDays?.[d] ?? 0)) ||
       startDate?.getTime() !== origStartDate?.getTime() ||
       endDate?.getTime() !== origEndDate?.getTime() ||
       exDatesChanged)
    : !!serviceId;

  return (
    <FormActions
      isBusy={isPending}
      isValid={!!serviceId && !dateError}
      hasChanges={hasChanges}
      onSave={() => onSave({
        service_id: serviceId, ...days,
        start_date: startDate ? toGtfsDate(startDate) : "",
        end_date: endDate ? toGtfsDate(endDate) : "",
        added_exception_dates: addedDates.join(","),
        removed_exception_dates: removedDates.join(","),
      })}
      onCancel={onCancel}
      saveLabel={initialData ? "Save" : "Add Service"}
      busyLabel={initialData ? "Saving..." : "Adding..."}
    >
    <div className="space-y-4">
      {!hasCalendar && initialData && (
        <div className="text-xs text-yellow-800 dark:text-yellow-200 p-2 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20">
          This service uses exception dates only. Days and dates are derived from exception dates.
        </div>
      )}
      <div className="space-y-2">
        <Label>Service ID</Label>
        <Input value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="service_id" disabled={!!initialData} />
      </div>
      <div className="space-y-2">
        <Label>Service Days</Label>
        <div className="flex flex-wrap gap-3">
          {dayLabels.map((day) => {
            const changed = initialData && days[day] !== (origDays?.[day] ?? 0);
            return (
              <label key={day} className={`flex items-center gap-1.5 text-sm cursor-pointer ${changed ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                <Checkbox checked={days[day] === 1} onCheckedChange={(checked) => setDays((prev) => ({ ...prev, [day]: checked ? 1 : 0 }))} />
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                {changed && <span className="text-[10px]">*</span>}
              </label>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Date Range</Label>
          {initialData && (startDate?.getTime() !== origStartDate?.getTime() || endDate?.getTime() !== origEndDate?.getTime()) && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">modified</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DatePickerField label="Start" value={startDate} onChange={setStartDate} toDate={endDate} />
          <DatePickerField label="End" value={endDate} onChange={setEndDate} fromDate={startDate} />
        </div>
        {dateError && <p className="text-xs text-red-500">{dateError}</p>}
      </div>

      {/* Exception dates (editable) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Exception Dates</Label>
          {exDatesChanged && initialData && <span className="text-[10px] text-amber-600 dark:text-amber-400">modified</span>}
        </div>
        <div className="rounded-md border p-3 space-y-3 text-xs">
          {/* Added dates */}
          <div className="space-y-1">
            <div className="font-medium text-green-700 dark:text-green-400">Added ({addedDates.length})</div>
            {addedDates.length > 0 && (
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {addedDates.map((d, i) => (
                  <span key={`a-${i}`} className="inline-flex items-center gap-1 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-1.5 py-0.5">
                    {formatExDate(d)}
                    <button type="button" className="text-green-600 hover:text-red-500 transition-colors"
                      onClick={() => setAddedDates((prev) => prev.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Removed dates */}
          <div className="space-y-1">
            <div className="font-medium text-red-700 dark:text-red-400">Removed ({removedDates.length})</div>
            {removedDates.length > 0 && (
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {removedDates.map((d, i) => (
                  <span key={`r-${i}`} className="inline-flex items-center gap-1 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-1.5 py-0.5">
                    {formatExDate(d)}
                    <button type="button" className="text-red-600 hover:text-red-800 transition-colors"
                      onClick={() => setRemovedDates((prev) => prev.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Add exception date */}
          <div className="flex items-center gap-2 pt-1 border-t">
            <select className="rounded border bg-background px-2 py-1 text-xs"
              value={addExDateType} onChange={(e) => setAddExDateType(e.target.value as "added" | "removed")}>
              <option value="added">Add date</option>
              <option value="removed">Remove date</option>
            </select>
            <Popover open={addExDateOpen} onOpenChange={setAddExDateOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]">
                  Pick date
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    const gtfs = toGtfsDate(d);
                    if (addExDateType === "added") {
                      if (!addedDates.includes(gtfs)) setAddedDates((prev) => [...prev, gtfs].sort());
                    } else {
                      if (!removedDates.includes(gtfs)) setRemovedDates((prev) => [...prev, gtfs].sort());
                    }
                    setAddExDateOpen(false);
                  }} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

    </div>
    </FormActions>
  );
}
