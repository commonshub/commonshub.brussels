/**
 * Caretaking shifts, recorded by the website the same way the Discord bot's
 * /shifts command records them, so either can be used and tokens are
 * claimed the same way afterwards:
 *
 *   - the shifts Google Calendar: one event per time window, an audit line
 *     per sign-up/cancellation ("<time>: Name <@username> signed up
 *     (discord:<id>)") — the bot's claim flow reads exactly that (people
 *     signed up by email are written "Name (email:address)", which the bot
 *     does not read, so it never tries to reward them);
 *   - the community relays: an RSVP (kind 31925) on the member's behalf,
 *     signed by the site (only for Discord members: an email is never
 *     published);
 *   - #shifts on Discord, a DM to the person with a link to cancel (anyone
 *     at the community tablet can pick any name), and the confirmation
 *     email with the .ics when we have an address.
 *
 * Someone without Discord can sign up with an email address: they get the
 * email (and the calendar invite), but no tokens (tokens go to Discord
 * members' wallets).
 */

import { createHmac, timingSafeEqual } from "crypto"

import settings from "@/settings/settings.json"

import { buildDoorLink } from "./door-link"
import { isDiscordConfigured, sendDirectMessage, sendMessage } from "./discord"
import { getEvent, insertEvent, isCalendarConfigured, listEvents, patchEvent, type GCalEvent } from "./google-calendar"
import { buildRsvp, type DiscordIdentity, type ShiftSlot } from "./nostr-conventions"
import { COMMUNITY, coordinatorPubkey, publishAsSite, siteIdentity } from "./nostr-server"
import { buildShiftCancelledDm, buildShiftDm, sendShiftConfirmation, type ShiftConfirmation } from "./shift-email"

const SHIFTS = settings.shifts as { calendarId: string; maxSignupsPerSlot: number; rewardAmountPerHour: number; timezone: string; slots: ShiftSlot[] }
export const SHIFTS_CALENDAR = SHIFTS.calendarId
export const MAX_PER_SHIFT = SHIFTS.maxSignupsPerSlot ?? 3
export const REWARD_PER_HOUR = SHIFTS.rewardAmountPerHour ?? 1
const TZ = SHIFTS.timezone || "Europe/Brussels"
const SHIFTS_CHANNEL = settings.discord.channels.activities.shifts
const LOCATION = "Commons Hub Brussels, Rue de la Madeleine 51, 1000 Brussels"
const SITE = "https://commonshub.brussels"

export function isShiftsConfigured(): boolean {
  return isCalendarConfigured() && !!SHIFTS_CALENDAR
}

/** Who is signing up: a Discord member, or someone giving just an email address. */
export type Person = { kind: "discord"; id: string; username: string; displayName: string; avatar?: string | null } | { kind: "email"; email: string; displayName: string }

export interface ShiftSignup {
  discordUserId: string
  username: string
  displayName: string
}

export interface Shift {
  id: string
  start: string
  end: string
  summary?: string
  signups: ShiftSignup[]
}

// ── the calendar's audit lines (same format as the bot) ─────────────────────

/** "06/10/2026 14:05", Brussels time, as the bot writes it. */
export function auditTimestamp(now = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).formatToParts(now).map((x) => [x.type, x.value]),
  )
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** The person's key in the audit lines: their Discord username, or `email:<address>`. */
const handle = (p: Person) => (p.kind === "discord" ? p.username : `email:${p.email}`)

/**
 * How a person is written in an audit line. A Discord member is
 * `Name <@username>`, exactly as /shifts writes it. Someone signed up by
 * email is `Name (email:address)`, deliberately NOT in `<@…>` form: the
 * bot's parser must not see them at all, or its reward flow would mint
 * tokens for an empty Discord id.
 */
const who = (displayName: string, h: string) => `${displayName.replace(/[<>()\n]/g, "")} ${h.startsWith("email:") ? `(${h})` : `<@${h}>`}`

export function signupLine(p: Person, eventTitle: string | undefined, now = new Date()): string {
  const id = p.kind === "discord" ? ` (discord:${p.id})` : ""
  return `${auditTimestamp(now)}: ${who(p.displayName, handle(p))} signed up${id} via the community tablet${eventTitle ? ` to steward ${eventTitle.replace(/\n/g, " ")}` : ""}`
}

export const cancelLine = (p: { displayName: string; handle: string }, now = new Date()) => `${auditTimestamp(now)}: ${who(p.displayName, p.handle)} cancelled`

/** The sign-ups still standing in an event's description: signed up, not cancelled since. Mirrors the bot's parseShiftSignups. */
export function parseSignups(description: string | undefined): ShiftSignup[] {
  const active = new Map<string, ShiftSignup>()
  for (const line of (description ?? "").split("\n")) {
    const signup = line.match(/^(?:[^:]*\d{2}:\d{2}: )?(.*?)\s*<@(\S+?)> signed up(?: \(discord:(\d+)\))?/)
    if (signup) {
      active.set(signup[2], { discordUserId: signup[3] || "", username: signup[2], displayName: signup[1] || signup[2] })
      continue
    }
    const byEmail = line.match(/^(?:[^:]*\d{2}:\d{2}: )?(.*?)\s*\((email:[^)\s]+)\) signed up/)
    if (byEmail) {
      active.set(byEmail[2], { discordUserId: "", username: byEmail[2], displayName: byEmail[1] || byEmail[2].slice(6) })
      continue
    }
    const cancel = line.match(/<@(\S+?)> cancelled/) || line.match(/\((email:[^)\s]+)\) cancelled/)
    if (cancel) active.delete(cancel[1])
  }
  return [...active.values()]
}

