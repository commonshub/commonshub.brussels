/**
 * How commonshub.brussels writes to the community relays. Follows
 * https://commonshub.dev/docs, which does the same for Telegram groups, so
 * any app that reads Elinor's events can read ours by swapping "telegram"
 * for "discord".
 *
 *   - Every event carries the community it belongs to:
 *       ["i","discord:<guild id>"] + ["k","discord"]   (filter: {"#i":[…]})
 *     and the app that produced it:
 *       ["client","commonshub.brussels", "31990:<site pubkey>:web"]  (NIP-89)
 *       ["t","app:commonshub.brussels"]                 (filter: {"#t":[…]})
 *   - A member is an npub. Their kind 0 profile carries a NIP-39 claim
 *       ["i","discord:<user id>"] + ["k","discord"]
 *     and the site, as identity provider, publishes one kind 31926 per
 *     member: d = "discord:<user id>", p = every key it has verified for
 *     them. Republishing replaces the list; dropping a key unlinks it.
 *   - A shift is a NIP-52 occurrence (31923) of the coordinator, with a
 *     deterministic d, and a sign-up is a NIP-52 RSVP (31925) by the member.
 *
 * Pure: no I/O, so the shapes can be tested.
 */

export const KIND_PROFILE = 0
export const KIND_SHIFT = 31923
export const KIND_RSVP = 31925
export const KIND_ATTESTATION = 31926
export const KIND_COMMUNITY = 34550

export const APP_NAME = "commonshub.brussels"

export interface Community {
  /** Discord guild id. */
  guildId: string
  name: string
}

export interface Template {
  kind: number
  created_at: number
  tags: string[][]
  content: string
}

export interface SignedLike {
  id?: string
  pubkey: string
  kind: number
  created_at: number
  tags: string[][]
  content: string
}

const tag = (event: { tags: string[][] }, name: string) => event.tags.find((t) => t[0] === name)?.[1]
const tags = (event: { tags: string[][] }, name: string) => event.tags.filter((t) => t[0] === name).map((t) => t[1])
export const nowSeconds = (now = new Date()) => Math.floor(now.getTime() / 1000)

/** Tags every event from this site carries: the community and the app. */
export function baseTags(community: Community, sitePubkey: string): string[][] {
  return [
    ["i", `discord:${community.guildId}`],
    ["k", "discord"],
    ["client", APP_NAME, `31990:${sitePubkey}:web`],
    ["t", `app:${APP_NAME}`],
  ]
}

// ── community & shifts (coordinator = the site, until a bot takes over) ──

export const communityD = (community: Community) => `dc${community.guildId}`
export const communityCoordinate = (coordinator: string, community: Community) =>
  `${KIND_COMMUNITY}:${coordinator}:${communityD(community)}`

/** NIP-72 community definition, one per Discord server. Addressable. */
export function buildCommunityDefinition(community: Community, sitePubkey: string, description: string, now = new Date()): Template {
  return {
    kind: KIND_COMMUNITY,
    created_at: nowSeconds(now),
    tags: [["d", communityD(community)], ["name", community.name], ["description", description], ...baseTags(community, sitePubkey)],
    content: "",
  }
}

export interface ShiftSlot {
  start: string
  end: string
}
export const slotCode = (slot: ShiftSlot) => slot.start.replace(":", "")
export const slotLabel = (slot: ShiftSlot) => `${slot.start}–${slot.end}`

/** `shift-<guild>-<day>-<code>`, the same shape Elinor uses for Telegram groups. */
export const shiftD = (community: Community, day: string, slot: ShiftSlot) => `shift-${community.guildId}-${day}-${slotCode(slot)}`
export const shiftCoordinate = (coordinator: string, community: Community, day: string, slot: ShiftSlot) =>
  `${KIND_SHIFT}:${coordinator}:${shiftD(community, day, slot)}`

