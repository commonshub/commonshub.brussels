/**
 * The website's own Nostr identity, for the actions it publishes on the
 * community relay (relay.commonshub.brussels). The relay is the record;
 * Discord and the pages are ways to read and write it.
 *
 * The key is derived from AUTH_SECRET, which every deployment already has,
 * so no second secret to manage: the same deployment always signs with the
 * same key, and a fresh AUTH_SECRET is a fresh identity. The relay only
 * accepts writes from allow-listed pubkeys; /api/nostr/identity prints this
 * deployment's npub so it can be added.
 */

import { createHash } from "crypto"
import { finalizeEvent, getPublicKey, type Event as NostrEvent, type EventTemplate } from "nostr-tools/pure"
import { SimplePool } from "nostr-tools/pool"
import * as nip19 from "nostr-tools/nip19"
import settings from "@/settings/settings.json"

const NOSTR = (settings as { nostr?: { relays?: string[]; hubNpub?: string } }).nostr ?? {}
export const RELAYS: string[] = NOSTR.relays ?? ["wss://relay.commonshub.brussels"]

/** The hub's own identity (chb signs with it); calendar events hang off it. */
export const HUB_PUBKEY: string | null = NOSTR.hubNpub ? (nip19.decode(NOSTR.hubNpub).data as string) : null

let cached: { secretKey: Uint8Array; pubkey: string } | null = null

export function siteIdentity(): { secretKey: Uint8Array; pubkey: string; npub: string } | null {
  const secret = process.env.NOSTR_NSEC || process.env.AUTH_SECRET
  if (!secret) return null
  if (!cached) {
    const secretKey = process.env.NOSTR_NSEC
      ? (nip19.decode(process.env.NOSTR_NSEC).data as Uint8Array)
      : new Uint8Array(createHash("sha256").update(`commonshub.brussels:nostr:${secret}`).digest())
    cached = { secretKey, pubkey: getPublicKey(secretKey) }
  }
  return { ...cached, npub: nip19.npubEncode(cached.pubkey) }
}

let pool: SimplePool | null = null
function getPool(): SimplePool {
  if (!pool) pool = new SimplePool()
  return pool
}

/** Sign with the site key and publish; resolves once one relay accepted it. */
export async function publishAsSite(template: EventTemplate): Promise<NostrEvent> {
  const identity = siteIdentity()
  if (!identity) throw new Error("No Nostr identity: AUTH_SECRET is not set")
  const event = finalizeEvent(template, identity.secretKey)
  const results = await Promise.allSettled(getPool().publish(RELAYS, event))
  if (!results.some((r) => r.status === "fulfilled")) {
    const reason = results.map((r) => (r.status === "rejected" ? String(r.reason) : "")).filter(Boolean).join("; ")
    throw new Error(`No relay accepted the event: ${reason || "unknown"}`)
  }
  return event
}

/** Query the relays; a slow relay does not block the page. */
export async function queryRelays(filter: Parameters<SimplePool["querySync"]>[1], timeoutMs = 2500): Promise<NostrEvent[]> {
  try {
    return await getPool().querySync(RELAYS, filter, { maxWait: timeoutMs })
  } catch (error) {
    console.error("[nostr] query failed:", error)
    return []
  }
}