const appendLine = (description: string | undefined, line: string) => `${(description ?? "").trimEnd()}${description?.trim() ? "\n" : ""}${line}`
const isCancelledEvent = (e: GCalEvent) => (e.summary ?? "").startsWith("[Cancelled]")
const hm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ })

export async function listShifts(from: Date, to: Date): Promise<Shift[]> {
  const events = await listEvents(SHIFTS_CALENDAR, from, to)
  return events
    .filter((e) => e.id && e.start?.dateTime && e.end?.dateTime && !isCancelledEvent(e))
    .map((e) => ({ id: e.id!, start: e.start.dateTime, end: e.end.dateTime, summary: e.summary, signups: parseSignups(e.description) }))
    .filter((s) => s.signups.length > 0)
}

// ── cancel links ────────────────────────────────────────────────────────────

function cancelKey(): string {
  const key = process.env.SHIFT_CANCEL_SECRET || process.env.AUTH_SECRET
  if (!key) throw new Error("No secret to sign cancel links (AUTH_SECRET)")
  return key
}

export interface CancelClaim {
  /** Calendar event id. */
  e: string
  /** The person's handle in the audit lines (username, or email:address). */
  h: string
  /** Discord id, for the DM. */
  u?: string
  /** Valid until (unix seconds): the end of the shift. */
  x: number
}