/** Seconds since epoch for "HH:MM" on `day` in Brussels. */
function brusselsInstant(day: string, hhmm: string): number {
  // Europe/Brussels is UTC+1, UTC+2 in summer: probe both and keep the one
  // whose local rendering matches, so no timezone library is needed here.
  for (const offset of ["+02:00", "+01:00"]) {
    const date = new Date(`${day}T${hhmm}:00${offset}`)
    const local = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })
    if (local === hhmm) return Math.floor(date.getTime() / 1000)
  }
  return Math.floor(new Date(`${day}T${hhmm}:00+01:00`).getTime() / 1000)
}

/** NIP-52 time-based calendar event for one shift slot on one day. Addressable. */
export function buildShiftOccurrence(
  community: Community,
  sitePubkey: string,
  day: string,
  slot: ShiftSlot,
  capacity: number,
  title: string,
  now = new Date(),
): Template {
  return {
    kind: KIND_SHIFT,
    created_at: nowSeconds(now),
    tags: [
      ["d", shiftD(community, day, slot)],
      ["title", title],
      ["start", String(brusselsInstant(day, slot.start))],
      ["end", String(brusselsInstant(day, slot.end))],
      ["start_tzid", "Europe/Brussels"],
      ["capacity", String(capacity)],
      ["t", "shift"],
      ["t", slotCode(slot)],
      ["t", `group-${community.guildId}`],
      ["a", communityCoordinate(sitePubkey, community)],
      ...baseTags(community, sitePubkey),
    ],
    content: `${title} on ${day}, ${slotLabel(slot)}`,
  }
}

/** The member's RSVP, to sign with their own key. */
export function buildRsvp(
  action: "signup" | "cancel",
  community: Community,
  coordinator: string,
  sitePubkey: string,
  day: string,
  slot: ShiftSlot,
  now = new Date(),
): Template {
  return {
    kind: KIND_RSVP,
    created_at: nowSeconds(now),
    tags: [
      ["a", shiftCoordinate(coordinator, community, day, slot)],
      ["d", `rsvp-${community.guildId}-${day}-${slotCode(slot)}`],
      ["status", action === "signup" ? "accepted" : "declined"],
      ["p", coordinator],
      ["t", "shift"],
      ...baseTags(community, sitePubkey),
    ],
    content: action === "signup" ? `Signed up for the ${slotLabel(slot)} shift on ${day}` : `Can no longer do the ${slotLabel(slot)} shift on ${day}`,
  }
}

// ── identity ───────────────────────────────────────────────────────────────

export interface DiscordIdentity {
  id: string
  name: string
  username?: string
  avatar?: string
}

/** The member's kind 0, from their Discord profile, with the NIP-39 claim. */
export function buildProfile(user: DiscordIdentity, now = new Date()): Template {
  const content: Record<string, string> = { name: user.name, display_name: user.name }
  if (user.avatar) content.picture = user.avatar
  if (user.username) content.about = `@${user.username} on the Commons Hub Discord`
  return {
    kind: KIND_PROFILE,
    created_at: nowSeconds(now),
    tags: [["i", `discord:${user.id}`], ["k", "discord"]],
    content: JSON.stringify(content),
  }
}

/**
 * The site's attestation that these keys belong to this Discord member.
 * `keys` must be the complete current list: the event replaces the last one.
 */
export function buildAttestation(user: DiscordIdentity, keys: string[], community: Community, sitePubkey: string, now = new Date()): Template {
  const unique = [...new Set(keys.filter((k) => /^[0-9a-f]{64}$/.test(k)))]
  return {
    kind: KIND_ATTESTATION,
    created_at: nowSeconds(now),
    tags: [["d", `discord:${user.id}`], ...unique.map((k) => ["p", k]), ...baseTags(community, sitePubkey)],
    content: JSON.stringify({ name: user.name }),
  }
}

// ── reading back ───────────────────────────────────────────────────────────

