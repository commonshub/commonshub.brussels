/**
 * One day at the hub: what is booked, what is public, who opened the door,
 * who signed up for a shift. Pure functions, so the gating rules (what a
 * visitor sees versus a signed-in member) can be tested.
 */

import { fromZonedTime, toZonedTime } from "date-fns-tz"
import { htmlToPlainText, redactContactDetails } from "./plain-text"
import { isPublicEvent, unwrapGoogleRedirect } from "./public-events"

export const HUB_TZ = "Europe/Brussels"

export const DAY_RE = /^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** Start and end of a calendar day in Brussels, as instants. */
export function dayBounds(day: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${day}T00:00:00`, HUB_TZ)
  const end = fromZonedTime(`${day}T23:59:59.999`, HUB_TZ)
  return { start, end }
}

export function dayOf(instant: Date | string): string {
  const zoned = toZonedTime(new Date(instant), HUB_TZ)
  const y = zoned.getFullYear()
  const m = String(zoned.getMonth() + 1).padStart(2, "0")
  const d = String(zoned.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + delta))
  return date.toISOString().slice(0, 10)
}

export function formatTime(instant: Date | string): string {
  return new Date(instant).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: HUB_TZ })
}

export function formatDayLong(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// ── schedule ───────────────────────────────────────────────────────────────

/** A room-calendar entry, as the rooms pages already read it. */
export interface RoomBooking {
  id: string
  title: string
  description?: string
  url?: string
  start: Date
  end: Date
  roomId: string
  roomName: string
}

/** A public event from the month's events.json. */
export interface PublicEventRecord {
  id: string
  name: string
  description?: string
  startAt: string
  endAt?: string
  url?: string
  location?: string
  coverImageLocal?: string
  coverImage?: string
}

export interface ScheduleItem {
  id: string
  kind: "public" | "booking"
  /** Room slug when known, "hub" for a Luma event with no room. */
  room: string
  roomName: string
  start: Date
  end: Date
  allDay: boolean
  /** Always present. For a booking seen by a visitor this is just "Booked". */
  title: string
  /** Only when the viewer may see it. */
  description?: string
  url?: string
  cover?: string
}

const eventKey = (url: string | undefined) =>
  (url ? unwrapGoogleRedirect(url) : "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^lu\.ma\//, "luma.com/")
    .replace(/\/+$/, "")

function cleanText(text: string | undefined): string | undefined {
  if (!text) return undefined
  const cleaned = redactContactDetails(htmlToPlainText(text)).trim()
  return cleaned || undefined
}

/**
 * Merge the room calendars and the month's public events into one list for
 * the day. A visitor sees public events in full and bookings as "Booked";
 * a member sees everything.
 */
export function buildDaySchedule(
  day: string,
  bookings: RoomBooking[],
  publicEvents: PublicEventRecord[],
  viewer: { isMember: boolean },
): ScheduleItem[] {
  const { start: dayStart, end: dayEnd } = dayBounds(day)
  const items: ScheduleItem[] = []
  const seen = new Set<string>()

  for (const event of publicEvents) {
    const start = new Date(event.startAt)
    const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 2 * 3600_000)
    if (end <= dayStart || start > dayEnd) continue
    const key = eventKey(event.url)
    if (key) seen.add(key)
    items.push({
      id: `event:${event.id}`,
      kind: "public",
      room: "hub",
      roomName: event.location && !/commons hub/i.test(event.location) ? event.location : "Commons Hub",
      start,
      end,
      allDay: false,
      title: event.name,
      description: cleanText(event.description),
      url: event.url ? unwrapGoogleRedirect(event.url) : undefined,
      cover: event.coverImageLocal ? `/data/${event.coverImageLocal}` : event.coverImage || undefined,
    })
  }

  for (const booking of bookings) {
    if (booking.end <= dayStart || booking.start > dayEnd) continue
    const isPublic = isPublicEvent({ name: booking.title, url: booking.url })
    const key = eventKey(booking.url)
    if (isPublic && key && seen.has(key)) continue // the Luma record already covers it
    const allDay = booking.end.getTime() - booking.start.getTime() >= 23 * 3600_000
    if (isPublic || viewer.isMember) {
      items.push({
        id: `booking:${booking.id}`,
        kind: isPublic ? "public" : "booking",
        room: booking.roomId,
        roomName: booking.roomName,
        start: booking.start,
        end: booking.end,
        allDay,
        title: booking.title,
        description: cleanText(booking.description),
        url: booking.url ? unwrapGoogleRedirect(booking.url) : undefined,
      })
    } else {
      items.push({
        id: `booking:${booking.id}`,
        kind: "booking",
        room: booking.roomId,
        roomName: booking.roomName,
        start: booking.start,
        end: booking.end,
        allDay,
        title: "Booked",
      })
    }
  }

  return items.sort((a, b) => a.start.getTime() - b.start.getTime() || a.roomName.localeCompare(b.roomName))
}

// ── the door ───────────────────────────────────────────────────────────────

export interface DiscordMessageLike {
  id: string
  content: string
  timestamp: string
  author: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean }
}

export interface DoorOpening {
  /** Discord user id when known. */
  userId?: string
  name: string
  /** Discord avatar URL when the opener posted "Open" themselves. */
  avatar?: string
  at: string
  via: "app" | "shortcut" | "event" | "other"
}

export function discordAvatarUrl(author: { id: string; avatar?: string | null }): string | undefined {
  return author.avatar ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=128` : undefined
}

