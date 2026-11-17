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
export type BotEndpoint = "options" | "availability" | "cowork" | "guestpass" | "book" | "orgs" | "org" | "vat" | "paybook" | "paycowork"

/** Who the bot acts for: a member's Discord id, or a test user (signed in with an email code). */
export type BotIdentity = string | { testUser: { email: string; partnerId: number; name: string } }

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
  availability: ["room", "start", "end"],
  cowork: ["requestId", "item"],
  guestpass: ["requestId", "length", "start", "guestName", "guestEmail"],
  book: ["requestId", "room", "start", "end", "title", "guestName", "guestEmail"],
  // Paying in euros: who to invoice (the bot keeps a member's organisations in Odoo), then the invoice.
  orgs: [],
  org: ["id", "name", "vat", "email", "street", "zip", "city", "country", "billing", "billingstreet", "billingzip", "billingcity", "billingcountry"],
  vat: ["vat"],
  paybook: ["requestId", "room", "start", "end", "title", "guestName", "guestEmail", "org"],
  paycowork: ["requestId", "item", "org"],
}

export function pickFields(endpoint: string, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED_FIELDS[endpoint] ?? []) {
    const v = body[k]
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200)
  }
  return out
}
