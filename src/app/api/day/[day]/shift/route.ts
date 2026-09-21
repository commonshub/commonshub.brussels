import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { isDiscordConfigured, sendMessage } from "@/lib/discord"
import { DAY_RE, shiftMessage } from "@/lib/day"
import { SHIFTS_CHANNEL, SHIFT_SLOTS, forgetShiftMessages, loadShiftSignups } from "@/lib/day-data"

export const dynamic = "force-dynamic"

/**
 * Sign up for, or step out of, a shift on a given day. Members only. The
 * record of truth is the #shifts channel on Discord: the site posts one
 * line there and reads the channel back, so the community sees the same
 * list the page does, and nothing is stored on the web server.
 */
export async function POST(request: Request, context: { params: Promise<{ day: string }> }) {
  const { day } = await context.params
  if (!DAY_RE.test(day)) return NextResponse.json({ error: "Invalid day" }, { status: 400 })

  const session = await auth()
  const user = session?.user as { discordId?: string; username?: string; name?: string | null } | undefined
  if (!user?.discordId || !(await isMember())) {
    return NextResponse.json({ error: "Sign in as a member to take a shift" }, { status: 401 })
  }
  if (!isDiscordConfigured()) {
    return NextResponse.json({ error: "Shifts are not configured on this server" }, { status: 503 })
  }

  let body: { slot?: unknown; action?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const slot = SHIFT_SLOTS.find((s) => s.id === body.slot)
  const action = body.action === "cancel" ? "cancel" : "signup"
  if (!slot) return NextResponse.json({ error: "Unknown shift" }, { status: 400 })

  const name = (user.name || user.username || "a member").slice(0, 60).replace(/[()`]/g, "")
  try {
    await sendMessage(SHIFTS_CHANNEL, shiftMessage(action, { id: user.discordId, name }, slot, day))
  } catch (error) {
    console.error("[day] could not post the shift:", error)
    return NextResponse.json({ error: "Could not reach Discord" }, { status: 502 })
  }

  forgetShiftMessages()
  const signups = await loadShiftSignups(day, true)
  return NextResponse.json({ ok: true, signups })
}
