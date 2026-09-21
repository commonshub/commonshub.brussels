import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { isDiscordConfigured, sendMessage } from "@/lib/discord"
import { DAY_RE, buildShiftRsvp, shiftDiscordLine, slotId } from "@/lib/day"
import { MAX_SIGNUPS_PER_SLOT, SHIFTS_CHANNEL, SHIFT_SLOTS, loadShiftSignups } from "@/lib/day-data"
import { HUB_PUBKEY, publishAsSite } from "@/lib/nostr-server"

export const dynamic = "force-dynamic"

/**
 * Take or drop a shift. Members only.
 *
 * The record is a NIP-52 RSVP on the community relay, signed by the site's
 * key on the member's behalf. A line also goes to #shifts on Discord, worded
 * like the bot's /shifts command, so Discord readers see the same thing.
 */
export async function POST(request: Request, context: { params: Promise<{ day: string }> }) {
  const { day } = await context.params
  if (!DAY_RE.test(day)) return NextResponse.json({ error: "Invalid day" }, { status: 400 })

  const session = await auth()
  const user = session?.user as { discordId?: string; username?: string; name?: string | null } | undefined
  if (!user?.discordId || !(await isMember())) {
    return NextResponse.json({ error: "Sign in as a member to take a shift" }, { status: 401 })
  }
  if (!HUB_PUBKEY) {
    return NextResponse.json({ error: "Shifts are not configured: no hub Nostr identity" }, { status: 503 })
  }

  let body: { slot?: unknown; action?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const slot = SHIFT_SLOTS.find((s) => slotId(s) === body.slot)
  const action = body.action === "cancel" ? "cancel" : "signup"
  if (!slot) return NextResponse.json({ error: "Unknown shift" }, { status: 400 })

  const before = await loadShiftSignups(day)
  const taken = before.filter((s) => s.slot === slotId(slot))
  if (action === "signup" && !taken.some((s) => s.userId === user.discordId) && taken.length >= MAX_SIGNUPS_PER_SLOT) {
    return NextResponse.json({ error: `This shift already has ${MAX_SIGNUPS_PER_SLOT} people` }, { status: 409 })
  }

  const name = (user.name || user.username || "a member").slice(0, 60)
  try {
    await publishAsSite(buildShiftRsvp(action, { discordId: user.discordId, name }, HUB_PUBKEY, day, slot))
  } catch (error) {
    console.error("[day] could not publish the shift RSVP:", error)
    return NextResponse.json({ error: "The relay did not accept the sign-up" }, { status: 502 })
  }

  if (isDiscordConfigured()) {
    sendMessage(SHIFTS_CHANNEL, shiftDiscordLine(action, user.discordId, day, slot)).catch((error) =>
      console.error("[day] could not post to #shifts:", error),
    )
  }

  // Reflect the change without waiting for the relay to serve it back.
  const mine = { userId: user.discordId, name, slot: slotId(slot), day, at: new Date().toISOString() }
  const signups = before.filter((s) => !(s.userId === user.discordId && s.slot === slotId(slot)))
  if (action === "signup") signups.push(mine)
  return NextResponse.json({ ok: true, signups })
}
