/**
 * Which Discord account is which member, for chb (which knows members by
 * their email, from Odoo and Stripe, but not their Discord id).
 *
 * The link is the membership id chb already uses: emailHash =
 * sha256(lowercase(email) + EMAIL_HASH_SALT) (lib/membership.ts). The site
 * learns it two ways, and keeps the hash only, never the address:
 *   - a member logs in with Discord: the email of their Discord account;
 *   - a membership application, once its applicant logged in after paying.
 * The first kind is recorded when it is seen (a member with the member
 * role and a session), as one addressable event per member on the
 * community relays (kind 30078), signed by the site and encrypted to its own
 * key (NIP-44), with an opaque `d`, like the notification settings. chb
 * reads them all at /api/members/discord-links and matches the hashes with
 * its members' emails.
 */

import { createHmac } from "crypto"
import { getConversationKey, encrypt, decrypt } from "nostr-tools/nip44"

import { latestAddressable } from "./nostr-conventions"
import { publishAsSite, queryRelays, siteIdentity } from "./nostr-server"

export interface DiscordLink {
  discordId: string
  emailHash: string
  source: "login" | "application"
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

const dTag = (discordId: string, k = key()) => `${T_TAG}:${createHmac("sha256", Buffer.from(k.secretKey)).update(`discord-link:${discordId}`).digest("base64url").slice(0, 32)}`

/** Links recorded by login, newest per member. */
export async function listLoginLinks(): Promise<DiscordLink[]> {
  const k = key()
  const events = await queryRelays({ kinds: [KIND_APP_DATA], authors: [k.pubkey], "#t": [T_TAG], limit: 2000 }, 4000)
  const out: DiscordLink[] = []
  for (const e of latestAddressable(events)) {
    try {
      const link = JSON.parse(decrypt(e.content, k.conversation)) as DiscordLink
      if (link.discordId && /^[0-9a-f]{64}$/.test(link.emailHash)) out.push({ ...link, source: "login" })
    } catch {
      /* not ours, or damaged */
    }
  }
  return out
}

/** What this process already knows is on the relays: one lookup per member and address. */
const known = new Set<string>()

/** Record that this Discord account logged in with this membership id, unless it already is. Never throws. */
export async function recordLoginLink(discordId: string, emailHash: string | null, now = new Date()): Promise<void> {
  if (!emailHash || !/^\d{5,25}$/.test(discordId) || !siteIdentity()) return
  const seen = `${discordId}:${emailHash}`
  if (known.has(seen)) return
  known.add(seen)
  try {
    const k = key()
    const d = dTag(discordId, k)
    const latest = latestAddressable(await queryRelays({ kinds: [KIND_APP_DATA], authors: [k.pubkey], "#d": [d], limit: 5 }, 4000))[0]
    if (latest) {
      try {
        if ((JSON.parse(decrypt(latest.content, k.conversation)) as DiscordLink).emailHash === emailHash) return
      } catch {}
    }
    const link: DiscordLink = { discordId, emailHash, source: "login", at: now.toISOString() }
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
  } catch (error) {
    known.delete(seen)
    console.error("[discord-links] could not record a link:", error)
  }
}
