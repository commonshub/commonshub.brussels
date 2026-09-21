/**
 * Server-side loaders for the day page. Reads the dataset (read-only), the
 * community relays (the record for shifts and identities) and the #door
 * channel on Discord, with a short in-memory cache so a busy day does not
 * hammer them.
 */

import * as fs from "fs"
import * as path from "path"
import { DATA_DIR } from "./data-paths"
import settings from "@/settings/settings.json"
import { getChannelMessages, isDiscordConfigured } from "./discord"
import { type DiscordMessageLike, type DoorOpening, type PublicEventRecord, dayBounds, parseDoorOpenings } from "./day"
import {
  KIND_ATTESTATION,
  KIND_PROFILE,
  KIND_RSVP,
  type ShiftSlot,
  type Signup,
  parseAttestations,
  parseProfiles,
  parseSignups,
  shiftCoordinate,
} from "./nostr-conventions"
import { COMMUNITY, coordinatorPubkey, queryRelays, siteIdentity } from "./nostr-server"

const DOOR_CHANNEL = (settings as { door?: { channelId?: string } }).door?.channelId ?? "1306678821751230514"
export const SHIFTS_CHANNEL = settings.discord.channels.activities.shifts

const SHIFTS = (settings as { shifts?: { slots?: ShiftSlot[]; maxSignupsPerSlot?: number; description?: string } }).shifts ?? {}
/** Same slots as the bot's /shifts command (shifts-settings.json). */
export const SHIFT_SLOTS: ShiftSlot[] = SHIFTS.slots ?? [
  { start: "08:30", end: "11:30" },
  { start: "11:30", end: "14:30" },
  { start: "14:30", end: "17:30" },
  { start: "17:30", end: "20:30" },
  { start: "20:30", end: "22:30" },
]
export const MAX_SIGNUPS_PER_SLOT = SHIFTS.maxSignupsPerSlot ?? 3
export const SHIFTS_DESCRIPTION = SHIFTS.description ?? "Sign up for a caretaking shift to take care of our common space and help hosting events."

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

async function recentMessages(channelId: string): Promise<DiscordMessageLike[]> {
  if (!isDiscordConfigured()) return []
  const hit = cache.get(channelId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.messages
  try {
    const messages = (await getChannelMessages(channelId, { limit: 100 })) as DiscordMessageLike[]
    cache.set(channelId, { at: Date.now(), messages })
    return messages
  } catch (error) {
    console.error("[day] discord read failed:", error)
    return hit?.messages ?? []
  }
}

/** Who opened the door that day. The last ~100 messages cover a day comfortably. */
export async function loadDoorOpenings(day: string): Promise<DoorOpening[]> {
  return parseDoorOpenings(await recentMessages(DOOR_CHANNEL), day)
}

// ── shifts, from the relays ───────────────────────────────────────────────

/**
 * Sign-ups for the day: RSVPs pointing at the day's shifts, with authors
 * named through the site's attestations and their own profiles. Providers
 * trusted for the discord ↔ key map: the site itself and the coordinator.
 */
export async function loadShiftSignups(day: string): Promise<Signup[]> {
  const coordinator = coordinatorPubkey()
  if (!coordinator) return []
  const coordinates = SHIFT_SLOTS.map((slot) => shiftCoordinate(coordinator, COMMUNITY, day, slot))
  const rsvps = await queryRelays({ kinds: [KIND_RSVP], "#a": coordinates, limit: 300 })
  if (rsvps.length === 0) return []

  const authors = [...new Set(rsvps.map((e) => e.pubkey))]
  const providers = [...new Set([siteIdentity()?.pubkey, coordinator].filter((p): p is string => !!p))]
  const [attestations, profiles] = await Promise.all([
    queryRelays({ kinds: [KIND_ATTESTATION], authors: providers, "#p": authors, limit: 300 }),
    queryRelays({ kinds: [KIND_PROFILE], authors, limit: 300 }),
  ])
  return parseSignups(rsvps, coordinator, COMMUNITY, day, SHIFT_SLOTS, parseAttestations(attestations, providers), parseProfiles(profiles))
}

/** The line posted in #shifts, worded like the bot's /shifts command. */
export function shiftDiscordLine(action: "signup" | "cancel", discordId: string, day: string, slot: ShiftSlot): string {
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  return action === "signup"
    ? `🙋 <@${discordId}> signed up for a shift on **${date}** ${slot.start}-${slot.end} (via the website)`
    : `❌ <@${discordId}> cancelled their shift on **${date}** ${slot.start}-${slot.end} (via the website)`
}