const GREETING = /^Good (?:morning|afternoon|evening|night) (.+?)!/
const OPENED_BY = /Door opened by <@!?(\d+)>(?: via (\w+))?/

/**
 * Who opened the door that day, from the #door channel: a member posts
 * "Open" and the door bot answers with a greeting, or the bot reports
 * "Door opened by @user via shortcut". Newest first as Discord sends them.
 */
export function parseDoorOpenings(messages: DiscordMessageLike[], day: string): DoorOpening[] {
  const openings: DoorOpening[] = []
  const ordered = [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  let pendingOpen: DiscordMessageLike | null = null

  for (const message of ordered) {
    if (dayOf(message.timestamp) !== day) continue
    const content = message.content.trim()

    if (!message.author.bot) {
      if (/^open\b/i.test(content)) pendingOpen = message
      continue
    }

    const opened = content.match(OPENED_BY)
    if (opened) {
      const via = (opened[2] || "other").toLowerCase()
      const opener = pendingOpen && pendingOpen.author.id === opened[1] ? pendingOpen.author : null
      openings.push({
        userId: opened[1],
        name: opener ? displayName(opener) : `<@${opened[1]}>`,
        avatar: opener ? discordAvatarUrl(opener) : undefined,
        at: message.timestamp,
        via: via === "shortcut" || via === "app" || via === "event" ? via : "other",
      })
      pendingOpen = null
      continue
    }

    const greeting = content.match(GREETING)
    if (greeting) {
      openings.push({
        userId: pendingOpen?.author.id,
        name: greeting[1].trim(),
        avatar: pendingOpen ? discordAvatarUrl(pendingOpen.author) : undefined,
        at: message.timestamp,
        via: "app",
      })
      pendingOpen = null
    }
  }

  return openings.reverse()
}

export function displayName(author: { username: string; global_name?: string | null }): string {
  return (author.global_name || author.username).trim()
}

export interface PersonAtTheDoor {
  name: string
  userId?: string
  avatar?: string
  /** When they first came in that day. */
  firstAt: string
}

/** One entry per person, at the time they first opened the door, earliest first. */
export function peopleAtTheDoor(openings: DoorOpening[]): PersonAtTheDoor[] {
  const byPerson = new Map<string, PersonAtTheDoor>()
  for (const opening of [...openings].sort((a, b) => a.at.localeCompare(b.at))) {
    const key = opening.userId || opening.name.toLowerCase()
    const existing = byPerson.get(key)
    if (existing) {
      if (existing.name.startsWith("<@") && !opening.name.startsWith("<@")) existing.name = opening.name
      if (!existing.avatar && opening.avatar) existing.avatar = opening.avatar
    } else {
      byPerson.set(key, { name: opening.name, userId: opening.userId, avatar: opening.avatar, firstAt: opening.at })
    }
  }
  return [...byPerson.values()]
}
