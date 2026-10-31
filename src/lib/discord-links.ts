/**
 * Which Discord account is which member, for chb (which knows members by
 * their email, from Odoo and Stripe, but not their Discord id).
 *
 * The link is the membership id chb already uses: emailHash =
 * sha256(lowercase(email) + EMAIL_HASH_SALT) (lib/membership.ts). The site
 * learns it two ways, and keeps the hash only, never the address:
 *   - a member logs in with Discord: the email of their Discord account;
 *   - a member confirms another address with a code (the one they pay
 *     with, when it isn't their Discord one: /api/members/email);
 *   - a member says yes to the membership whose name matches theirs
 *     (/api/membership/claim-name; lib/member-plan.ts nameCandidate);
 *   - a membership application, once its applicant logged in after paying.
 * The first two are recorded as one addressable event per member and
 * address on the community relays (kind 30078), signed by the site and
 * encrypted to its own key (NIP-44), with an opaque `d`, like the
 * notification settings. chb reads them all at /api/members/discord-links
 * and matches the hashes with its members' emails; the dashboard finds a
 * member's plan through them (lib/member-plan.ts).
 */

import { createHmac } from "crypto"
import { getConversationKey, encrypt, decrypt } from "nostr-tools/nip44"

import { latestAddressable } from "./nostr-conventions"
import { publishAsSite, queryRelays, siteIdentity } from "./nostr-server"

export interface DiscordLink {
  discordId: string
  emailHash: string
  /** "name": the member said a membership whose name matches theirs is theirs (weaker: a Discord name can be changed). */
  source: "login" | "email" | "name" | "application"
  /** When it was recorded (ISO). */
  at: string
  applicationId?: string
}

const KIND_APP_DATA = 30078
const T_TAG = "discord-link"

function key(): { secretKey: Uint8Array; pubkey: string; conversation: Uint8Array } {
  const id = siteIdentity()
  if (!id) throw new Error("No Nostr identity: AUTH_SECRET is not set")
  return { ...id, conversation: getConversationKey(id.secretKey, id.pubkey) }
}

/** One event per member and address, so a confirmed address and the Discord one don't replace each other. (Events from before carried one per member.) */
const dTag = (discordId: string, emailHash: string, k = key()) =>
  `${T_TAG}:${createHmac("sha256", Buffer.from(k.secretKey)).update(`discord-link:${discordId}:${emailHash}`).digest("base64url").slice(0, 32)}`

/** Links recorded by login or a confirmed address, one per member and address. */
export async function listLoginLinks(): Promise<DiscordLink[]> {
  const k = key()
  const events = await queryRelays({ kinds: [KIND_APP_DATA], authors: [k.pubkey], "#t": [T_TAG], limit: 2000 }, 4000)
  const out = new Map<string, DiscordLink>()
  for (const e of latestAddressable(events)) {
    try {
      const link = JSON.parse(decrypt(e.content, k.conversation)) as DiscordLink
      if (link.discordId && /^[0-9a-f]{64}$/.test(link.emailHash)) out.set(`${link.discordId}:${link.emailHash}`, { ...link, source: link.source === "email" || link.source === "name" ? link.source : "login" })
    } catch {
      /* not ours, or damaged */
    }
  }
  return [...out.values()]
}

let cache: { at: number; links: Promise<DiscordLink[]> } | null = null

/** Every link from logins, confirmed addresses and names (listLoginLinks, cached a minute). */
export async function cachedLinks(): Promise<DiscordLink[]> {
  if (!siteIdentity()) return []
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), links: listLoginLinks().catch(() => []) }
  return cache.links
}

/** What this process already knows is on the relays: one lookup per member and address. */
const known = new Set<string>()

/** Record that this Discord account goes with this membership id (logged in with it, or confirmed it), unless it already does. Never throws. */
export async function recordLoginLink(discordId: string, emailHash: string | null, now = new Date(), source: "login" | "email" | "name" = "login"): Promise<void> {
  if (!emailHash || !/^\d{5,25}$/.test(discordId) || !siteIdentity()) return
  const seen = `${discordId}:${emailHash}:${source}`
  if (known.has(seen)) return
  known.add(seen)
  try {
    const k = key()
    const d = dTag(discordId, emailHash, k)
    const existing = await queryRelays({ kinds: [KIND_APP_DATA], authors: [k.pubkey], "#d": [d], limit: 1 }, 4000)
    if (existing.length && source !== "email") return
    const link: DiscordLink = { discordId, emailHash, source, at: now.toISOString() }
    const result = await publishAsSite({
      kind: KIND_APP_DATA,
      created_at: Math.floor(now.getTime() / 1000),
      tags: [
        ["d", d],
        ["t", T_TAG],
      ],
      content: encrypt(JSON.stringify(link), k.conversation),
    })
    if (!result.accepted.length) known.delete(seen)
    else cache = null
  } catch (error) {
    known.delete(seen)
    console.error("[discord-links] could not record a link:", error)
  }
}
