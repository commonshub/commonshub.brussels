import { NextResponse } from "next/server"

import settings from "@/settings/settings.json"
import { discordGet } from "@/lib/discord"
import { slotWindow } from "@/lib/tablet"
import { loadTabletBookings } from "@/lib/tablet-data"
import { ShiftError, isShiftsConfigured, signUp, type Person } from "@/lib/shifts-service"

export const dynamic = "force-dynamic"

const isEmail = (s: string) => s.length <= 120 && /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(s)

/** A tablet is one device in one place: a dozen sign-ups in ten minutes is plenty. */
const WINDOW_MS = 10 * 60_000
const MAX_PER_WINDOW = 12
const recent: number[] = []

/** The Discord member behind an id picked from the autocomplete (any member of the server, bots excluded). */
async function discordPerson(id: string): Promise<Person | null> {
  const res = await discordGet(`/guilds/${settings.discord.guildId}/members/${id}`).catch(() => null)
  if (!res?.ok) return null
  const m = (await res.json()) as { nick?: string | null; user?: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean } }
  if (!m.user || m.user.bot) return null
  return { kind: "discord", id: m.user.id, username: m.user.username, displayName: (m.nick || m.user.global_name || m.user.username).slice(0, 60) }
}

/**
 * Sign someone up for a shift from the community tablet: a Discord member
 * (picked from the autocomplete) or anyone with an email address, on a day
 * of the coming two weeks, from a half hour, for one to four hours. The
 * times are worked out here (lib/tablet.ts slotWindow), never taken as they
 * are from the browser; the shift is named after what it stewards (the
 * bookings it overlaps). It is recorded like /shifts does (see
 * lib/shifts-service.ts) and the person gets a DM or an email with a link to
 * cancel, in case someone picked the wrong name.
 */
export async function POST(request: Request) {
  if (!isShiftsConfigured()) return NextResponse.json({ error: "Shift sign-ups are not available right now" }, { status: 503 })

  let body: { day?: unknown; start?: unknown; discordUserId?: unknown; email?: unknown; name?: unknown; hours?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const window = typeof body.day === "string" ? slotWindow(body.day, Number(body.start), Number(body.hours)) : null
  if (!window) return NextResponse.json({ error: "Pick a day and a time in the coming two weeks" }, { status: 400 })
  if (window.endMs < Date.now()) return NextResponse.json({ error: "That shift is already over" }, { status: 400 })
  // What the shift stewards: the bookings it overlaps, else the hub itself.
  const during = loadTabletBookings(window.startMs, window.endMs).filter((b) => b.startMs < window.endMs && b.endMs > window.startMs)
  const title = during.length ? during.map((b) => b.title).join(" · ").slice(0, 120) : "Stewarding the hub"

  let person: Person | null = null
  if (typeof body.discordUserId === "string" && /^\d{5,25}$/.test(body.discordUserId)) {
    person = await discordPerson(body.discordUserId)
  } else if (typeof body.email === "string" && isEmail(body.email.trim())) {
    const email = body.email.trim().toLowerCase()
    const name = typeof body.name === "string" ? body.name.replace(/[<>\n]/g, "").trim().slice(0, 60) : ""
    person = { kind: "email", email, displayName: name || email.split("@")[0] }
  }
  if (!person) return NextResponse.json({ error: "Pick yourself in the list, or enter your email address" }, { status: 400 })

  const now = Date.now()
  while (recent.length && recent[0] < now - WINDOW_MS) recent.shift()
  if (recent.length >= MAX_PER_WINDOW) return NextResponse.json({ error: "Too many sign-ups at once, try again in a few minutes" }, { status: 429 })
  recent.push(now)

  try {
    const result = await signUp(person, new Date(window.startMs), new Date(window.endMs), title)
    return NextResponse.json({ ok: true, dmSent: result.dmSent, emailed: result.emailed, shift: result.shift })
  } catch (error) {
    if (error instanceof ShiftError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error("[tablet] sign-up failed:", error)
    return NextResponse.json({ error: "Could not record the shift, please try again" }, { status: 502 })
  }
}
