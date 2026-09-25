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
 *   - A steward may sign someone else up: the RSVP is signed by the steward,
 *     names the attendee with ["discord","<user id>"] and carries
 *     ["t","on-behalf"]; readers accept it only when the author's attestation
 *     carries ["role","steward"] or the author is the coordinator itself.
 *     Per (attendee, slot) the newest RSVP wins whoever signed it, so a
 *     member can cancel what a steward booked and the other way round.
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

/**
 * The member's RSVP, to sign with their own key — or, with `onBehalfOf`, a
 * steward's RSVP for another member: the attendee is named by Discord id,
 * the d is distinct per attendee so one steward can book several people.
 */
export function buildRsvp(
  action: "signup" | "cancel",
  community: Community,
  coordinator: string,
  sitePubkey: string,
  day: string,
  slot: ShiftSlot,
  now = new Date(),
  onBehalfOf?: DiscordIdentity,
): Template {
  const base = `rsvp-${community.guildId}-${day}-${slotCode(slot)}`
  const who = onBehalfOf ? `${onBehalfOf.name} ` : ""
  return {
    kind: KIND_RSVP,
    created_at: nowSeconds(now),
    tags: [
      ["a", shiftCoordinate(coordinator, community, day, slot)],
      ["d", onBehalfOf ? `${base}-discord:${onBehalfOf.id}` : base],
      ["status", action === "signup" ? "accepted" : "declined"],
      ["p", coordinator],
      ["t", "shift"],
      ...(onBehalfOf ? [["discord", onBehalfOf.id], ["name", onBehalfOf.name], ["t", "on-behalf"]] : []),
      ...baseTags(community, sitePubkey),
    ],
    content: action === "signup" ? `Signed up ${who}for the ${slotLabel(slot)} shift on ${day}` : `${who ? who.trim() + " can" : "Can"} no longer do the ${slotLabel(slot)} shift on ${day}`,
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

/** Community roles the site attests, as it sees them on Discord. */
export type MemberRole = "steward"

/**
 * The site's attestation that these keys belong to this Discord member.
 * `keys` must be the complete current list: the event replaces the last one.
 * `roles` are the member's community roles (["role","steward"]), which is
 * what lets readers trust their sign-ups on behalf of others.
 */
export function buildAttestation(user: DiscordIdentity, keys: string[], community: Community, sitePubkey: string, now = new Date(), roles: MemberRole[] = []): Template {
  const unique = [...new Set(keys.filter((k) => /^[0-9a-f]{64}$/.test(k)))]
  const uniqueRoles = [...new Set(roles)]
  return {
    kind: KIND_ATTESTATION,
    created_at: nowSeconds(now),
    tags: [["d", `discord:${user.id}`], ...unique.map((k) => ["p", k]), ...uniqueRoles.map((r) => ["role", r]), ...baseTags(community, sitePubkey)],
    content: JSON.stringify({ name: user.name, ...(uniqueRoles.length ? { roles: uniqueRoles } : {}) }),
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
  /** Community roles from the attestation's ["role", …] tags. */
  roles: string[]
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
    const link = out.get(discordId) ?? { discordId, name, keys: [], roles: [] }
    link.name = link.name ?? name
    for (const key of tags(event, "p")) if (!link.keys.includes(key)) link.keys.push(key)
    for (const role of tags(event, "role")) if (!link.roles.includes(role)) link.roles.push(role)
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
  /** The attendee's key, or the signer's when a steward booked them. */
  pubkey: string
  discordId?: string
  name: string
  picture?: string
  slotCode: string
  day: string
  at: string
  /** Set when a steward signed this member up: who did it. */
  signedBy?: { pubkey: string; discordId?: string; name: string }
}

/**
 * Current sign-ups for a day. Per (attendee, slot) the newest RSVP wins,
 * whoever signed it — the member or a steward on their behalf — and only
 * accepted ones remain. Attendees are named through the attestations and
 * profiles. An RSVP that names someone else is honoured only when its
 * author is the coordinator (the site's own older sign-ups) or attested
 * as a steward.
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
  const linkByDiscord = new Map(links.map((l) => [l.discordId, l]))
  const profileByKey = new Map(profiles.map((p) => [p.pubkey, p]))
  const profileByDiscord = new Map(profiles.filter((p) => p.discordId).map((p) => [p.discordId!, p]))

  const nameOf = (pubkey: string | undefined, discordId: string | undefined, fallback?: string) => {
    const profile = (pubkey && profileByKey.get(pubkey)) || (discordId && profileByDiscord.get(discordId)) || undefined
    const link = (pubkey && linkByKey.get(pubkey)) || (discordId && linkByDiscord.get(discordId)) || undefined
    return { name: profile?.name || link?.name || fallback || `${(pubkey ?? "").slice(0, 8)}…`, picture: profile?.picture }
  }

  // Newest RSVP per (attendee, slot), whoever signed it.
  const latest = new Map<string, { event: SignedLike; signup: Signup }>()
  for (const event of rsvps.filter((e) => e.kind === KIND_RSVP)) {
    const code = tags(event, "a").map((a) => codeByCoordinate.get(a)).find(Boolean)
    if (!code) continue
    const authorLink = linkByKey.get(event.pubkey)
    const authorProfile = profileByKey.get(event.pubkey)
    const authorDiscord = authorLink?.discordId ?? authorProfile?.discordId
    const named = tag(event, "discord")
    const onBehalf = !!named && named !== authorDiscord
    if (onBehalf && event.pubkey !== coordinator && !authorLink?.roles.includes("steward")) continue

    const attendeeDiscord = named ?? authorDiscord
    const attendeeKey = onBehalf ? linkByDiscord.get(named)?.keys[0] : event.pubkey
    const who = nameOf(attendeeKey, attendeeDiscord, tag(event, "name"))
    const signup: Signup = {
      pubkey: attendeeKey ?? event.pubkey,
      discordId: attendeeDiscord,
      name: who.name,
      picture: who.picture,
      slotCode: code,
      day,
      at: new Date(event.created_at * 1000).toISOString(),
      ...(onBehalf ? { signedBy: { pubkey: event.pubkey, discordId: authorDiscord, name: nameOf(event.pubkey, authorDiscord, event.pubkey === coordinator ? "the site" : undefined).name } } : {}),
    }
    const key = `${attendeeDiscord ?? event.pubkey}:${code}`
    const current = latest.get(key)
    if (!current || current.event.created_at < event.created_at) latest.set(key, { event, signup })
  }

  return [...latest.values()]
    .filter(({ event }) => (tag(event, "status") ?? "accepted") === "accepted")
    .map(({ signup }) => signup)
    .sort((a, b) => a.at.localeCompare(b.at))
}

// ── comments on an expense, a transaction, anything with a NIP-73 id ───────

export const KIND_COMMENT = 1111

/**
 * A top-level NIP-22 comment on external content: `I`/`K` name the thing
 * being discussed (the root), `i`/`k` the thing replied to, which for a
 * top-level comment is the same. The uppercase `I` is what tells a comment
 * apart from an annotation snapshot, which shares kind 1111 but carries
 * only the lowercase `i`. The community is referenced through its NIP-72
 * definition (`a`), not an extra `i` tag, which would change the parent.
 */
export function buildComment(uri: string, uriKind: string, content: string, community: Community, sitePubkey: string, now = new Date()): Template {
  return {
    kind: KIND_COMMENT,
    created_at: nowSeconds(now),
    tags: [
      ["I", uri],
      ["K", uriKind],
      ["i", uri],
      ["k", uriKind],
      ["a", communityCoordinate(sitePubkey, community)],
      ["client", APP_NAME, `31990:${sitePubkey}:web`],
      ["t", `app:${APP_NAME}`],
    ],
    content: content.trim(),
  }
}

/** True for a NIP-22 comment, false for an annotation snapshot. */
export const isComment = (event: { kind: number; tags: string[][] }) => event.kind === KIND_COMMENT && event.tags.some((t) => t[0] === "I")

export interface CommentView {
  id: string
  pubkey: string
  content: string
  at: string
  name: string
  picture?: string
  discordId?: string
}

/** The comments on `uri`, oldest first, authors named through attestations and profiles. */
export function parseComments(events: SignedLike[], uri: string, links: MemberLink[], profiles: ProfileInfo[]): CommentView[] {
  const linkByKey = new Map<string, MemberLink>()
  for (const link of links) for (const key of link.keys) linkByKey.set(key, link)
  const profileByKey = new Map(profiles.map((p) => [p.pubkey, p]))
  const seen = new Set<string>()
  return events
    .filter((e) => isComment(e) && tag(e, "I") === uri && e.content.trim() !== "")
    .filter((e) => (e.id ? (seen.has(e.id) ? false : (seen.add(e.id), true)) : true))
    .sort((a, b) => a.created_at - b.created_at)
    .map((e) => {
      const profile = profileByKey.get(e.pubkey)
      const link = linkByKey.get(e.pubkey)
      return {
        id: e.id ?? `${e.pubkey}:${e.created_at}`,
        pubkey: e.pubkey,
        content: e.content,
        at: new Date(e.created_at * 1000).toISOString(),
        name: profile?.name || link?.name || `${e.pubkey.slice(0, 8)}…`,
        picture: profile?.picture,
        discordId: link?.discordId ?? profile?.discordId,
      }
    })
}
