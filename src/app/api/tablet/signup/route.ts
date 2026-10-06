import { NextResponse } from "next/server"

import { loadTabletEvents } from "@/lib/tablet-data"
import { shiftWindow } from "@/lib/tablet"
import { isTokenBotConfigured, signUpForShift, TokenBotError } from "@/lib/token-bot"

export const dynamic = "force-dynamic"

/** A tablet is one device in one place: a dozen sign-ups in ten minutes is plenty. */
const WINDOW_MS = 10 * 60_000
const MAX_PER_WINDOW = 12
const recent: number[] = []

/**
 * Sign someone up for the shift that stewards an event, from the community
 * tablet. The shift's times are worked out here from the event and the
 * chosen start and length (never taken from the browser); the bot records
 * it exactly like /shifts and DMs the person with a link to cancel, in case
 * someone picked the wrong name.
 */
export async function POST(request: Request) {
  if (!isTokenBotConfigured()) return NextResponse.json({ error: "Shift sign-ups are not available right now" }, { status: 503 })

  let body: { eventId?: unknown; discordUserId?: unknown; startOffset?: unknown; hours?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const discordUserId = typeof body.discordUserId === "string" && /^\d{5,25}$/.test(body.discordUserId) ? body.discordUserId : null
  const event = (await loadTabletEvents()).find((e) => e.id === body.eventId)
  const window = event ? shiftWindow(event.startMs, Number(body.startOffset), Number(body.hours)) : null
  if (!discordUserId || !event || !window) return NextResponse.json({ error: "Pick a person, an upcoming event and a shift" }, { status: 400 })
  if (window.endMs < Date.now()) return NextResponse.json({ error: "That shift is already over" }, { status: 400 })

  const now = Date.now()
  while (recent.length && recent[0] < now - WINDOW_MS) recent.shift()
  if (recent.length >= MAX_PER_WINDOW) return NextResponse.json({ error: "Too many sign-ups at once, try again in a few minutes" }, { status: 429 })
  recent.push(now)

  try {
    const result = await signUpForShift({ discordUserId, start: new Date(window.startMs), end: new Date(window.endMs), eventTitle: event.name })
    return NextResponse.json({ ok: true, emailed: !!result.emailed, shift: result.shift })
  } catch (error) {
    const status = error instanceof TokenBotError ? error.status : 502
    const message = error instanceof TokenBotError && status < 500 ? error.message : "Could not record the shift, please try again"
    return NextResponse.json({ error: message }, { status: status >= 500 ? 502 : status })
  }
}
