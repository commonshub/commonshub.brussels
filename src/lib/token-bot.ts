/**
 * The website's calls to the Discord bot (opencollective/token-bot), which
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
export async function callTokenBot(endpoint: "options" | "availability" | "cowork" | "guestpass" | "book", userId: string, body: Record<string, unknown> = {}): Promise<{ status: number; body: BotAnswer }> {
  const base = process.env.TOKEN_BOT_URL
  const token = process.env.TOKEN_BOT_API_TOKEN
  if (!base || !token) return { status: 503, body: { ok: false, error: "Booking from the website isn't available right now: please use Discord." } }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/website/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, guildId: settings.discord.guildId, userId }),
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

/** What the browser may pass on to each endpoint (anything else is dropped). */
export const ALLOWED_FIELDS: Record<string, string[]> = {
  options: [],
  availability: ["room", "start", "end"],
  cowork: ["requestId"],
  guestpass: ["requestId", "length", "start", "guestName", "guestEmail"],
  book: ["requestId", "room", "start", "end", "title", "guestName", "guestEmail"],
}

export function pickFields(endpoint: string, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED_FIELDS[endpoint] ?? []) {
    const v = body[k]
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200)
  }
  return out
}
