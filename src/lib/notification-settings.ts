/**
 * Which recap emails a member wants: monthly, quarterly, yearly, any mix of
 * them, or none (opted out). Monthly is the default.
 *
 * Kept by Discord id only, never with an email address: chb sends the
 * emails (it holds the addresses) and asks /api/notifications/subscribers
 * who wants what. Stored like membership applications: on the community
 * relays, one addressable event per member (kind 30078), signed by the site
 * and encrypted to its own key (NIP-44). The `d` tag is an HMAC of the
 * Discord id, so the relays see neither who nor what.
 *
 * The signed link in the email is lib/notification-links.ts.
 */

import { createHmac } from "crypto"
import { getConversationKey, encrypt, decrypt } from "nostr-tools/nip44"

import { latestAddressable } from "./nostr-conventions"
import { publishAsSite, queryRelays, siteIdentity } from "./nostr-server"

export type Frequency = "monthly" | "quarterly" | "yearly"
export const FREQUENCIES: Frequency[] = ["monthly", "quarterly", "yearly"]

export interface NotificationSettings {
  monthly: boolean
  quarterly: boolean
  yearly: boolean
  updatedAt?: string
}

export const DEFAULT_SETTINGS: NotificationSettings = { monthly: true, quarterly: false, yearly: false }

const KIND_APP_DATA = 30078
const T_TAG = "notification-settings"

function key(): { secretKey: Uint8Array; pubkey: string; conversation: Uint8Array } {
  const id = siteIdentity()
  if (!id) throw new Error("No Nostr identity: AUTH_SECRET is not set")
  return { ...id, conversation: getConversationKey(id.secretKey, id.pubkey) }
}

/** The event's `d`: opaque, stable for a member. */
const dTag = (discordId: string, k = key()) => `${T_TAG}:${createHmac("sha256", Buffer.from(k.secretKey)).update(`notifications:${discordId}`).digest("base64url").slice(0, 32)}`

const clean = (s: Partial<NotificationSettings>): NotificationSettings => ({ monthly: !!s.monthly, quarterly: !!s.quarterly, yearly: !!s.yearly, ...(s.updatedAt ? { updatedAt: s.updatedAt } : {}) })

/** Everyone who changed their settings, by Discord id. */
export async function listSettings(): Promise<Map<string, NotificationSettings>> {
  const k = key()
  const events = await queryRelays({ kinds: [KIND_APP_DATA], authors: [k.pubkey], "#t": [T_TAG], limit: 2000 }, 4000)
  const out = new Map<string, NotificationSettings>()
  for (const e of latestAddressable(events)) {
    try {
      const { discordId, ...s } = JSON.parse(decrypt(e.content, k.conversation)) as NotificationSettings & { discordId: string }
      if (discordId) out.set(discordId, clean(s))
    } catch {
      /* not ours, or damaged */
    }
  }
  return out
}

export async function getSettings(discordId: string): Promise<NotificationSettings> {
  const k = key()
  const events = await queryRelays({ kinds: [KIND_APP_DATA], authors: [k.pubkey], "#d": [dTag(discordId, k)], limit: 5 }, 4000)
  const latest = latestAddressable(events)[0]
  if (!latest) return { ...DEFAULT_SETTINGS }
  try {
    return clean(JSON.parse(decrypt(latest.content, k.conversation)))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(discordId: string, s: Pick<NotificationSettings, Frequency>, now = new Date()): Promise<NotificationSettings> {
  const k = key()
  const next = { ...clean(s), updatedAt: now.toISOString() }
  const result = await publishAsSite({
    kind: KIND_APP_DATA,
    created_at: Math.floor(now.getTime() / 1000),
    tags: [
      ["d", dTag(discordId, k)],
      ["t", T_TAG],
    ],
    content: encrypt(JSON.stringify({ discordId, ...next }), k.conversation),
  })
  if (!result.accepted.length) throw new Error("Could not save your settings, please try again")
  return next
}

export { settingsUrl, signSettingsLink, verifySettingsLink, type SettingsClaim } from "./notification-links"
