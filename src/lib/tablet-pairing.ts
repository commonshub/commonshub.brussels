import { randomBytes, randomInt } from "crypto"

/**
 * Pairing the hub's tablet from a steward's phone, so nobody ever signs in
 * on the tablet itself (a session left there would let anyone use the site
 * as that steward). The tablet asks for a pairing: an unguessable id (in the
 * QR code it shows) and a 6-digit code (to type on the phone instead). A
 * signed-in steward approves it on their phone; the tablet, polling with
 * the id, then receives the trust cookie (lib/tablet-trust).
 *
 * Pairings live ten minutes, in this process's memory: one container, and a
 * pairing lost to a redeploy is simply asked again.
 */

export const PAIRING_TTL_MS = 10 * 60 * 1000
const MAX_PENDING = 50

export interface Pairing {
  id: string
  code: string
  expiresAt: number
  approvedBy?: string
}

const store: Map<string, Pairing> = ((globalThis as { __tabletPairings?: Map<string, Pairing> }).__tabletPairings ??= new Map())

function prune(now: number) {
  for (const [id, p] of store) if (p.expiresAt <= now) store.delete(id)
}

/** A new pairing, or null when too many are pending (someone hammering the endpoint). */
export function createPairing(now = Date.now()): Pairing | null {
  prune(now)
  if (store.size >= MAX_PENDING) return null
  const codes = new Set([...store.values()].map((p) => p.code))
  let code: string
  do code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  while (codes.has(code))
  const pairing = { id: randomBytes(18).toString("base64url"), code, expiresAt: now + PAIRING_TTL_MS }
  store.set(pairing.id, pairing)
  return pairing
}

/** A pending pairing by its id (from the QR code) or its 6-digit code. */
export function findPairing(ref: { id?: string | null; code?: string | null }, now = Date.now()): Pairing | null {
  prune(now)
  if (ref.id) return store.get(ref.id) ?? null
  const code = ref.code?.replace(/\D/g, "")
  if (code?.length === 6) return [...store.values()].find((p) => p.code === code) ?? null
  return null
}

export function approvePairing(pairing: Pairing, stewardId: string) {
  pairing.approvedBy = stewardId
}

/** The tablet collects its approval once: the pairing is then gone. */
export function collectPairing(id: string, now = Date.now()): { status: "approved"; stewardId: string } | { status: "pending" } | { status: "expired" } {
  const pairing = findPairing({ id }, now)
  if (!pairing) return { status: "expired" }
  if (!pairing.approvedBy) return { status: "pending" }
  store.delete(id)
  return { status: "approved", stewardId: pairing.approvedBy }
}
