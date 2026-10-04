/**
 * A hosted event's programme as the big screen shows it (/events/<slug>/screen):
 * the sessions of one day grouped by start time, each time slot told apart as
 * over, happening now, next or later, and only the few slots around now on
 * screen so the TV never has to scroll.
 *
 * The sessions are the ones in src/settings/events/<slug>.json, the same the
 * event page reads. Pure functions of the event and a clock, so they can be
 * tested at any time of day.
 */

import roomsData from "@/settings/rooms.json"

import type { HostedEvent } from "./hosted-events"

export type SlotStatus = "past" | "now" | "next" | "later"

export interface ScreenSession {
  /** HH:MM, local time of the event. */
  start: string
  end: string
  room: string
  roomName: string
  title: string
  speakers: string[]
}

export interface ScreenSlot {
  start: string
  end: string
  startMs: number
  endMs: number
  sessions: ScreenSession[]
}

export interface ScreenProgramme {
  /** YYYY-MM-DD shown, in the event's time zone. */
  date: string
  slots: ScreenSlot[]
}

/** The day's last slot has no next start to end at: it lasts at least this long. */
const LAST_SLOT_MINUTES = 60

export function roomName(slug: string): string {
  return roomsData.rooms.find((r) => r.slug === slug)?.name || slug || "Everywhere"
}

/** YYYY-MM-DD of an instant, in the event's time zone. */
function localDate(ms: number, timeZone: string): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone })
}

/** The instant of HH:MM on a day of the event (the event's UTC offset, as the event page does). */
function instant(event: HostedEvent, date: string, time: string): number {
  return Date.parse(`${date}T${time}:00${event.startAt.slice(19) || "Z"}`)
}

/**
 * Which day to show: today if the event has sessions today, else the next day
 * that has some, else the last one (the event is over).
 */
export function programmeDate(event: HostedEvent, now: number): string | null {
  const firstDay = localDate(Date.parse(event.startAt), event.timezone)
  const days = [...new Set(event.sessions.map((s) => s.date || firstDay))].sort()
  if (days.length === 0) return null
  const today = localDate(now, event.timezone)
  return days.find((day) => day >= today) ?? days[days.length - 1]
}

/** The day's sessions, one slot per start time. A session without an end runs until the next slot starts. */
export function buildProgramme(event: HostedEvent, now: number): ScreenProgramme | null {
  const date = programmeDate(event, now)
  if (!date) return null
  const firstDay = localDate(Date.parse(event.startAt), event.timezone)
  const sessions = event.sessions.filter((s) => (s.date || firstDay) === date)
  const starts = [...new Set(sessions.map((s) => s.start))].sort()

  const eventEnd = Date.parse(event.endAt)
  const slots = starts.map((start, i): ScreenSlot => {
    const startMs = instant(event, date, start)
    const own = sessions.filter((s) => s.start === start)
    const following = starts[i + 1]
    let endMs: number
    if (following) {
      endMs = instant(event, date, following)
    } else {
      // The day's last slot: its sessions' own ends if they have one, and
      // until the event ends when it ends that day.
      const ends = own.map((s) => (s.end ? instant(event, date, s.end) : 0))
      endMs = Math.max(startMs + LAST_SLOT_MINUTES * 60_000, ...ends)
      if (eventEnd > startMs && localDate(eventEnd, event.timezone) === date) endMs = Math.max(endMs, eventEnd)
    }
    const end = brusselsHHMM(endMs, event.timezone)
    return {
      start,
      end,
      startMs,
      endMs,
      sessions: own
        .map((s) => ({
          start: s.start,
          end: s.end || end,
          room: s.room || "",
          roomName: roomName(s.room || ""),
          title: s.title,
          speakers: s.speakers || [],
        }))
        .sort((a, b) => roomRank(a.room) - roomRank(b.room)),
    }
  })

  return { date, slots }
}

function roomRank(slug: string): number {
  const index = roomsData.rooms.findIndex((r) => r.slug === slug)
  return index < 0 ? Infinity : index
}

function brusselsHHMM(ms: number, timeZone: string): string {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })
}

/** Over, running, the very next one to start, or later. Only one slot is ever "next". */
export function slotStatuses(slots: ScreenSlot[], now: number): SlotStatus[] {
  const next = slots.findIndex((slot) => slot.startMs > now)
  return slots.map((slot, i) => {
    if (slot.endMs <= now) return "past"
    if (slot.startMs <= now) return "now"
    return i === next ? "next" : "later"
  })
}

/**
 * The slots to put on screen: `size` of them starting with the one running
 * now (or the next one, between slots), so the window moves along as the day
 * goes on. Near the end it stops moving and shows the last `size`, the ones
 * already over dimmed; before the day starts it shows the first.
 */
export function visibleWindow(slots: ScreenSlot[], now: number, size: number): { from: number; to: number } {
  const current = slots.findIndex((slot) => slot.endMs > now)
  const first = current < 0 ? slots.length : current
  const from = Math.max(0, Math.min(first, slots.length - size))
  return { from, to: Math.min(slots.length, from + size) }
}

export interface ScreenTournament {
  name: string
  start: string
  end: string
  startMs: number
  endMs: number
}

/** The event's tournament (it is played on the event's first day), with its instants. */
export function screenTournament(event: HostedEvent): ScreenTournament | null {
  const tournament = event.tournament
  if (!tournament) return null
  const date = localDate(Date.parse(event.startAt), event.timezone)
  return {
    name: tournament.name,
    start: tournament.start,
    end: tournament.end,
    startMs: instant(event, date, tournament.start),
    endMs: instant(event, date, tournament.end),
  }
}

/**
 * `?at=2026-10-04T14:20` on the screen page: the time to preview it at,
 * local to the event when no offset is given. Null when absent or invalid.
 */
export function parsePreviewTime(raw: string | undefined, event: HostedEvent): number | null {
  if (!raw) return null
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})?$/)
  if (!match) return null
  const [, date, time, zone] = match
  const ms = zone ? Date.parse(`${date}T${time}:00${zone}`) : instant(event, date, time)
  return Number.isNaN(ms) ? null : ms
}
