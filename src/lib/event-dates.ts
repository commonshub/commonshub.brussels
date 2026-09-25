/**
 * When an event happens, in words, in Brussels time.
 *
 *   one day:    "Sunday 4 October · 09:30–18:00"
 *   several:    "25 January – 5 February 2027"
 *
 * The year shows only when it is not the current one, so the common case
 * stays short.
 */

const TZ = "Europe/Brussels"

const part = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleString("en-GB", { timeZone: TZ, ...options })
const dayKey = (date: Date) => part(date, { year: "numeric", month: "2-digit", day: "2-digit" })
const yearOf = (date: Date) => part(date, { year: "numeric" })

export function formatEventWhen(startAt: string, endAt?: string, now: Date = new Date()): string {
  const start = new Date(startAt)
  if (Number.isNaN(start.getTime())) return ""
  const end = endAt ? new Date(endAt) : null
  const hasEnd = !!end && !Number.isNaN(end.getTime()) && end > start
  const thisYear = yearOf(now)

  if (hasEnd && dayKey(end!) !== dayKey(start)) {
    const sameYear = yearOf(start) === yearOf(end!)
    const from = part(start, { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) })
    const to = part(end!, { day: "numeric", month: "long", ...(sameYear && yearOf(end!) === thisYear ? {} : { year: "numeric" }) })
    return `${from} – ${to}`
  }

  // Assembled from parts: en-GB puts a comma after the weekday only when a
  // year is present, and the wording should not change with the year.
  const date = part(start, { day: "numeric", month: "long", ...(yearOf(start) === thisYear ? {} : { year: "numeric" }) })
  const day = `${part(start, { weekday: "long" })} ${date}`
  const time = part(start, { hour: "2-digit", minute: "2-digit", hour12: false })
  const until = hasEnd ? `–${part(end!, { hour: "2-digit", minute: "2-digit", hour12: false })}` : ""
  return `${day} · ${time}${until}`
}
