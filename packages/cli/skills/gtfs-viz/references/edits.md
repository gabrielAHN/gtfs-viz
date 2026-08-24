# GTFS Viz CLI — Editing & Applying Service Changes

How to translate service changes (e.g. an MTA alerts page) into GTFS edits via the CLI, review
them, and export. **The CLI does not fetch or parse alerts** — you (the agent) read the change
source and feed the CLI structured edits. The CLI applies them and lets you review them in the
dashboard.

## Workflow

1. **Import the working feed** (the data to check and edit):
   `gtfs-viz import /abs/path/gtfs_supplemented.zip`
2. **Read the change source yourself** (the alerts page / notice). The CLI never touches it.
3. **Check whether each change already exists** in the imported data (see *Checking existence*).
4. **Confirm or implement**:
   - Already present → open the dashboard to that trip to confirm: `gtfs-viz trip <trip_id>`.
   - Missing/different → apply the edit (individual command or a batch `apply`), then open the
     dashboard to show it: `gtfs-viz trip <trip_id>`.
5. **Review** all pending edits: `gtfs-viz edits`. **Export** when done:
   `gtfs-viz export --output ./out`.

Always query/read through the merged `*View` tables (`TripsView`, `StopTimesView`, `CalendarView`,
`CalendarDatesView`) so pending edits are reflected. Base tables (`trips`, `stop_times`, …) show
the original feed only.

### Reading the alert source (practical notes)

- `mta.info` **blocks automated fetches** (returns HTTP 403 on `/alerts` and article pages), so do not
  rely on fetching those URLs directly. Use a web search to surface the current alert text (it returns
  the real, dated mta.info article content), and/or the MTA GTFS-realtime **service alerts** feed
  `https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys/subway-alerts` (structured:
  route_id / stop_id / trip + effect).
- The **supplemented** feed usually already encodes imminent planned changes as concrete short-horizon
  *diversion services* (service_ids with only `calendar_dates` rows, whose trips are rerouted or
  short-turned; the normal weekly service is switched off on those dates via `exception_type = 2`). So
  "does the data already reflect this change?" is often answered by inspecting those services — no edit
  needed. Only add edits for changes the feed hasn't picked up yet (e.g. later weekends outside the
  feed's short horizon).

## Checking existence

```bash
gtfs-viz routes --name "2" --data                        # find the route_id
gtfs-viz route <route_id> --view service --data          # services on that route
gtfs-viz route <route_id> --service <service_id> --data  # trips in a service
gtfs-viz trip <trip_id> --data                           # a trip's stop_times (edit-aware)
gtfs-viz calendar <service_id> --data                    # calendar + calendar_dates for a service
gtfs-viz query --sql "SELECT trip_id, trip_headsign FROM TripsView WHERE route_id = 'R1'"
```

## Individual edit commands

```bash
# Trips
gtfs-viz add_trip --trip-id T2 --route-id R1 --service-id WKD --headsign "Uptown Express" --direction-id 0
gtfs-viz update_trip --trip-id T2 --headsign "Express"        # only given fields change
gtfs-viz delete_trip --trip-id T2                             # also removes its stop_times

# Stop times — replaces the trip's whole stop list (diffed for new/changed/removed status)
gtfs-viz set_stop_times --trip-id T2 --stops-json '[
  {"stop_sequence":1,"stop_id":"S1","arrival_time":"09:00:00","departure_time":"09:00:00"},
  {"stop_sequence":2,"stop_id":"S3","arrival_time":"09:07:00","departure_time":"09:07:00"}
]'
gtfs-viz set_stop_times --trip-id T2 --stops-file ./t2_stops.json

# Common stop-pattern edits (macro-backed; pick by alert type — see the table below)
gtfs-viz remove_stops --trip T2 --stops "Spring St,Canal St"          # skip/express, station bypass
gtfs-viz truncate_trip --trip T2 --to "14 St"                          # short-turn / ends early (also --from)
gtfs-viz run_local --trip T2 --via LOCAL_TRIP --from "W 4 St-Wash Sq" --to "Jay St-MetroTech"  # run local (add stops back)
gtfs-viz split_trip --trip T2 --gap-from "Crescent St" --gap-to "Broadway Junction" --new-trip-id T2_SEC2  # two-section split

# Calendar (weekly pattern + service date range)
gtfs-viz add_calendar --service-id WKND --days sat,sun --start-date 20260101 --end-date 20261231
gtfs-viz update_calendar --service-id WKD --days mon,tue,wed,thu,fri,sat
gtfs-viz delete_calendar --service-id WKND

# Calendar exceptions (calendar_dates) — per-date add/remove of service
gtfs-viz add_calendar_date --service-id WKD --date 20260906 --exception-type 1   # 1 = add service that day
gtfs-viz add_calendar_date --service-id WKD --date 20260704 --exception-type 2   # 2 = remove service that day
gtfs-viz delete_calendar_date --service-id WKD --date 20260906
```

