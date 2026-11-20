/**
 * The website's calls to the Discord bot (commonshub/chb-backend), which
 * holds the hub's token payments, room calendars and guest emails: a member
 * books a room, buys coworking or a guest pass from the dashboard, and the
 * bot does exactly what its /book, /buy and /guestpass commands do.
 *
 * Server only. The website has checked the Discord session and the member
 * role; it tells the bot who the member is (their Discord id), with a shared
 * secret (TOKEN_BOT_API_TOKEN) the bot checks. The bot checks membership and
 * the wallet again before charging anything.
 */

import settings from "@/settings/settings.json"

export const isTokenBotConfigured = () => !!process.env.TOKEN_BOT_URL && !!process.env.TOKEN_BOT_API_TOKEN

export type BotAnswer = { ok: true; [k: string]: unknown } | { ok: false; error: string }

/** POST to one of the bot's /api/website/* endpoints, on behalf of a member. */
export type BotEndpoint = "options" | "availability" | "cowork" | "guestpass" | "book" | "orgs" | "org" | "vat" | "paybook" | "paycowork" | "mine" | "paid" | "cancelbooking" | "account" | "subscribecowork" | "history" | "unpaid" | "switchyearly"

/** Who the bot acts for: a member's Discord id, or a test user (signed in with an email code). */
/** A member's Discord id; a test user; or someone known to Odoo by email (read-only: orgs, mine). */
export type BotIdentity = string | { testUser: { email: string; partnerId: number; name: string } } | { emailUser: { email: string } }

/**
 * Who the bot acts for, from the session: a test user (signed in with an email code, testMode), a
 * member's Discord id, or someone signed in with an email code (an Odoo contact: euros only).
 * null for anyone else. Membership itself is checked by the caller (isMember) for Discord ids.
 */
export function botIdentity(user: { testMode?: boolean; email?: string | null; odooPartnerId?: number; username?: string; name?: string | null; discordId?: string } | undefined): BotIdentity | null {
  if (!user) return null
  if (user.testMode && user.email && user.odooPartnerId) return { testUser: { email: user.email, partnerId: user.odooPartnerId, name: user.username || user.name || "Test user" } }
  if (user.discordId) return user.discordId
  if (user.odooPartnerId && user.email) return { emailUser: { email: user.email } }
  return null
}

export const isTestIdentity = (who: BotIdentity | null): boolean => !!who && typeof who !== "string" && "testUser" in who

export async function callTokenBot(endpoint: BotEndpoint, who: BotIdentity, body: Record<string, unknown> = {}): Promise<{ status: number; body: BotAnswer }> {
  const base = process.env.TOKEN_BOT_URL
  const token = process.env.TOKEN_BOT_API_TOKEN
  if (!base || !token) return { status: 503, body: { ok: false, error: "Booking from the website isn't available right now: please use Discord." } }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/website/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, guildId: settings.discord.guildId, ...(typeof who === "string" ? { userId: who } : who) }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    })
    const answer = (await res.json().catch(() => null)) as BotAnswer | null
    if (!answer || typeof answer.ok !== "boolean") return { status: 502, body: { ok: false, error: "The bot didn't answer properly, please try again." } }
    return { status: res.status, body: answer }
  } catch (error) {
    console.error(`[token-bot] ${endpoint} failed:`, error)
    return { status: 502, body: { ok: false, error: "We couldn't reach the bot, please try again." } }
  }
}

/**
 * Signing in with an email address (the bot checks it is an Odoo partner's and emails a 6-digit
 * code): /api/website/login/{code,verify}. Not on behalf of a member, so no user id.
 */
export async function callBotLogin(step: "code" | "verify", body: { email: string; code?: string }): Promise<{ status: number; body: BotAnswer }> {
  const base = process.env.TOKEN_BOT_URL
  const token = process.env.TOKEN_BOT_API_TOKEN
  if (!base || !token) return { status: 503, body: { ok: false, error: "Signing in with an email address isn't available right now: use Discord." } }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/website/login/${step}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const answer = (await res.json().catch(() => null)) as BotAnswer | null
    if (!answer || typeof answer.ok !== "boolean") return { status: 502, body: { ok: false, error: "Something went wrong, please try again." } }
    return { status: res.status, body: answer }
  } catch (error) {
    console.error(`[token-bot] login/${step} failed:`, error)
    return { status: 502, body: { ok: false, error: "We couldn't reach our server, please try again." } }
  }
}

/** What the browser may pass on to each endpoint (anything else is dropped). */
export const ALLOWED_FIELDS: Record<string, string[]> = {
  options: [],
  availability: ["room", "start", "end", "org"],
  cowork: ["requestId", "item"],
  guestpass: ["requestId", "length", "start", "guestName", "guestEmail"],
  book: ["requestId", "room", "start", "end", "title", "guestName", "guestEmail"],
  // Paying in euros: who to invoice (the bot keeps a member's organisations in Odoo), then the invoice.
  orgs: [],
  org: ["id", "name", "vat", "email", "street", "zip", "city", "country", "billing", "billingstreet", "billingzip", "billingcity", "billingcountry", "lang"],
  vat: ["vat"],
  paybook: ["requestId", "room", "start", "end", "title", "guestName", "guestEmail", "org"],
  paycowork: ["requestId", "item", "org"],
  subscribecowork: ["org", "pay", "period"],
  unpaid: [],
  switchyearly: [],
  // The dashboard's bookings: cancel one (refund by the terms), or pay what is left on its invoice by card.
  cancelbooking: ["invoiceId", "eventId"],
  payinvoice: ["invoiceId"],
}

export function pickFields(endpoint: string, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED_FIELDS[endpoint] ?? []) {
    const v = body[k]
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200)
  }
  return out
}

/**
 * The website proved a Discord account and an email address are the same person's: the bot saves
 * the email for that Discord user and sets the Discord account on their Odoo contact.
 */
export async function linkAccounts(p: { discordId: string; username: string; displayName?: string | null; email: string }): Promise<boolean> {
  const base = process.env.TOKEN_BOT_URL
  const token = process.env.TOKEN_BOT_API_TOKEN
  if (!base || !token) return false
  const res = await fetch(`${base.replace(/\/$/, "")}/api/website/link`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ guildId: settings.discord.guildId, discordId: p.discordId, username: p.username, ...(p.displayName ? { displayName: p.displayName } : {}), email: p.email }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null)
  return !!res?.ok
}
