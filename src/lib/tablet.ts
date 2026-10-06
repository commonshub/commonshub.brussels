/**
 * /tablet: the community tablet in the hub, in portrait. Upcoming events,
 * each with the shift that stewards it: by default from 30 minutes before
 * the event for three hours, and who already signed up for shifts around it.
 * Pure functions, so the matching can be tested at any time of day.
 */

import type { Shift } from "./shifts-service"

export const SHIFT_LEAD_MINUTES = 30
export const DEFAULT_SHIFT_HOURS = 3
/** Lengths offered on the tablet, in hours. */
export const SHIFT_HOURS = [1, 2, 3, 4]
/** Starts offered, in minutes relative to the event's start. */
export const SHIFT_STARTS = [-60, -30, 0, 60]

export interface TabletEvent {
  id: string
  name: string
  startMs: number
  endMs: number
  cover: string
}

export interface TabletSignup {
  discordUserId: string
  displayName: string
  avatar?: string | null
  startMs: number
  endMs: number
}

export interface TabletEventWithShifts extends TabletEvent {
  /** The default shift for this event. */
  shift: { startMs: number; endMs: number }
  /** Everyone on a shift that overlaps the event (from its default start to the event's end), earliest first. */
  signups: TabletSignup[]
}

export function defaultShift(eventStartMs: number): { startMs: number; endMs: number } {
  const startMs = eventStartMs - SHIFT_LEAD_MINUTES * 60_000
  return { startMs, endMs: startMs + DEFAULT_SHIFT_HOURS * 3_600_000 }
}

/** Shifts that overlap an event's window, flattened to one line per person (a person on two overlapping shifts shows once, earliest). */
export function signupsFor(event: { startMs: number; endMs: number }, shifts: Shift[]): TabletSignup[] {
  const from = event.startMs - SHIFT_LEAD_MINUTES * 60_000
  const to = Math.max(event.endMs, event.startMs + 60_000)
  const byPerson = new Map<string, TabletSignup>()
  for (const shift of shifts) {
    const startMs = Date.parse(shift.start)
    const endMs = Date.parse(shift.end)
    if (!(startMs < to && endMs > from)) continue
    for (const s of shift.signups) {
      const prev = byPerson.get(s.discordUserId || s.username)
      const key = s.discordUserId || s.username
      if (!prev || startMs < prev.startMs) byPerson.set(key, { discordUserId: key, displayName: s.displayName || s.username, startMs, endMs })
    }
  }
  return [...byPerson.values()].sort((a, b) => a.startMs - b.startMs || a.displayName.localeCompare(b.displayName))
}

export function withShifts(events: TabletEvent[], shifts: Shift[]): TabletEventWithShifts[] {
  return events.map((e) => ({ ...e, shift: defaultShift(e.startMs), signups: signupsFor(e, shifts) }))
}

/** A start (minutes from the event) and a length (hours) the tablet accepts; anything else is refused. */
export function shiftWindow(eventStartMs: number, startOffsetMinutes: number, hours: number): { startMs: number; endMs: number } | null {
  if (!SHIFT_STARTS.includes(startOffsetMinutes) || !SHIFT_HOURS.includes(hours)) return null
  const startMs = eventStartMs + startOffsetMinutes * 60_000
  return { startMs, endMs: startMs + hours * 3_600_000 }
}
