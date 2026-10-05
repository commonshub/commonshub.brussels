/** Client-safe pieces of /events/screen (no Node modules): the event shape and how its day and time read. */

export interface ScreenEvent {
  id: string
  name: string
  startMs: number
  endMs: number
  /** Proxied cover, or "" when there is none. */
  cover: string
}

const TZ = "Europe/Brussels"
const day = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ })
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })

/** "Today", "Tomorrow", or "Wed 7 Oct", in Brussels. */
export function dayLabel(ms: number, now: number): string {
  if (day(ms) === day(now)) return "Today"
  if (day(ms) === day(now + 86_400_000)) return "Tomorrow"
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ })
}

/** "17:00–19:00" (just the start when it ends on another day). */
export function timeRange(startMs: number, endMs: number): string {
  return day(startMs) === day(endMs) ? `${hhmm(startMs)}–${hhmm(endMs)}` : hhmm(startMs)
}
