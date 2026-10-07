/**
 * /tablet: the community tablet in the hub, in portrait. The hub needs a
 * steward whenever it is open, so the tablet is a calendar, a week at a
 * time from today: for each, the bookings that need someone there (rooms rented for
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
/** The tablet shows a week at a time: from today, and back or ahead a few weeks. */
export const DAYS = 7
export const WEEKS_BACK = 4
export const WEEKS_AHEAD = 7
/** How far ahead someone can sign up: as far as the tablet goes. */
export const SIGNUP_DAYS = DAYS * (WEEKS_AHEAD + 1)

/** Something at the hub that needs a steward: a room rented for euros, or an event. */
export interface TabletBooking {
  id: string
  title: string
  /** The rooms it takes (one event can book several). */
  rooms: string[]
  startMs: number
  endMs: number
  /** What it is about, for an event (plain text). */
  description?: string
}

export interface TabletPerson {
  id: string
  name: string
  avatar?: string | null
  /** From the public contributors list: when they joined the community, how many contributions they shared. */
  joinedAt?: string | null
  contributions?: number
}

export interface TabletShift {
  startMs: number
  endMs: number
  people: TabletPerson[]
}

export interface TabletDay {
  /** "2026-10-07", in Brussels. */
  day: string
  bookings: TabletBooking[]
  shifts: TabletShift[]
}

/** One event booked in several rooms is one booking with all its rooms (same name, same day, overlapping times). */
export function mergeRooms(bookings: TabletBooking[]): TabletBooking[] {
  const out: TabletBooking[] = []
  for (const b of [...bookings].sort((x, y) => x.startMs - y.startMs)) {
    const same = out.find((o) => o.title.toLowerCase() === b.title.toLowerCase() && dayKey(o.startMs) === dayKey(b.startMs) && o.startMs < b.endMs && b.startMs < o.endMs)
    if (!same) {
      out.push({ ...b, rooms: [...b.rooms] })
      continue
    }
    same.endMs = Math.max(same.endMs, b.endMs)
    same.description ||= b.description
    for (const r of b.rooms) if (!same.rooms.includes(r)) same.rooms.push(r)
  }
  for (const b of out) b.rooms.sort((x, y) => x.localeCompare(y))
  return out
}

/** "2026-10-14": a calendar day a number of days after another. */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** The week the tablet shows: `week` weeks from today (negative: back), its first day and its bounds. */
export function weekRange(now: number, week: number): { week: number; first: string; fromMs: number; toMs: number } {
  const w = Math.min(WEEKS_AHEAD, Math.max(-WEEKS_BACK, Math.trunc(week) || 0))
  const first = addDays(dayKey(now), w * DAYS)
  return { week: w, first, fromMs: brusselsMs(first, "00:00"), toMs: brusselsMs(addDays(first, DAYS), "00:00") }
}

/**
 * The days from `first` (today by default), each with its bookings and
 * shifts (earliest first). Today leaves out what is over; past days keep
 * everything, as a record of who was there.
 */
export function buildDays(now: number, bookings: TabletBooking[], shifts: Shift[], count = DAYS, first = dayKey(now)): TabletDay[] {
  const today = dayKey(now)
  const days: TabletDay[] = Array.from({ length: count }, (_, i) => ({ day: addDays(first, i), bookings: [], shifts: [] }))
  const byDay = new Map(days.map((d) => [d.day, d]))
  const shown = (startMs: number, endMs: number) => dayKey(startMs) !== today || endMs > now
  for (const b of mergeRooms(bookings)) if (shown(b.startMs, b.endMs)) byDay.get(dayKey(b.startMs))?.bookings.push(b)
  for (const s of shifts) {
    const startMs = Date.parse(s.start)
    const endMs = Date.parse(s.end)
    const people = s.signups.map((p) => ({ id: p.discordUserId || p.username, name: p.displayName || p.username })).filter((p) => p.name)
    if (people.length && shown(startMs, endMs)) byDay.get(dayKey(startMs))?.shifts.push({ startMs, endMs, people })
  }
  for (const d of days) {
    d.bookings.sort((a, b) => a.startMs - b.startMs)
    d.shifts.sort((a, b) => a.startMs - b.startMs)
  }
  return days
}

/** The first part of a booking nobody is on shift for, or null when someone is there all along. */
export function uncovered(b: { startMs: number; endMs: number }, shifts: Array<{ startMs: number; endMs: number }>): { startMs: number; endMs: number } | null {
  let from = b.startMs
  for (const s of [...shifts].sort((x, y) => x.startMs - y.startMs)) {
    if (s.endMs <= from) continue
    if (s.startMs > from) break
    from = s.endMs
    if (from >= b.endMs) return null
  }
  const next = shifts.filter((s) => s.startMs > from && s.startMs < b.endMs).reduce((m, s) => Math.min(m, s.startMs), b.endMs)
  return { startMs: from, endMs: next }
}

/** Is someone on shift for the whole booking? */
export const covered = (b: { startMs: number; endMs: number }, shifts: Array<{ startMs: number; endMs: number }>) => uncovered(b, shifts) === null

/** A shift the tablet accepts: a day from today to as far as the tablet goes (eight weeks), a start on the half hour between 7:00 and 22:00, one to four hours. */
export function slotWindow(day: string, startMinutes: number, hours: number, now = Date.now()): { startMs: number; endMs: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(startMinutes) || !SHIFT_HOURS.includes(hours)) return null
  if (startMinutes < EARLIEST_START || startMinutes > LATEST_START || startMinutes % START_STEP) return null
  const today = dayKey(now)
  const ahead = (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000
  if (ahead < 0 || ahead >= SIGNUP_DAYS) return null
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

/** Joining someone's shift: the same time, on the half hour, one to four hours. */
export function joinSlot(s: { startMs: number; endMs: number }): { start: number; hours: number } {
  const start = Math.min(LATEST_START, Math.max(EARLIEST_START, Math.round(minutesOf(s.startMs) / START_STEP) * START_STEP))
  const hours = Math.min(4, Math.max(1, Math.round((s.endMs - s.startMs) / 3_600_000)))
  return { start, hours }
}

/** The shift that suits a booking: from half an hour before, long enough to cover it (at most four hours). */
export function shiftFor(b: { startMs: number; endMs: number }): { start: number; hours: number } {
  const start = Math.min(LATEST_START, Math.max(EARLIEST_START, Math.floor((minutesOf(b.startMs) - SHIFT_LEAD_MINUTES) / START_STEP) * START_STEP))
  const hours = Math.min(4, Math.max(1, Math.ceil((b.endMs - b.startMs) / 3_600_000 + SHIFT_LEAD_MINUTES / 60)))
  return { start, hours }
}