`--days` accepts full or 3-letter names: `mon,tue,wed,thu,fri,sat,sun`. Dates are `YYYYMMDD`.
Times are GTFS `HH:MM:SS` (hours may exceed 24 for trips past midnight).

## Batch changeset (mass edits)

Feed many edits at once. This is the primary way an agent applies a set of service changes.

```bash
gtfs-viz apply changeset.json          # from a file
gtfs-viz apply --json '{"ops":[...]}'  # inline
cat changeset.json | gtfs-viz apply --stdin
```

The changeset is `{ "ops": [ ... ] }` (or a bare `[ ... ]`). Ops run in array order — put a
`trip.add` before the `stop_times.set` for that trip.

| `op`                    | Required fields | Optional fields |
| ----------------------- | --------------- | --------------- |
| `trip.add`              | `trip_id`, `route_id`, `service_id` | `trip_headsign`, `direction_id`, `shape_id` |
| `trip.update`           | `trip_id` | any of `route_id`, `service_id`, `trip_headsign`, `direction_id`, `shape_id` |
| `trip.delete`           | `trip_id` | — (cascades to stop_times) |
| `stop_times.set`        | `trip_id`, `stops[]` | each stop: `stop_sequence`, `stop_id`, `arrival_time`, `departure_time`, `stop_headsign?`, `pickup_type?`, `drop_off_type?`, `shape_dist_traveled?` |
| `calendar.add`          | `service_id` | `monday`…`sunday` (0/1), `start_date`, `end_date` |
| `calendar.update`       | `service_id` | any of the above |
| `calendar.delete`       | `service_id` | — |
| `calendar_date.add`     | `service_id`, `date`, `exception_type` (1 add / 2 remove) | — |
| `calendar_date.delete`  | `service_id`, `date` | — |

Example — add a weekend express trip and scope it to two dates:

```json
{
  "ops": [
    { "op": "trip.add", "trip_id": "2X_wknd", "route_id": "2", "service_id": "WKND", "trip_headsign": "Flatbush Av Express", "direction_id": 0 },
    { "op": "stop_times.set", "trip_id": "2X_wknd", "stops": [
      { "stop_sequence": 1, "stop_id": "201", "arrival_time": "10:00:00", "departure_time": "10:00:00" },
      { "stop_sequence": 2, "stop_id": "204", "arrival_time": "10:08:00", "departure_time": "10:08:00" }
    ]},
    { "op": "calendar.add", "service_id": "WKND", "saturday": 1, "sunday": 1, "start_date": "20260101", "end_date": "20261231" },
    { "op": "calendar_date.add", "service_id": "WKND", "date": "20260906", "exception_type": 1 }
  ]
}
```

Edits are written to the same `Edit*Table`s the dashboard uses (status `new` / `edit` / `new edit`
/ `deleted`), so CLI and UI edits are interchangeable and visible in the same session.

## Reroute a trip onto another route (splice its stops)

A **reroute** (e.g. "A/C run via the F line") carries the **donor** route's stops through the diverted
section — it is **not** a plain skip (which just leaves a gap). Use the built-in command:

```bash
gtfs-viz reroute --trip <affected_trip>
gtfs-viz reroute --trip <affected_trip> --via <donor_trip> --from "<boundary stop>" --to "<boundary stop>"
```

The trip-only command opens the selected trip directly in the dashboard reroute form. A complete
command applies the splice and opens the affected trip with its edited stops visible. Use
`--url-only` to return the affected-trip link without navigating the browser, or `--data` to apply
without opening the dashboard.

- `--from` / `--to` are the two stops (by **name**) the affected route shares with the donor, where it
  leaves its normal path and where it rejoins. (A/F share **W 4 St-Wash Sq** and **Jay St-MetroTech**.)
- Pick a `--via` donor trip where both boundaries occur in the same travel order as the affected
  trip. `direction_id` does not need to match across routes because its meaning is route-specific.
  The donor's schedule time does not need to overlap the affected trip. The `--from`/`--to` order
  does **not** matter — the command normalizes the boundaries in the output.
