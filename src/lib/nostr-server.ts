/**
 * The website's Nostr identity and its relay access, server side.
 *
 * The community relays are the record; Discord and the pages are ways to
 * read and write it. Everything is published to every relay in
 * settings.nostr.relays (relay.commonshub.brussels first, relay.commonshub.dev
 * as backup) and read back from all of them, merged.
 *
 * The site key derives from AUTH_SECRET, which every deployment already has,
 * so no second secret to manage; a fresh AUTH_SECRET is a fresh identity.
 * relay.commonshub.brussels only takes writes from allow-listed keys and from
 * keys those have attested (kind 31926), so the site key is allow-listed
 * once and members' keys follow through the site's attestations.
 * /api/nostr/identity prints this deployment's npub.
 */

import { createHash } from "crypto"
import { finalizeEvent, getPublicKey, type Event as NostrEvent } from "nostr-tools/pure"
import { SimplePool } from "nostr-tools/pool"
import * as nip19 from "nostr-tools/nip19"
import settings from "@/settings/settings.json"
import {
  KIND_ATTESTATION,
  KIND_COMMUNITY,
  KIND_PROFILE,
  KIND_SHIFT,
  type Community,
  type DiscordIdentity,
  type MemberRole,
  type ShiftSlot,
  type Template,
  buildAttestation,
  buildCommunityDefinition,
  buildShiftOccurrence,
  communityD,
  latestAddressable,
  parseAttestations,
  shiftD,
} from "./nostr-conventions"

const NOSTR = (settings as { nostr?: { relays?: string[]; coordinatorNpub?: string } }).nostr ?? {}
export const RELAYS: string[] = NOSTR.relays ?? ["wss://relay.commonshub.brussels", "wss://relay.commonshub.dev"]

export const COMMUNITY: Community = { guildId: settings.discord.guildId, name: "Commons Hub Brussels" }

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

/** Who publishes shift occurrences: the site, unless a bot has taken over (settings.nostr.coordinatorNpub). */
export function coordinatorPubkey(): string | null {
  if (NOSTR.coordinatorNpub) return nip19.decode(NOSTR.coordinatorNpub).data as string
  return siteIdentity()?.pubkey ?? null
}

let pool: SimplePool | null = null
const getPool = () => (pool ??= new SimplePool())

export interface PublishResult {
  event: NostrEvent
  accepted: string[]
  rejected: Array<{ relay: string; reason: string }>
}

/** Publish an already-signed event; resolves once every relay answered. */
export async function publishSigned(event: NostrEvent): Promise<PublishResult> {
  const results = await Promise.allSettled(getPool().publish(RELAYS, event))
  const accepted: string[] = []
  const rejected: PublishResult["rejected"] = []
  results.forEach((r, i) => (r.status === "fulfilled" ? accepted.push(RELAYS[i]) : rejected.push({ relay: RELAYS[i], reason: String(r.reason).slice(0, 200) })))
  if (accepted.length === 0) throw new Error(`No relay accepted the event: ${rejected.map((r) => `${r.relay}: ${r.reason}`).join("; ")}`)
  return { event, accepted, rejected }
}

/** Sign with the site key and publish. */
export async function publishAsSite(template: Template): Promise<PublishResult> {
  const identity = siteIdentity()
  if (!identity) throw new Error("No Nostr identity: AUTH_SECRET is not set")
  return publishSigned(finalizeEvent(template, identity.secretKey))
}

/** Query every relay, merged and deduplicated by id; a slow relay does not block the page. */
export async function queryRelays(filter: Parameters<SimplePool["querySync"]>[1], timeoutMs = 2500): Promise<NostrEvent[]> {
  try {
    const events = await getPool().querySync(RELAYS, filter, { maxWait: timeoutMs })
    const seen = new Set<string>()
    return events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
  } catch (error) {
    console.error("[nostr] query failed:", error)
    return []
  }
}

/** True once at least one relay has the event. */
export async function eventExists(id: string): Promise<boolean> {
  return (await queryRelays({ ids: [id] }, 3000)).length > 0
}

// ── addressable things the site maintains ──────────────────────────────────

const ensured = new Set<string>()

/** Publish the community definition once per process (it is addressable, so repeats are harmless). */
export async function ensureCommunityDefinition(): Promise<void> {
  const identity = siteIdentity()
  if (!identity || ensured.has("community")) return
  const existing = await queryRelays({ kinds: [KIND_COMMUNITY], authors: [identity.pubkey], "#d": [communityD(COMMUNITY)] })
  if (existing.length === 0) {
    await publishAsSite(buildCommunityDefinition(COMMUNITY, identity.pubkey, "The Commons Hub Brussels community: a common space to meet, dream and work, Rue de la Madeleine 51."))
  }
  ensured.add("community")
}

/** Publish the shift occurrence for a day and slot if the coordinator (the site) has not yet. */
export async function ensureShiftOccurrence(day: string, slot: ShiftSlot, capacity: number, title: string): Promise<void> {
  const identity = siteIdentity()
  if (!identity || coordinatorPubkey() !== identity.pubkey) return
  const d = shiftD(COMMUNITY, day, slot)
  if (ensured.has(d)) return
  const existing = await queryRelays({ kinds: [KIND_SHIFT], authors: [identity.pubkey], "#d": [d] })
  if (existing.length === 0) await publishAsSite(buildShiftOccurrence(COMMUNITY, identity.pubkey, day, slot, capacity, title))
  ensured.add(d)
}

/**
 * Record that `pubkey` belongs to this Discord member. The previous
 * attestation's keys are kept (a member may have several devices, each
 * with its own key), so the published list is always complete.
 */
export async function attestMember(user: DiscordIdentity, pubkey: string, roles: MemberRole[] = []): Promise<{ keys: string[]; changed: boolean }> {
  const identity = siteIdentity()
  if (!identity) throw new Error("No Nostr identity")
  const previous = await queryRelays({ kinds: [KIND_ATTESTATION], authors: [identity.pubkey], "#d": [`discord:${user.id}`] })
  const known = parseAttestations(previous, [identity.pubkey]).find((l) => l.discordId === user.id)
  const keys = [...new Set([...(known?.keys ?? []), pubkey])]
  const sameRoles = known ? known.roles.length === roles.length && roles.every((r) => known.roles.includes(r)) : roles.length === 0
  const changed = !known || !known.keys.includes(pubkey) || known.name !== user.name || !sameRoles
  if (changed) await publishAsSite(buildAttestation(user, keys, COMMUNITY, identity.pubkey, new Date(), roles))
  return { keys, changed }
}

/** The member's kind 0 as the relays have it, if any. */
export async function memberProfile(pubkey: string): Promise<NostrEvent | null> {
  const events = await queryRelays({ kinds: [KIND_PROFILE], authors: [pubkey] })
  return latestAddressable(events)[0] ?? null
}
