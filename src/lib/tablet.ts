/**
 * /tablet: the community tablet in the hub, in portrait. The hub needs a
 * steward whenever it is open, so the tablet is a calendar of the coming
 * days: for each, the bookings that need someone there (rooms rented for
 * euros, events; not what members paid with tokens, they let themselves
 * in) and who already signed up for a shift. A shift can start at any half
 * hour and last one to four hours.
 * Pure functions, so the calendar can be tested at any time of day.
 */

import { brusselsMs, dayKey } from "./events-board-format"
import type { Shift } from "./shifts-service"

/** A shift lasts one to four hours, three by default. */
export const SHIFT_HOURS = [1, 2, 3, 4]
export const DEFAULT_SHIFT_HOURS = 3
/** How long before a booking a shift for it starts. */
export const SHIFT_LEAD_MINUTES = 30
/** The day the calendar shows, and when a shift may start: from 7:00 to 22:00, on the half hour. */
export const DAY_FROM = 8 * 60
export const DAY_TO = 22 * 60
export const EARLIEST_START = 7 * 60
export const LATEST_START = 22 * 60
export const START_STEP = 30
/** How many days the tablet shows. */
export const DAYS = 14

/** Something at the hub that needs a steward: a room rented for euros, or an event. */
export interface TabletBooking {
  id: string
  title: string
  room?: string
  startMs: number
  endMs: number
}

export interface TabletShift {
  startMs: number
  endMs: number
  people: Array<{ id: string; name: string }>
}

export interface TabletDay {
  /** "2026-10-07", in Brussels. */
  day: string
  bookings: TabletBooking[]
  shifts: TabletShift[]
}

/** The coming days, from today, each with its bookings and shifts (earliest first). */
export function buildDays(now: number, bookings: TabletBooking[], shifts: Shift[], count = DAYS): TabletDay[] {
  const today = dayKey(now)
  const days: TabletDay[] = Array.from({ length: count }, (_, i) => ({
    day: new Date(Date.parse(`${today}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
    bookings: [],
    shifts: [],
  }))
  const byDay = new Map(days.map((d) => [d.day, d]))
  for (const b of bookings) if (b.endMs > now) byDay.get(dayKey(b.startMs))?.bookings.push(b)
  for (const s of shifts) {
    const startMs = Date.parse(s.start)
    const endMs = Date.parse(s.end)
    const people = s.signups.map((p) => ({ id: p.discordUserId || p.username, name: p.displayName || p.username })).filter((p) => p.name)
    if (people.length && endMs > now) byDay.get(dayKey(startMs))?.shifts.push({ startMs, endMs, people })
  }
  for (const d of days) {
    d.bookings.sort((a, b) => a.startMs - b.startMs)
    d.shifts.sort((a, b) => a.startMs - b.startMs)
  }
  return days
}

/** Is someone on shift during (part of) this booking? */
export const covered = (b: { startMs: number; endMs: number }, shifts: TabletShift[]) => shifts.some((s) => s.startMs < b.endMs && s.endMs > b.startMs)

/** A shift the tablet accepts: a day in the coming two weeks, a start on the half hour between 7:00 and 22:00, one to four hours. */
export function slotWindow(day: string, startMinutes: number, hours: number, now = Date.now()): { startMs: number; endMs: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(startMinutes) || !SHIFT_HOURS.includes(hours)) return null
  if (startMinutes < EARLIEST_START || startMinutes > LATEST_START || startMinutes % START_STEP) return null
  const today = dayKey(now)
  const ahead = (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000
  if (ahead < 0 || ahead >= DAYS) return null
  const hh = String(Math.floor(startMinutes / 60)).padStart(2, "0")
  const mm = String(startMinutes % 60).padStart(2, "0")
  const startMs = brusselsMs(day, `${hh}:${mm}`)
  return { startMs, endMs: startMs + hours * 3_600_000 }
}

/** Minutes after midnight (Brussels) of an instant. */
export const minutesOf = (ms: number) => {
  const [h, m] = new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Brussels" }).split(":").map(Number)
  return h * 60 + m
}

/** The shift that suits a booking: from half an hour before, long enough to cover it (at most four hours). */
export function shiftFor(b: { startMs: number; endMs: number }): { start: number; hours: number } {
  const start = Math.min(LATEST_START, Math.max(EARLIEST_START, Math.floor((minutesOf(b.startMs) - SHIFT_LEAD_MINUTES) / START_STEP) * START_STEP))
  const hours = Math.min(4, Math.max(1, Math.ceil((b.endMs - b.startMs) / 3_600_000 + SHIFT_LEAD_MINUTES / 60)))
  return { start, hours }
}