/** Newest event per (author, d) — how addressable kinds are read. */
export function latestAddressable<T extends SignedLike>(events: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const event of events) {
    const key = `${event.pubkey}:${tag(event, "d") ?? ""}`
    const current = byKey.get(key)
    if (!current || current.created_at < event.created_at) byKey.set(key, event)
  }
  return [...byKey.values()]
}

export interface MemberLink {
  discordId: string
  name?: string
  keys: string[]
}

/** discord id → keys, from attestations by trusted providers (newest per d). */
export function parseAttestations(events: SignedLike[], providers: string[]): MemberLink[] {
  const trusted = new Set(providers)
  const out = new Map<string, MemberLink>()
  for (const event of latestAddressable(events.filter((e) => e.kind === KIND_ATTESTATION && trusted.has(e.pubkey)))) {
    const d = tag(event, "d")
    if (!d?.startsWith("discord:")) continue
    const discordId = d.slice("discord:".length)
    let name: string | undefined
    try {
      name = (JSON.parse(event.content || "{}") as { name?: string }).name
    } catch {
      /* no name */
    }
    const link = out.get(discordId) ?? { discordId, name, keys: [] }
    link.name = link.name ?? name
    for (const key of tags(event, "p")) if (!link.keys.includes(key)) link.keys.push(key)
    out.set(discordId, link)
  }
  return [...out.values()]
}

export interface ProfileInfo {
  pubkey: string
  name?: string
  picture?: string
  discordId?: string
}

/** Names and pictures from kind 0s, plus their own NIP-39 discord claim. */
export function parseProfiles(events: SignedLike[]): ProfileInfo[] {
  return latestAddressable(events.filter((e) => e.kind === KIND_PROFILE)).map((event) => {
    let content: { name?: string; display_name?: string; picture?: string } = {}
    try {
      content = JSON.parse(event.content || "{}")
    } catch {
      /* unreadable profile */
    }
    const claim = tags(event, "i").find((i) => i.startsWith("discord:"))
    return { pubkey: event.pubkey, name: content.display_name || content.name, picture: content.picture, discordId: claim?.slice("discord:".length) }
  })
}

export interface Signup {
  pubkey: string
  discordId?: string
  name: string
  picture?: string
  slotCode: string
  day: string
  at: string
}

/**
 * Current sign-ups for a day: newest RSVP per (author, d) wins, accepted
 * only; the author is named through the attestations and profiles.
 */
export function parseSignups(
  rsvps: SignedLike[],
  coordinator: string,
  community: Community,
  day: string,
  slots: ShiftSlot[],
  links: MemberLink[],
  profiles: ProfileInfo[],
): Signup[] {
  const codeByCoordinate = new Map(slots.map((slot) => [shiftCoordinate(coordinator, community, day, slot), slotCode(slot)]))
  const linkByKey = new Map<string, MemberLink>()
  for (const link of links) for (const key of link.keys) linkByKey.set(key, link)
  const profileByKey = new Map(profiles.map((p) => [p.pubkey, p]))

  return latestAddressable(rsvps.filter((e) => e.kind === KIND_RSVP))
    .filter((event) => (tag(event, "status") ?? "accepted") === "accepted")
    .flatMap((event) => {
      const code = tags(event, "a").map((a) => codeByCoordinate.get(a)).find(Boolean)
      if (!code) return []
      const link = linkByKey.get(event.pubkey)
      const profile = profileByKey.get(event.pubkey)
      // Sign-ups the site made under its own key, before members had keys.
      const legacyDiscord = tag(event, "discord")
      const legacyName = tag(event, "name")
      return [
        {
          pubkey: event.pubkey,
          discordId: link?.discordId ?? profile?.discordId ?? legacyDiscord,
          name: profile?.name || link?.name || legacyName || `${event.pubkey.slice(0, 8)}…`,
          picture: profile?.picture,
          slotCode: code,
          day,
          at: new Date(event.created_at * 1000).toISOString(),
        },
      ]
    })
    .sort((a, b) => a.at.localeCompare(b.at))
}
