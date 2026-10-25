/**
 * Dates and calendar files for the dashboard's booking dialogs. The hub is in
 * Brussels: what a member types (a date and a time) is Brussels time,
 * whatever their device's time zone.
 */

export const TZ = "Europe/Brussels"

/** Minutes Brussels is ahead of UTC at that moment. */
function offsetMinutes(at: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at).map((p) => [p.type, p.value]))
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  return Math.round((wall - Math.floor(at.getTime() / 60000) * 60000) / 60000)
}

/** "2026-10-26" + "14:30" in Brussels → ISO instant. */
export function brusselsIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const [h, min] = time.split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, h, min)
  // The offset at the guessed instant, then once more in case it crossed a DST change.
  let t = guess - offsetMinutes(new Date(guess)) * 60000
  t = guess - offsetMinutes(new Date(t)) * 60000
  return new Date(t).toISOString()
}

/** Today (plus `days`) in Brussels, as YYYY-MM-DD. */
export function todayInBrussels(days = 0, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(now.getTime() + days * 86_400_000))
}

/** Now in Brussels, as HH:MM. */
export function nowTimeInBrussels(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now)
}

/** HH:MM rounded up to the next half hour (room bookings go by 30 minutes), plus `addMinutes`; capped at 23:30. */
export function nextHalfHour(addMinutes = 0, now = new Date()): string {
  const [h, m] = nowTimeInBrussels(now).split(":").map(Number)
  const t = Math.min(Math.ceil((h * 60 + m) / 30) * 30 + addMinutes, 23 * 60 + 30)
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`
}

/** "Mon 26 Oct, 14:30–16:00" (Brussels). */
export function whenText(start: string, end: string): string {
  const s = new Date(start), e = new Date(end)
  const day = s.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })
  const hm = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  const sameDay = day === e.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })
  return sameDay ? `${day}, ${hm(s)}–${hm(e)}` : `${day}, ${hm(s)} – ${e.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })}, ${hm(e)}`
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n")
const icsUtc = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "")

/** A one-event .ics: a timed event, or an all-day one (start and end as YYYY-MM-DD, the same day). */
export function icsFor(e: { title: string; start: string; end: string; allDay?: boolean; location: string }, now = new Date()): string {
  const when = e.allDay
    ? [`DTSTART;VALUE=DATE:${e.start.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${todayInBrussels(1, new Date(`${e.end}T12:00:00Z`)).replace(/-/g, "")}`]
    : [`DTSTART:${icsUtc(new Date(e.start).toISOString())}`, `DTEND:${icsUtc(new Date(e.end).toISOString())}`]
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Commons Hub Brussels//commonshub.brussels//EN",
    "BEGIN:VEVENT",
    `UID:${now.getTime()}-${Math.random().toString(36).slice(2)}@commonshub.brussels`,
    `DTSTAMP:${icsUtc(now.toISOString())}`,
    ...when,
    `SUMMARY:${icsText(e.title)}`,
    `LOCATION:${icsText(e.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}