- It replaces the affected trip's stops between the boundaries with the donor's stops (the donor's
  `stop_id`s), carrying the donor's **real inter-stop timing scaled** to fit the affected trip's window
  (not evenly spread). Backed by the `get_reroute_stop_times()` DuckDB macro.

Example — A/C run via the F on a weekend:
```bash
gtfs-viz route F --data                              # find a donor F trip with the shared boundaries in travel order
gtfs-viz reroute --trip <A_trip> --via <F_trip> --from "W 4 St-Wash Sq" --to "Jay St-MetroTech"
gtfs-viz reroute --trip <C_trip> --via <F_trip> --from "W 4 St-Wash Sq" --to "Jay St-MetroTech"
```

The spliced-in stops become `new`, the removed originals `deleted` — `gtfs-viz edits --trip <id>` shows
the swap. Compare against the donor when you also need to inspect the physical alignment:
```bash
gtfs-viz trip <affected_trip> --compare <donor_trip> --view map    # physical reroute on the map
gtfs-viz trip <affected_trip> --compare <donor_trip>               # stop-by-stop timetable
```

> Skip vs. reroute: use a plain **skip** (`set_stop_times` without the stops) only when trains truly
> bypass a segment with no substitute. Use **`gtfs-viz reroute`** whenever the alert says "run via the
> \<other\> line" / "rerouted over the \<other\>" — the trip must pick up that line's stops. (For a
> bespoke splice you can still build the list by hand and apply it with `set_stop_times`.)

## Reviewing edits

```bash
gtfs-viz edits                       # categorized summary of all pending edits
gtfs-viz edits --trip 2X_wknd        # original vs edited stop_times for one trip
gtfs-viz edits --trip 2X_wknd --compare-view map --url-only
gtfs-viz edits --view table --trips-page 3 --trips-page-size 20 --url-only
gtfs-viz edit_table trips            # raw EditTripsTable rows
gtfs-viz edit_table stop_times       # raw EditStopTimesTable rows
gtfs-viz edit_table calendar         # raw EditCalendarTable rows
gtfs-viz edit_table calendar_dates   # raw EditCalendarDatesTable rows
gtfs-viz trip 2X_wknd                # open the dashboard on the (possibly new) trip
gtfs-viz trip 2X_wknd --view timeline
```

`gtfs-viz trip <id>` opens `/trips/table?selectedTripId=<id>` and works for newly-added trips.
Add `--view timeline` or `--view map`. When a dashboard session is already open, the command
re-navigates it to the trip.

`gtfs-viz edits --trip <id> --compare-view map --url-only` opens the Edits & Export category view,
expands that trip's comparison, and selects the reroute map tab. For non-reroute schedule changes,
use `--compare-view table`.

## Alert types → CLI ops (playbook)

Common NYC-subway alert types and the op(s) that implement each. Always check whether the
**supplemented feed already encodes** the change (a diversion `service_id` with `calendar_dates`,
`exception_type=2` turning off normal service) before editing.

| Alert type | What it means | CLI op(s) |
|---|---|---|
| **Reroute via another line** | trip runs on another line's tracks for a segment ("2 runs on the 5 to Dyre Av"; F/M swap) | `reroute --trip <t> --via <donor> --from "<stop>" --to "<stop>"` — reciprocal swap = two calls |
| **Skip stops / runs express** | mid-route stops dropped | `remove_stops --trip <t> --stops "A,B,C"` |
| **Short-turn / ends early** | tail cut, terminates early ("1 runs Van Cortlandt Park ↔ 14 St") | `truncate_trip --trip <t> --to "<new terminal>"` |
| **Station closed / bypassed** | one stop skipped for a window | `remove_stops --trip <t> --stops "<stop>"` |
| **Runs local instead of express** | express adopts the local stop pattern (stops added back) | `run_local --trip <t> --via <local_trip> --from "<stop>" --to "<stop>"` |
| **No service on a segment** | segment not served (suspension) | `truncate_trip` (partial) or `delete_trip` (full) — often already in the feed as a diversion service |
| **Two-section / split operation** | line split into two independent segments | `split_trip --trip <t> --gap-from "<X>" --gap-to "<Y>" --new-trip-id <id2>` |
| **Added / extra service** | new/extra trips for an event or peak | `add_trip` + `set_stop_times`, scope with `add_calendar_date --exception-type 1` |
| **Holiday schedule (date swap)** | the whole day switches calendar pattern | paired `add_calendar_date`: `--exception-type 2` off the weekday service + `1` on the Saturday service |
| **Replaced by shuttle bus** | rail suspended, free bus substitutes | suspend rail (`delete_trip`/truncate) + `add_trip` for the bus **only if a bus route exists**; else note it |

