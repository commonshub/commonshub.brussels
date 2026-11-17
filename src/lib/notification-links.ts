/**
 * The "Notification settings" link in the recap emails carries a token, so
 * it works without logging in (settings: lib/notification-settings.ts):
 *   t = base64url(JSON {d: discordId, x: expiry}) + "." + base64url(HMAC-SHA256(key, "notifications:" + payload))
 * with key = RENEW_LINK_SECRET (shared with chb, which sends the emails) or,
 * for links the site makes itself, AUTH_SECRET.
 */

import { createHmac, timingSafeEqual } from "crypto"

export interface SettingsClaim {
  /** Discord id, or "e:<emailHash>" for a member chb doesn't know on Discord (settings kept under that key). */
  d: string
  /** Valid until (unix seconds). */
  x: number
}

function keys(): string[] {
  const out: string[] = []
  if (process.env.RENEW_LINK_SECRET) out.push(process.env.RENEW_LINK_SECRET)
  if (process.env.AUTH_SECRET) out.push(`notifications-site:${process.env.AUTH_SECRET}`)
  return out
}

const hmac = (key: string, payload: string) => createHmac("sha256", key).update(`notifications:${payload}`).digest("base64url")

/** Links in an email stay valid a year. */
export const LINK_VALIDITY_S = 366 * 86_400

export function signSettingsLink(discordId: string, now = Date.now(), key = keys()[0]): string {
  if (!key) throw new Error("Neither RENEW_LINK_SECRET nor AUTH_SECRET is set")
  const payload = Buffer.from(JSON.stringify({ d: discordId, x: Math.floor(now / 1000) + LINK_VALIDITY_S })).toString("base64url")
  return `${payload}.${hmac(key, payload)}`
}

export function verifySettingsLink(token: string, now = Date.now(), candidates = keys()): SettingsClaim | null {
  const [payload, sig] = (token ?? "").split(".")
  if (!payload || !sig || candidates.length === 0) return null
  const given = Buffer.from(sig)
  const ok = candidates.some((key) => {
    const expected = Buffer.from(hmac(key, payload))
    return expected.length === given.length && timingSafeEqual(expected, given)
  })
  if (!ok) return null
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SettingsClaim
    return /^(\d{5,25}|e:[0-9a-f]{64})$/.test(claim.d) && claim.x * 1000 > now ? claim : null
  } catch {
    return null
  }
}

/** /notifications, with the token when there is one. */
export const settingsUrl = (origin: string, token?: string) => `${origin}/notifications${token ? `?t=${encodeURIComponent(token)}` : ""}`

// ── "Link my Discord account" (recap emails to members chb doesn't know on Discord) ──
//
// The link carries the membership id (emailHash), signed like the settings links but for another
// purpose. Opening it and signing in with Discord records that this Discord account goes with
// that membership (lib/discord-links.ts, source "email": the link was emailed to that address).

const linkHmac = (key: string, payload: string) => createHmac("sha256", key).update(`link-discord:${payload}`).digest("base64url")

export function signDiscordLinkToken(emailHash: string, now = Date.now(), key = keys()[0]): string {
  if (!key) throw new Error("Neither RENEW_LINK_SECRET nor AUTH_SECRET is set")
  const payload = Buffer.from(JSON.stringify({ h: emailHash, x: Math.floor(now / 1000) + LINK_VALIDITY_S })).toString("base64url")
  return `${payload}.${linkHmac(key, payload)}`
}

/** The emailHash of a valid link token, or null. */
export function verifyDiscordLinkToken(token: string, now = Date.now(), candidates = keys()): string | null {
  const [payload, sig] = (token ?? "").split(".")
  if (!payload || !sig || candidates.length === 0) return null
  const given = Buffer.from(sig)
  const ok = candidates.some((key) => {
    const expected = Buffer.from(linkHmac(key, payload))
    return expected.length === given.length && timingSafeEqual(expected, given)
  })
  if (!ok) return null
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { h: string; x: number }
    return /^[0-9a-f]{64}$/.test(claim.h) && claim.x * 1000 > now ? claim.h : null
  } catch {
    return null
  }
}

export const linkDiscordUrl = (origin: string, token: string) => `${origin}/link-discord?t=${encodeURIComponent(token)}`
