import { NextResponse } from "next/server"

import { rangeWindow, stewardedTitle } from "@/lib/tablet"
import { loadTabletBookings } from "@/lib/tablet-data"
import { auth } from "@/auth"
import { isTrusted, trustCookieOf } from "@/lib/tablet-trust"
import { isMember } from "@/lib/admin-check"
import { ShiftError, changeShift, isShiftsConfigured } from "@/lib/shifts-service"

export const dynamic = "force-dynamic"

/** Thirty changes in ten minutes is plenty. */
const WINDOW_MS = 10 * 60_000
const MAX_PER_WINDOW = 30
const recent: number[] = []

/**
 * Change someone's hours, from the hub's paired tablet or from /shifts by a
 * member signed in with Discord (whoever may sign people up): the shifts
 * the tablet shows as one (`ids`, the person's back-to-back shifts that
 * day) become one shift from `start` to `end` (minutes after midnight).
 * The times are checked here (lib/tablet.ts rangeWindow); the person is
 * DMed the new times with a link to cancel, as for a sign-up.
 */
export async function POST(request: Request) {
  if (!isShiftsConfigured()) return NextResponse.json({ error: "Changing shifts is not available right now" }, { status: 503 })
  const pairedTablet = isTrusted(trustCookieOf(request))
  if (!pairedTablet && !(await auth())?.user) {
    return NextResponse.json({ error: "Sign in with Discord to change a shift (or use the hub's paired tablet)" }, { status: 403 })
  }

  let body: { ids?: unknown; person?: unknown; day?: unknown; start?: unknown; end?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && /^[\w-]{1,200}$/.test(id)).slice(0, 12) : []
  const person = typeof body.person === "string" && /^[\w.-]{1,64}$/.test(body.person) ? body.person : null
  if (!ids.length || !person) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const window = typeof body.day === "string" ? rangeWindow(body.day, Number(body.start), Number(body.end)) : null
  if (!window) return NextResponse.json({ error: "Pick a start and an end on the half hour, one to twelve hours apart" }, { status: 400 })
  if (window.endMs < Date.now()) return NextResponse.json({ error: "That shift would already be over" }, { status: 400 })

  const now = Date.now()
  while (recent.length && recent[0] < now - WINDOW_MS) recent.shift()
  if (recent.length >= MAX_PER_WINDOW) return NextResponse.json({ error: "Too many changes at once, try again in a few minutes" }, { status: 429 })
  recent.push(now)

  const trusted = pairedTablet || (await isMember())
  try {
    const result = await changeShift(person, ids, new Date(window.startMs), new Date(window.endMs), stewardedTitle(loadTabletBookings(window.startMs, window.endMs, trusted ? "members" : "public"), window))
    return NextResponse.json({ ok: true, dmSent: result.dmSent, emailed: result.emailed })
  } catch (error) {
    if (error instanceof ShiftError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error("[tablet] changing a shift failed:", error)
    return NextResponse.json({ error: "Could not change the shift, please try again" }, { status: 502 })
  }
}
