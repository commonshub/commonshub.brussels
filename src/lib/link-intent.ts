/**
 * "Link your Discord account", for someone signed in with an email code: the site remembers, in a
 * short-lived signed cookie (HttpOnly, 10 minutes), who asked; they then sign in with Discord as
 * usual, and the sign-in (auth.ts) links that Discord account to their email (the bot and their
 * Odoo contact). Only the email session that asked can set it, and only that browser carries it.
 */

import { createHmac, timingSafeEqual } from "crypto"

export const LINK_COOKIE = "chb-link-discord"
const TTL_MS = 10 * 60_000

export type LinkIntent = { partnerId: number; email: string; name: string; exp: number }

const secret = () => (process.env.AUTH_SECRET ? `link-discord:${process.env.AUTH_SECRET}` : null)
const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url")

export function signLinkIntent(i: Omit<LinkIntent, "exp">, now = Date.now()): string | null {
  const key = secret()
  if (!key) return null
  const payload = Buffer.from(JSON.stringify({ ...i, exp: now + TTL_MS })).toString("base64url")
  return `${payload}.${sign(payload, key)}`
}

export function readLinkIntent(value: string | undefined, now = Date.now()): LinkIntent | null {
  const key = secret()
  if (!key || !value) return null
  const [payload, mac] = value.split(".")
  if (!payload || !mac) return null
  const want = Buffer.from(sign(payload, key))
  const got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const i = JSON.parse(Buffer.from(payload, "base64url").toString()) as LinkIntent
    return Number.isInteger(i.partnerId) && typeof i.email === "string" && i.exp > now ? i : null
  } catch {
    return null
  }
}

/** The intent this browser carries, removed as it's read (one use). */
export async function takeLinkIntent(): Promise<LinkIntent | null> {
  try {
    const { cookies } = await import("next/headers")
    const jar = await cookies()
    const intent = readLinkIntent(jar.get(LINK_COOKIE)?.value)
    if (jar.get(LINK_COOKIE)) {
      try {
        jar.delete(LINK_COOKIE)
      } catch {
        // Not writable here: it expires on its own.
      }
    }
    return intent
  } catch {
    return null
  }
}
