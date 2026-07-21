import { useEffect, useState } from "react";
import { parseTime } from "@/lib/tripUtils";

const TIME_DATALIST_ID = "gtfs-time-suggestions";
const TIME_SUGGESTIONS = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 30; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
})();

export function TimeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused (external changes like timeline drag)
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = (v: string) => {
    const parsed = parseTime(v);
    if (parsed) { onChange(parsed); setDraft(parsed); }
    else if (v.trim() === "") { onChange(""); setDraft(""); }
  };

  return (
    <>
      <input
        list={TIME_DATALIST_ID}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={draft}
        placeholder={placeholder || "HH:MM"}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { setFocused(false); commit(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter") commit(draft); }}
      />
      <datalist id={TIME_DATALIST_ID}>
        {TIME_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
      </datalist>
    </>
  );
}