export function signCancel(claim: CancelClaim, key = cancelKey()): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url")
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`
}

export function verifyCancel(token: string, now = Date.now(), key = cancelKey()): CancelClaim | "invalid" | "expired" {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return "invalid"
  const expected = Buffer.from(createHmac("sha256", key).update(payload).digest("base64url"))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid"
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CancelClaim
    if (!claim.e || !claim.h || !claim.x) return "invalid"
    return claim.x * 1000 < now ? "expired" : claim
  } catch {
    return "invalid"
  }
}

// ── sign up / cancel ────────────────────────────────────────────────────────

export class ShiftError extends Error {
  constructor(
    message: string,
    readonly code: "full" | "already_signed_up" | "not_configured" | "invalid" | "expired" | "not_found",
    readonly status: number,
  ) {
    super(message)
  }
}

/** The relays: an RSVP on a Discord member's behalf. Never throws (the calendar is the record tokens are claimed from). */
async function publishRsvp(action: "signup" | "cancel", p: Extract<Person, { kind: "discord" }>, start: Date, end: Date): Promise<void> {
  const site = siteIdentity()
  if (!site) return
  try {
    const slot: ShiftSlot = { start: hm(start), end: hm(end) }
    const standard = SHIFTS.slots.some((s) => s.start === slot.start && s.end === slot.end)
    const coordinator = standard ? coordinatorPubkey() : site.pubkey
    if (!coordinator) return
    await publishAsSite(buildRsvp(action, COMMUNITY, coordinator, site.pubkey, day(start), standard ? slot : { ...slot, custom: true }, new Date(), { id: p.id, name: p.displayName, username: p.username } satisfies DiscordIdentity))
  } catch (error) {
    console.error("[shifts] could not publish the RSVP:", error)
  }
}

export interface SignupResult {
  shift: Shift
  cancelUrl: string
  dmSent: boolean
  emailed: boolean
}

export async function signUp(person: Person, start: Date, end: Date, eventTitle?: string): Promise<SignupResult> {
  if (!isShiftsConfigured()) throw new ShiftError("Shift sign-ups are not available right now", "not_configured", 503)
  const sameWindow = (e: GCalEvent) => Math.abs(Date.parse(e.start.dateTime) - start.getTime()) < 60_000 && Math.abs(Date.parse(e.end.dateTime) - end.getTime()) < 60_000
  const existing = (await listEvents(SHIFTS_CALENDAR, new Date(start.getTime() - 60_000), new Date(end.getTime() + 60_000))).find((e) => e.start?.dateTime && e.end?.dateTime && sameWindow(e))
  const signups = parseSignups(existing?.description)
  const shiftOf = (e: GCalEvent): Shift => ({ id: e.id!, start: e.start.dateTime, end: e.end.dateTime, summary: e.summary, signups: parseSignups(e.description) })
  if (existing && signups.some((s) => s.username === handle(person))) throw new ShiftError(`${person.displayName} is already on this shift`, "already_signed_up", 409)
  if (existing && !isCancelledEvent(existing) && signups.length >= MAX_PER_SHIFT) throw new ShiftError("This shift is full", "full", 409)

  const line = signupLine(person, eventTitle)
  const attendee = person.kind === "email" ? [{ email: person.email }] : []
  let event: GCalEvent
  if (existing?.id) {
    event = await patchEvent(SHIFTS_CALENDAR, existing.id, {
      description: appendLine(existing.description, line),
      ...(isCancelledEvent(existing) ? { summary: (existing.summary ?? "").replace(/^\[Cancelled\]\s*/, "") } : {}),
      ...(attendee.length ? { attendees: [...(existing.attendees ?? []), ...attendee] } : {}),
    })
  } else {
    event = await insertEvent(SHIFTS_CALENDAR, {
      summary: `Shift: ${hm(start)}-${hm(end)}`,
      description: line,
      location: LOCATION,
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
      ...(attendee.length ? { attendees: attendee } : {}),
    })
  }

  const cancelUrl = `${SITE}/shifts/cancel?t=${encodeURIComponent(signCancel({ e: event.id!, h: handle(person), ...(person.kind === "discord" ? { u: person.id } : {}), x: Math.floor(end.getTime() / 1000) }))}`
  const hours = (end.getTime() - start.getTime()) / 3_600_000
  const confirmation: ShiftConfirmation = {
    memberName: person.displayName,
    email: person.kind === "email" ? person.email : undefined,
    start,
    end,
    timezone: TZ,
    eventTitle,
    reward: { amount: Math.round(hours * REWARD_PER_HOUR * 100) / 100, symbol: "CHT" },
    doorLink: await buildDoorLink({ name: person.displayName, host: "Commons Hub", reason: `Caretaking shift ${hm(start)}-${hm(end)}${eventTitle ? ` (${eventTitle})` : ""}`, start: new Date(start.getTime() - 30 * 60_000), end: new Date(end.getTime() + 30 * 60_000) }).catch(() => null),
    cancelUrl,
    calendarEventId: event.id,
    via: "tablet",
  }

  let dmSent = false
  if (person.kind === "discord") {
    await publishRsvp("signup", person, start, end)
    if (isDiscordConfigured()) {
      dmSent = await sendDirectMessage(person.id, buildShiftDm(confirmation)).catch(() => false)
      sendMessage(SHIFTS_CHANNEL, `📋 <@${person.id}> signed up via the community tablet for a shift on **${day(start)}** ${hm(start)}-${hm(end)}${eventTitle ? ` to steward **${eventTitle}**` : ""}`).catch(() => {})
    }
  } else if (isDiscordConfigured()) {
    sendMessage(SHIFTS_CHANNEL, `📋 ${person.displayName} (by email) signed up via the community tablet for a shift on **${day(start)}** ${hm(start)}-${hm(end)}${eventTitle ? ` to steward **${eventTitle}**` : ""}`).catch(() => {})
  }
  let emailed = false
  if (confirmation.email) {
    emailed = await sendShiftConfirmation(confirmation)
      .then(() => true)
      .catch((error) => (console.error("[shifts] could not send the confirmation:", error), false))
  }
  return { shift: shiftOf(event), cancelUrl, dmSent, emailed }
}

export async function cancel(token: string): Promise<{ alreadyCancelled: boolean; shift: { start: string; end: string; summary?: string }; displayName: string }> {
  if (!isShiftsConfigured()) throw new ShiftError("Cancelling is not available right now", "not_configured", 503)
  const claim = verifyCancel(token)
  if (claim === "invalid") throw new ShiftError("This cancel link is not valid", "invalid", 400)
  if (claim === "expired") throw new ShiftError("This shift is already over", "expired", 410)
  const event = await getEvent(SHIFTS_CALENDAR, claim.e).catch(() => null)
  if (!event?.id) throw new ShiftError("This shift does not exist anymore", "not_found", 404)
  const shift = { start: event.start.dateTime, end: event.end.dateTime, summary: event.summary }
  const signups = parseSignups(event.description)
  const mine = signups.find((s) => s.username === claim.h)
  if (!mine) return { alreadyCancelled: true, shift, displayName: claim.h.replace(/^email:/, "") }

  const left = signups.filter((s) => s.username !== claim.h)
  await patchEvent(SHIFTS_CALENDAR, event.id, {
    description: appendLine(event.description, cancelLine({ displayName: mine.displayName, handle: claim.h })),
    ...(left.length === 0 ? { summary: `[Cancelled] ${event.summary ?? "Shift"}` } : {}),
  })
  const start = new Date(shift.start)
  const end = new Date(shift.end)
  if (claim.u && mine.discordUserId) {
    await publishRsvp("cancel", { kind: "discord", id: claim.u, username: claim.h, displayName: mine.displayName }, start, end)
    if (isDiscordConfigured()) {
      sendDirectMessage(claim.u, buildShiftCancelledDm(start, end, TZ)).catch(() => {})
      sendMessage(SHIFTS_CHANNEL, `❌ <@${claim.u}> cancelled their shift on **${day(start)}** ${hm(start)}-${hm(end)}`).catch(() => {})
    }
  }
  return { alreadyCancelled: false, shift, displayName: mine.displayName }
}

