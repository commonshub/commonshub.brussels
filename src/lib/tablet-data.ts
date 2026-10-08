/**
 * What /tablet reads for the week it shows: what needs a steward, and who is
 * on shift.
 *
 * - The room bookings (chb's public bookings.json, of the week's months),
 *   except those paid with tokens (`payment: "tokens"`: members who book with
 *   tokens let themselves in). Untitled private bookings read "Ostrom Room
 *   booking"; a booking for a public event takes the event's name.
 * - The hub's public events (the week's months, and the upcoming ones) that
 *   no booking already covers.
 * - The shifts calendar, with each person's avatar and what the public
 *   contributors list says about them (joined, contributions shared).
 *
 * On the hub's trusted tablet (lib/tablet-trust) it reads the members tier:
 * private bookings keep their titles, and people their introductions.
 */

import settings from "@/settings/settings.json"
import * as fs from "fs"
import * as path from "path"

import { tierDir, type Tier } from "./data-paths"
import { readEventsForMonth, readLatestEvents, readTierJson } from "./dataset"
import { discordGet, isDiscordConfigured } from "./discord"
import { buildDays, introOf, weekRange, type TabletBooking, type TabletDay } from "./tablet"
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

/** An event description as plain text, short enough for the tablet. */
const plain = (s: string) => {
  const text = s
    .replace(/<[^>]+>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text.length > 700 ? `${text.slice(0, 700).replace(/\s+\S*$/, "")}…` : text
}

interface Contributor {
  id: string
  displayName?: string
  avatar?: string | null
  joinedAt?: string | null
  contributionCount?: number
}

function readIntro(username: string | undefined): string | undefined {
  if (!username || !/^[\w.-]+$/.test(username)) return undefined
  try {
    const file = path.join(tierDir("members"), "profiles", `${username}.json`)
    return fs.existsSync(file) ? introOf((JSON.parse(fs.readFileSync(file, "utf-8")) as { introductions?: Array<{ content?: string }> }).introductions) : undefined
  } catch {
    return undefined
  }
}

/** Avatars and public details of the people on shift: the public contributors list, else their Discord profile; and their introduction on a trusted tablet. */
async function withProfiles(days: TabletDay[], tier: Tier): Promise<TabletDay[]> {
  const contributors = new Map((readTierJson<{ contributors?: Contributor[] }>("public", "contributors.json")?.contributors ?? []).map((c) => [c.id, c]))
  const ids = [...new Set(days.flatMap((d) => d.shifts.flatMap((s) => s.people.map((p) => p.id))))].filter((id) => /^\d{17,20}$/.test(id))
  const avatars = new Map<string, string | null>()
  if (isDiscordConfigured()) {
    await Promise.all(
      ids
        .filter((id) => !contributors.get(id)?.avatar)
        .map(async (id) => {
          try {
            const res = await discordGet(`/guilds/${settings.discord.guildId}/members/${id}`)
            if (!res.ok) return
            const m = (await res.json()) as { user?: { id: string; avatar?: string | null } }
            if (m.user?.avatar) avatars.set(id, `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=256`)
          } catch {}
        }),
    )
  }
  for (const d of days)
    for (const s of d.shifts)
      s.people = s.people.map((p) => {
        const c = contributors.get(p.id)
        const intro = tier === "members" ? readIntro(p.username) : undefined
        return {
          ...p,
          avatar: c?.avatar || avatars.get(p.id) || null,
          ...(c ? { joinedAt: c.joinedAt ?? null, contributions: c.contributionCount ?? 0 } : {}),
          ...(intro ? { intro } : {}),
        }
      })
  return days
}

const month = (ms: number) => {
  const d = new Date(ms)
  return [String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0")] as const
}

/** Everything that needs a steward between two instants. */
export function loadTabletBookings(fromMs: number, toMs: number, tier: Tier = "public"): TabletBooking[] {
  const months = [...new Set([month(fromMs).join("/"), month(toMs).join("/")])]
  const events = [...new Map([...months.flatMap((ym) => readEventsForMonth(tier, ...(ym.split("/") as [string, string]))), ...readLatestEvents(tier)].map((e) => [e.id, e])).values()]
  const eventByUrl = new Map(events.filter((e) => e.url).map((e) => [e.url as string, e]))
  const seen = new Set<string>()
  const out: TabletBooking[] = []
  for (const ym of months) {
    const [y, m] = ym.split("/")
    for (const b of readTierJson<BookingsFile>(tier, "bookings.json", y, m)?.bookings ?? []) {
      const startMs = Date.parse(b.start)
      const endMs = Date.parse(b.end)
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= fromMs || startMs >= toMs) continue
      if (b.payment === "tokens") continue
      const id = `${b.room}-${b.start}`
      if (seen.has(id)) continue
      seen.add(id)
      const event = b.eventUrl ? eventByUrl.get(b.eventUrl) : undefined
      if (b.eventUrl) seen.add(b.eventUrl)
      out.push({
        id,
        title: event?.name || b.title || `${b.roomName ?? "Room"} booking`,
        rooms: b.roomName ? [b.roomName] : [],
        startMs,
        endMs,
        ...(event?.description ? { description: plain(event.description) } : {}),
      })
    }
  }
  for (const e of events) {
    const startMs = Date.parse(e.startAt)
    const endMs = e.endAt ? Date.parse(e.endAt) : startMs + 2 * 3_600_000
    if (!Number.isFinite(startMs) || endMs <= fromMs || startMs >= toMs || (e.url && seen.has(e.url))) continue
    out.push({ id: e.id, title: e.name, rooms: [], startMs, endMs, ...(e.description ? { description: plain(e.description) } : {}) })
  }
  return out.sort((a, b) => a.startMs - b.startMs)
}

export interface TabletData {
  days: TabletDay[]
  /** On the hub's trusted tablet: members-only data shown. */
  trusted: boolean
  /** Weeks from this one (negative: back). */
  week: number
  /** False when the shifts calendar cannot be reached: the tablet shows the bookings and says sign-ups are unavailable. */
  shiftsAvailable: boolean
  rewardAmountPerHour: number
  rewardTokenSymbol: string
}

export async function loadTablet(week = 0, now = Date.now(), tier: Tier = "public"): Promise<TabletData> {
  const range = weekRange(now, week)
  const bookings = loadTabletBookings(range.fromMs, range.toMs, tier)
  const base = { week: range.week, trusted: tier === "members", rewardAmountPerHour: REWARD_PER_HOUR, rewardTokenSymbol: "tokens" }
  const days = (shifts: Parameters<typeof buildDays>[2]) => buildDays(now, bookings, shifts, undefined, range.first)
  if (!isShiftsConfigured()) return { ...base, days: days([]), shiftsAvailable: false }
  try {
    const shifts = await listShifts(new Date(range.fromMs), new Date(range.toMs))
    return { ...base, days: await withProfiles(days(shifts), tier), shiftsAvailable: true }
  } catch (error) {
    console.error("[tablet] could not load shifts:", error)
    return { ...base, days: days([]), shiftsAvailable: false }
  }
}
