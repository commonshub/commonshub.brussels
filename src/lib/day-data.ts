/**
 * Server-side loaders for the day page. Reads the dataset (read-only), the
 * community relays (the record for shifts and identities) and the #door
 * channel on Discord, with a short in-memory cache so a busy day does not
 * hammer them.
 */

import { readEventsForMonth } from "./dataset"
import settings from "@/settings/settings.json"
import { discordGet, getChannelMessages, isDiscordConfigured } from "./discord"
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
  const { start, end } = dayBounds(day)
  return (readEventsForMonth("public", year, month) as unknown as PublicEventRecord[]).filter((event) => {
    const s = new Date(event.startAt)
    const e = event.endAt ? new Date(event.endAt) : s
    return e >= start && s <= end
  })
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
export function shiftDiscordLine(action: "signup" | "cancel", discordId: string, day: string, slot: ShiftSlot, byDiscordId?: string): string {
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
  const via = byDiscordId && byDiscordId !== discordId ? `(by <@${byDiscordId}> via the website)` : "(via the website)"
  return action === "signup"
    ? `🙋 <@${discordId}> signed up for a shift on **${date}** ${slot.start}-${slot.end} ${via}`
    : `❌ <@${discordId}> cancelled their shift on **${date}** ${slot.start}-${slot.end} ${via}`
}

/** A guild member by id, as a steward may name them: only members with the member role. */
export async function lookupMember(discordId: string): Promise<{ id: string; name: string; username?: string; avatar?: string } | null> {
  if (!/^\d{5,25}$/.test(discordId) || !isDiscordConfigured()) return null
  try {
    const response = await discordGet(`/guilds/${settings.discord.guildId}/members/${discordId}`)
    if (!response.ok) return null
    const member = (await response.json()) as { user?: { id: string; username: string; global_name?: string | null; avatar?: string | null }; nick?: string | null; roles?: string[] }
    if (!member.user || !member.roles?.includes(settings.discord.roles.member)) return null
    return {
      id: member.user.id,
      name: (member.nick || member.user.global_name || member.user.username).slice(0, 60),
      username: member.user.username,
      avatar: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=256` : undefined,
    }
  } catch (error) {
    console.error("[day] member lookup failed:", error)
    return null
  }
}

