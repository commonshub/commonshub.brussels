/**
 * Server-side loaders for the day page. Reads the dataset (read-only) and
 * the two Discord channels behind the door and the shifts, with a short
 * in-memory cache so a busy day does not hammer Discord.
 */

import * as fs from "fs"
import * as path from "path"
import { DATA_DIR } from "./data-paths"
import settings from "@/settings/settings.json"
import { getChannelMessages, isDiscordConfigured } from "./discord"
import {
  type DiscordMessageLike,
  type DoorOpening,
  type PublicEventRecord,
  type ShiftSignup,
  type ShiftSlot,
  dayBounds,
  parseDoorOpenings,
  parseShiftSignups,
} from "./day"

const DOOR_CHANNEL = (settings as { door?: { channelId?: string } }).door?.channelId ?? "1306678821751230514"
const SHIFTS_CHANNEL = settings.discord.channels.activities.shifts

export const SHIFT_SLOTS: ShiftSlot[] = (settings as { shifts?: { slots?: ShiftSlot[] } }).shifts?.slots ?? [
  { id: "morning", label: "Morning", time: "09:00–13:00" },
  { id: "afternoon", label: "Afternoon", time: "13:00–18:00" },
]

/** Public events from the month's events.json that touch the day. */
export function loadPublicEventsForDay(day: string): PublicEventRecord[] {
  const [year, month] = day.split("-")
  const file = path.join(DATA_DIR, year, month, "generated", "events.json")
  if (!fs.existsSync(file)) return []
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as { events?: PublicEventRecord[] }
    const { start, end } = dayBounds(day)
    return (data.events ?? []).filter((event) => {
      const s = new Date(event.startAt)
      const e = event.endAt ? new Date(event.endAt) : s
      return e >= start && s <= end
    })
  } catch (error) {
    console.error("[day] could not read events:", error)
    return []
  }
}

// ── Discord, cached a minute ──────────────────────────────────────────────

const cache = new Map<string, { at: number; messages: DiscordMessageLike[] }>()
const CACHE_MS = 60_000

async function recentMessages(channelId: string, force = false): Promise<DiscordMessageLike[]> {
  if (!isDiscordConfigured()) return []
  const hit = cache.get(channelId)
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.messages
  try {
    const messages = (await getChannelMessages(channelId, { limit: 100 })) as DiscordMessageLike[]
    cache.set(channelId, { at: Date.now(), messages })
    return messages
  } catch (error) {
    console.error("[day] discord read failed:", error)
    return hit?.messages ?? []
  }
}

export function forgetShiftMessages(): void {
  cache.delete(SHIFTS_CHANNEL)
}

/** Who opened the door that day. Only the last ~100 messages are read, which covers a day comfortably. */
export async function loadDoorOpenings(day: string): Promise<DoorOpening[]> {
  return parseDoorOpenings(await recentMessages(DOOR_CHANNEL), day)
}

export async function loadShiftSignups(day: string, force = false): Promise<ShiftSignup[]> {
  return parseShiftSignups(await recentMessages(SHIFTS_CHANNEL, force), day)
}

export { SHIFTS_CHANNEL }
