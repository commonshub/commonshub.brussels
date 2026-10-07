/**
 * Client-safe pieces of the /events/screen designs (no Node modules): the
 * shapes they share and how days, weeks and "how soon" read, all in Brussels
 * time.
 */

export const TZ = "Europe/Brussels"

export interface BoardEvent {
  id: string
  name: string
  startMs: number
  endMs: number
  /** Proxied cover, or "" when there is none. */
  cover: string
  /** One line about it (featured events). */
  tagline?: string
  featured?: boolean
}

export interface Recurring {
  id: string
  title: string
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  /** "13:00". */
  start: string
  end?: string
  /** "members only". */
  note?: string
  emoji: string
  match: string
}

export interface RecurringNext extends Recurring {
  /** The next time it happens. */
  nextMs: number
}

export interface BoardData {
  now: number
  /** One-off events still to come (the weekly ones left out), soonest first. */
  events: BoardEvent[]
  /** The next featured event (one we host, with its own page), if any. */
  featured: BoardEvent | null
  recurring: RecurringNext[]
}

/** "2026-10-07", the day in Brussels. */
export const dayKey = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ })
export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
/** 0 = Monday … 6 = Sunday, in Brussels. */
export const weekdayMon = (ms: number) => (new Date(`${dayKey(ms)}T12:00:00Z`).getUTCDay() + 6) % 7

/** The instant a Brussels wall-clock time happens: "2026-10-12", "13:00". */
export function brusselsMs(day: string, time: string): number {
  const [y, m, d] = day.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const seen = Date.parse(`${new Date(guess).toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T")}Z`)
  return guess - (seen - guess)
}

/** Days from today to that day (0 today, 1 tomorrow), counted in Brussels calendar days. */
export function daysAway(ms: number, now: number): number {
  return Math.round((Date.parse(`${dayKey(ms)}T12:00:00Z`) - Date.parse(`${dayKey(now)}T12:00:00Z`)) / 86_400_000)
}

/** "Today", "Tomorrow", "Sat 10 Oct". */
export function dayName(ms: number, now: number, withMonth = true): string {
  const d = daysAway(ms, now)
  if (d === 0) return "Today"
  if (d === 1) return "Tomorrow"
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", ...(withMonth ? { month: "short" } : {}), timeZone: TZ })
}

/** "now", "in 40 min", "in 20 hours", "in 4 days", "in 3 weeks", "in 4 months". */
export function fromNow(ms: number, now: number): string {
  const diff = ms - now
  if (diff <= 0) return "now"
  const h = diff / 3_600_000
  if (h < 1) return `in ${Math.max(1, Math.round(diff / 60_000))} min`
  if (h < 36) return `in ${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"}`
  const d = daysAway(ms, now)
  if (d < 14) return `in ${d} days`
  if (d < 60) return `in ${Math.round(d / 7)} weeks`
  return `in ${Math.round(d / 30.4)} months`
}

/** "17:00–19:00", or just the start when it ends another day. */
export const timeRange = (startMs: number, endMs: number) => (dayKey(startMs) === dayKey(endMs) ? `${hhmm(startMs)}–${hhmm(endMs)}` : hhmm(startMs))

/** "25 Jan – 5 Feb" for an event over several days, else its day and time. */
export function whenLong(e: Pick<BoardEvent, "startMs" | "endMs">, now: number): string {
  if (dayKey(e.startMs) !== dayKey(e.endMs)) {
    const f = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })
    return `${f(e.startMs)} – ${f(e.endMs)}`
  }
  return `${dayName(e.startMs, now)} · ${timeRange(e.startMs, e.endMs)}`
}

export type WeekGroup = "this week" | "next week" | "later"

/** Which week an event falls in, weeks running Monday to Sunday. */
export function weekGroup(ms: number, now: number): WeekGroup {
  const d = daysAway(ms, now)
  const left = 6 - weekdayMon(now)
  if (d <= left) return "this week"
  if (d <= left + 7) return "next week"
  return "later"
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const weekdayShort = (n: number) => WEEKDAYS[n]
export const weekdayLong = (n: number) => WEEKDAYS_LONG[n]

/** The days a weekly event happens on between two days (Brussels "YYYY-MM-DD" keys, inclusive). */
export function occurrences(r: Recurring, fromDay: string, days: number): string[] {
  const out: string[] = []
  const start = Date.parse(`${fromDay}T12:00:00Z`)
  for (let i = 0; i < days; i++) {
    const t = start + i * 86_400_000
    if (new Date(t).getUTCDay() === r.weekday) out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/** The next time a weekly event happens (today's, if it hasn't ended yet). */
export function nextOccurrence(r: Recurring, now: number): number {
  const today = dayKey(now)
  for (const day of occurrences(r, today, 8)) {
    const startMs = brusselsMs(day, r.start)
    const endMs = brusselsMs(day, r.end ?? r.start) + (r.end ? 0 : 3_600_000)
    if (endMs > now) return startMs
  }
  return brusselsMs(occurrences(r, today, 14)[1] ?? today, r.start)
}
