/**
 * The Discord bot's shift API (opencollective/token-bot), server side only.
 *
 * Shifts are recorded by the bot, the same way its /shifts command does it:
 * a Google Calendar event with an audit line per sign-up (what tokens are
 * later claimed from), the #shifts log, the relays, a DM and an email. The
 * community tablet (/tablet) goes through these endpoints so a sign-up made
 * on the tablet is exactly a /shifts sign-up.
 *
 * Configured with TOKEN_BOT_API_URL and TOKEN_BOT_API_KEY (set on the
 * server); without them the tablet shows the events and says sign-ups are
 * not available.
 */

import settings from "@/settings/settings.json"

export const GUILD_ID = settings.discord.guildId

export interface BotMember {
  id: string
  username: string
  displayName: string
  avatar?: string | null
}

export interface BotShift {
  id: string
  /** ISO. */
  start: string
  end: string
  summary?: string
  signups: Array<{ discordUserId: string; username: string; displayName: string; avatar?: string | null }>
}

export interface BotShifts {
  shifts: BotShift[]
  maxSignupsPerSlot: number
  rewardAmountPerHour: number
  rewardTokenSymbol: string
}

export function isTokenBotConfigured(): boolean {
  return !!process.env.TOKEN_BOT_API_URL && !!process.env.TOKEN_BOT_API_KEY
}

export class TokenBotError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<T> {
  const base = process.env.TOKEN_BOT_API_URL
  const key = process.env.TOKEN_BOT_API_KEY
  if (!base || !key) throw new TokenBotError("Shift sign-ups are not available right now", 503)
  const res = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new TokenBotError(body?.error || `The bot answered ${res.status}`, res.status)
  return body
}

export function listShifts(from: Date, to: Date): Promise<BotShifts> {
  const q = new URLSearchParams({ guildId: GUILD_ID, from: from.toISOString(), to: to.toISOString() })
  return call<BotShifts>(`/api/shifts?${q}`)
}

export async function searchMembers(query: string, limit = 12): Promise<BotMember[]> {
  const q = new URLSearchParams({ guildId: GUILD_ID, q: query, limit: String(limit) })
  const res = await call<BotMember[] | { members: BotMember[] }>(`/api/members?${q}`)
  return Array.isArray(res) ? res : (res.members ?? [])
}

export interface SignupResult {
  ok: boolean
  shift: BotShift
  cancelUrl?: string
  emailed?: boolean
}

export function signUpForShift(input: { discordUserId: string; start: Date; end: Date; eventTitle?: string }): Promise<SignupResult> {
  return call<SignupResult>(
    "/api/shifts/signup",
    {
      method: "POST",
      body: JSON.stringify({ guildId: GUILD_ID, discordUserId: input.discordUserId, start: input.start.toISOString(), end: input.end.toISOString(), eventTitle: input.eventTitle, source: "tablet" }),
    },
    20_000,
  )
}

export interface CancelResult {
  ok: boolean
  alreadyCancelled?: boolean
  shift?: { start: string; end: string; summary?: string }
  member?: { displayName: string }
}

export function cancelShift(token: string): Promise<CancelResult> {
  return call<CancelResult>("/api/shifts/cancel", { method: "POST", body: JSON.stringify({ token }) }, 20_000)
}