Notes: reciprocal swaps (2↔5, F↔M) are one `reroute` per line/direction. Split / added / holiday
changes are multi-op — compose them with a batch `apply` changeset. Shuttle-bus substitution isn't
cleanly modelable unless a bus `route_id` already exists in the feed.

## Alert validation — report format

When you check alerts against the data, report **each** alert with this fixed template so results are
consistent and self-verifying. Confirm at the stop level before marking ✅, and always include a
clickable dashboard link generated by the CLI (never hand-write one).

```
#### <line(s)> — <one-line change>
- **In data:** ✅ present | ⚠️ partial | ❌ missing | ✏️ applied (edited via CLI)
- **Alert:** <the change, quoted or paraphrased>
- **Source:** <alert URL, or "web search: <query>" if the page was unfetchable>
- **When:** <alert date range + time window> → trip runs <YYYYMMDD, an actual date in that range>
  (service <service_id> active that date); stops fall <HH:MM–HH:MM>, inside the window.
- **Evidence:** <the CLI check that proves it — trip_id + the stop/calendar fact you saw>
- **Validated link:** [open <line> trip](<url from `gtfs-viz trip <trip_id> --view timeline --url-only`>)
```

Rules:
- **Confirm date, then time — and the date must be a real service date of the chosen trip.** Do not
  validate a weekend alert with a weekday trip, or an Aug 1–2 alert with a trip whose service never runs
  Aug 1–2. Check the trip's `service_id` against the calendar (`gtfs-viz calendar <route> --data`):
  the weekday flags + `start_date`/`end_date` must cover a date in the alert's range, and any
  `calendar_dates` exception (added=1 / removed=2) for that date must not cancel it. Name the exact
  date you validated on (e.g. Sat **2026-08-01**), not just "the weekend."
- **Then confirm the time as a range.** Read the trip's `stop_times` at the affected stops and show the
  arrival/departure span (e.g. stops run **23:41–01:12**), and state that it sits inside the alert's
  window (e.g. Fri 23:30 – Mon 05:00). GTFS times past midnight use 24:00+ (e.g. `25:10:00` = 1:10am
  next day) — a diversion trip that only exists in the overnight window is itself evidence the alert's
  time band is modeled.
- Generate the link with `gtfs-viz trip <trip_id> --view timeline --url-only` — this opens the trip on
  a **time axis**, so the change is visible at its scheduled time (the skipped stop is gone, the reroute
  is shifted). Use `--view timetable` for the stop-times table, or `--compare <donor_trip> --view map`
  for a reroute. **Pick a trip that actually runs during the alert's time window** (the right day/time
  and direction), not just any trip on the route. Print the URL with `--url-only`; do **not** hand-write
  it. If the daemon has idled out, reopen with `gtfs-viz trip <trip_id> --view timeline`.
- Mark ✅ only after inspecting stops (`gtfs-viz trip <id> --data`), never from the alert text alone.
  If the trip still runs its normal route, it is ❌/⚠️, not ✅ — say so.
- If the change was missing and you applied it, mark ✏️ applied, note the ops used, and review with
  `gtfs-viz edits --trip <id>`.
- `mta.info` blocks automated fetches — cite a web search or the GTFS-rt alerts feed as the source.

Worked examples:

```
#### 1 — no service 14 St ↔ South Ferry (runs Van Cortlandt Park-242 St ↔ 14 St)
- **In data:** ✅ present
- **Alert:** "1 trains will run between Van Cortlandt Park-242 St and 14 St."
- **Source:** https://www.mta.info/article/service-changes-1-2-3-line-summer-2026 (via web search)
- **Evidence:** trip L0S3-1-2039-… has 30 stops, last stop = 14 St (no South Ferry).
- **Validated link:** [open 1 trip](http://127.0.0.1:PORT/trips/table?…&selectedTripId=L0S3-1-2039-…)

#### A/C — rerouted via the F line, skipping Spring/Canal/Chambers/Fulton/High St
- **In data:** ✏️ applied (was ❌ — feed's Aug-1 A/C ran normally through those stops)
- **Alert:** "A trains rerouted via the F line; skip Spring, Canal, Chambers, Fulton, High St."
- **Source:** web search (MTA weekend track-work press release)
- **Evidence:** `stop_times.set` dropped those 5 stops from trips L0S3-A-… (58→53) and L0S3-C-… (40→35);
  confirmed via `gtfs-viz edits --trip L0S3-A-…` (5 rows status=deleted).
- **Validated link:** [open A trip](http://127.0.0.1:PORT/trips/table?…&selectedTripId=L0S3-A-…)
```

