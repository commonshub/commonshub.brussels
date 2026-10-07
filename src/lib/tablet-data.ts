/**
 * What /tablet reads: what needs a steward in the coming two weeks, and who
 * is on shift.
 *
 * - The room bookings (chb's public bookings.json, this month and next),
 *   except those paid with tokens (`payment: "tokens"`: members who book with
 *   tokens let themselves in). Untitled private bookings read "Ostrom Room
 *   booking"; a booking for a public event takes the event's name.
 * - The hub's public events (latest/public/events.json) that no booking
 *   already covers.
 * - The shifts calendar.
 */

import { readLatestEvents, readTierJson } from "./dataset"
import { buildDays, DAYS, type TabletBooking, type TabletDay } from "./tablet"
import { isShiftsConfigured, listShifts, REWARD_PER_HOUR } from "./shifts-service"

interface BookingsFile {
  bookings?: Array<{
    room?: string
    roomName?: string
    start: string
    end: string
    title?: string
    eventUrl?: string
    public?: boolean
    /** How it was paid, from the booking (chb): token-paid bookings need no steward. */
    payment?: "tokens" | "euros" | null
  }>
}

const month = (ms: number) => {
  const d = new Date(ms)
  return [String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0")] as const
}

/** Everything that needs a steward from now to the end of the tablet's two weeks. */
export function loadTabletBookings(now = Date.now()): TabletBooking[] {
  const until = now + (DAYS + 1) * 86_400_000
  const events = readLatestEvents("public")
  const eventByUrl = new Map(events.filter((e) => e.url).map((e) => [e.url as string, e]))
  const seen = new Set<string>()
  const out: TabletBooking[] = []
  const months = [...new Set([month(now).join("/"), month(until).join("/")])]
  for (const ym of months) {
    const [y, m] = ym.split("/")
    for (const b of readTierJson<BookingsFile>("public", "bookings.json", y, m)?.bookings ?? []) {
      const startMs = Date.parse(b.start)
      const endMs = Date.parse(b.end)
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= now || startMs > until) continue
      if (b.payment === "tokens") continue
      const id = `${b.room}-${b.start}`
      if (seen.has(id)) continue
      seen.add(id)
      const event = b.eventUrl ? eventByUrl.get(b.eventUrl) : undefined
      if (b.eventUrl) seen.add(b.eventUrl)
      out.push({ id, title: event?.name || b.title || `${b.roomName ?? "Room"} booking`, room: b.roomName, startMs, endMs })
    }
  }
  for (const e of events) {
    const startMs = Date.parse(e.startAt)
    const endMs = e.endAt ? Date.parse(e.endAt) : startMs + 2 * 3_600_000
    if (!Number.isFinite(startMs) || endMs <= now || startMs > until || (e.url && seen.has(e.url))) continue
    out.push({ id: e.id, title: e.name, startMs, endMs })
  }
  return out.sort((a, b) => a.startMs - b.startMs)
}

export interface TabletData {
  days: TabletDay[]
  /** False when the shifts calendar cannot be reached: the tablet shows the bookings and says sign-ups are unavailable. */
  shiftsAvailable: boolean
  rewardAmountPerHour: number
  rewardTokenSymbol: string
}

export async function loadTablet(now = Date.now()): Promise<TabletData> {
  const bookings = loadTabletBookings(now)
  const base = { rewardAmountPerHour: REWARD_PER_HOUR, rewardTokenSymbol: "tokens" }
  if (!isShiftsConfigured()) return { ...base, days: buildDays(now, bookings, []), shiftsAvailable: false }
  try {
    const shifts = await listShifts(new Date(now - 12 * 3_600_000), new Date(now + (DAYS + 1) * 86_400_000))
    return { ...base, days: buildDays(now, bookings, shifts), shiftsAvailable: true }
  } catch (error) {
    console.error("[tablet] could not load shifts:", error)
    return { ...base, days: buildDays(now, bookings, []), shiftsAvailable: false }
  }
}
