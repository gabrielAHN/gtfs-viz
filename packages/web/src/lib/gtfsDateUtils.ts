import { format, parse } from "date-fns"

export const DAY_LABELS = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
] as const

export const normalizeGtfsDate = (value?: string) =>
  String(value || "")
    .replace(/-/g, "")
    .trim()

export const gtfsDateToDay = (dateStr?: string) => {
  const normalized = normalizeGtfsDate(dateStr)
  if (!normalized || normalized.length !== 8) return undefined
  const y = parseInt(normalized.substring(0, 4))
  const m = parseInt(normalized.substring(4, 6)) - 1
  const d = parseInt(normalized.substring(6, 8))
  const ts = Date.UTC(y, m, d)
  return Number.isFinite(ts) ? Math.floor(ts / 86400000) : undefined
}

export const dayToDisplay = (dayNum: number) => {
  const date = new Date(dayNum * 86400000)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  })
}

export const serviceDays = (service: Record<string, any>) => {
  const days = DAY_LABELS.filter(([key]) => Number(service[key] || 0) === 1).map(
    ([, label]) => label,
  )
  return days.length > 0 ? days.join(", ") : "Dates only"
}

export const serviceInDateRange = (service: Record<string, any>, range: [number, number]) => {
  const startDay = gtfsDateToDay(service.start_date)
  const endDay = gtfsDateToDay(service.end_date)
  if (startDay === undefined && endDay === undefined) return true
  const sStart = startDay ?? endDay!
  const sEnd = endDay ?? startDay!
  return sStart <= range[1] && sEnd >= range[0]
}

export const parseGtfsDate = (gtfs?: string | Date): Date | undefined => {
  if (!gtfs) return undefined
  if (gtfs instanceof Date) return Number.isNaN(gtfs.getTime()) ? undefined : gtfs
  const str = String(gtfs)
  if (str.length < 8) return undefined
  const normalized = str.replace(/-/g, "")
  return parse(normalized, "yyyyMMdd", new Date())
}

export const toGtfsDate = (d: Date): string => format(d, "yyyyMMdd")