Close the report with a **summary table** that carries the CLI validation link as its own column, so
every row is one click from the dashboard. The **Validation** column is required — put the
`--url-only` link there as a markdown link (`[open](<url>)`); use `—` only for a row with no
applicable link (e.g. an alert marked ❌ N/A with no trip to open).

```
| Line(s) | Alert | Status | Validation |
|---------|-------|--------|------------|
| 1       | No service 14 St ↔ South Ferry | ✅ present | [open 1 trip](http://127.0.0.1:PORT/trips/table?…&view=timeline&selectedTripId=L0S3-1-2039-…) |
| A/C     | Rerouted via F, skip 5 stops   | ✏️ applied | [open A trip](http://127.0.0.1:PORT/trips/table?…&view=timeline&selectedTripId=L0S3-A-…) |
| 3       | No service 14 St ↔ South Ferry | ❌ N/A     | — |
```

### Times past midnight (GTFS 24:00+)

GTFS times are **operating-day** times, not wall-clock times, and they legally exceed `24:00:00`. A
stop at `25:10:00` on a trip whose service date is **2026-08-01** actually happens at **01:10 on
2026-08-02** — the same operating day, the next calendar day. Overnight service is common (this NYC
feed has tens of thousands of stop_times ≥ 24:00, up to `28:02:00`). Handle it everywhere:

- **Date reasoning.** A trip "belongs to" the date its service starts, even for its post-midnight
  stops. So an alert window like *Fri 23:30 → Mon 05:00* is covered by trips whose **service date** is
  Fri/Sat/Sun with stop times up in the `24:00–29:00` band — do not go looking for a separate
  Sun-night trip dated Monday. When you state the **When** line, give the service date (e.g.
  `2026-08-01`) and note that a `25:10` stop lands at `01:10` the next calendar day.
- **Time comparison — always via seconds, never string/clock math.** Compare with
  `gtfs_time_to_seconds(t)` (which keeps `25:10:00` = 90600, not 4200). Never `CAST(... AS TIME)` or
  reduce hours mod 24 — that collapses `25:10` to `01:10` and reorders the trip. A stop at `24:40` is
  *later* than one at `23:50`, and the alert's overnight window in seconds is
  `[23:30 → 86400+05:00]` = `[84600 → 104400]`.
- **Editing preserves it automatically.** `reroute` / `remove_stops` / `truncate_trip` / `split_trip`
  all round-trip through `gtfs_time_to_seconds`/`seconds_to_gtfs_time`, which emit `25:10:00` (integer
  hour division), so spliced/retimed stops keep their 24:00+ hours. When you **hand-write** a
  `stop_times.set` op for a post-midnight stop, keep the hour ≥ 24 (write `25:10:00`, not `01:10:00`) —
  otherwise the stop sorts before earlier ones and the trip appears to travel backward in time.
- **Never "normalize" a 24:00+ time to `01:xx`.** It breaks `stop_sequence` monotonicity and makes the
  trip span look negative. Leave overnight times as-is on export.

## Exporting

```bash
gtfs-viz export --output ./out
```

Merges edits with the originals and writes `stops.txt`, `pathways.txt`, `routes.txt`, `trips.txt`,
`stop_times.txt`, `calendar.txt`, `calendar_dates.txt`. Skip any file with `--no-stops`,
`--no-pathways`, `--no-routes`, `--no-trips`, `--no-stop-times`, `--no-calendar`. Use `--force` to
export with no pending edits.

## NYC weekend-diversion example

Alert: *"Aug 1–2, Manhattan-bound 2 trains skip 23 St, 18 St, Christopher St."*

1. `gtfs-viz routes --name "2" --data` → route_id.
2. `gtfs-viz route <route_id> --view service --data` → weekend `service_id`(s).
3. `gtfs-viz route <route_id> --service <service_id> --data` → affected trip_ids; for each,
   `gtfs-viz trip <trip_id> --data` to read its stops.
4. For each affected trip, build a `stop_times.set` op **without** the skipped stops (or add a new
   express trip on a diversion `service_id` plus `calendar_date.add` rows for Aug 1 and Aug 2).
5. `gtfs-viz apply changeset.json`, then `gtfs-viz trip <trip_id>` to confirm the change on the map/timeline.
6. `gtfs-viz edits` to review, `gtfs-viz export --output ./out` to emit the updated feed.
