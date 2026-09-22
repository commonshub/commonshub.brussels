import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isMember, isSteward } from "@/lib/admin-check"
import { DAY_RE } from "@/lib/day"
import { isDiscordConfigured, sendMessage } from "@/lib/discord"
import { MAX_SIGNUPS_PER_SLOT, SHIFTS_CHANNEL, SHIFT_SLOTS, loadShiftSignups, lookupMember, shiftDiscordLine } from "@/lib/day-data"
import { buildRsvp, shiftCoordinate, slotCode, slotLabel } from "@/lib/nostr-conventions"
import { COMMUNITY, coordinatorPubkey, ensureCommunityDefinition, ensureShiftOccurrence, eventExists, siteIdentity } from "@/lib/nostr-server"

export const dynamic = "force-dynamic"

/** A steward may act for another member: `for=<discord id>` names them. */
async function onBehalfOf(forId: string | null, me: string) {
  if (!forId || forId === me) return { target: null, error: null }
  if (!(await isSteward())) return { target: null, error: "Only stewards can sign someone else up" }
  const target = await lookupMember(forId)
  return target ? { target, error: null } : { target: null, error: "That person is not a member of the community" }
}

/**
 * GET: what a member's browser needs to sign an RSVP for a slot — the
 * template, with the coordinator and community filled in. With `for=<id>`
 * a steward gets a template that names that member as the attendee. The
 * browser signs and publishes it with the signer's own key, then POSTs the
 * event id back here.
 */
export async function GET(request: Request, context: { params: Promise<{ day: string }> }) {
  const { day } = await context.params
  if (!DAY_RE.test(day)) return NextResponse.json({ error: "Invalid day" }, { status: 400 })
  const url = new URL(request.url)
  const slot = SHIFT_SLOTS.find((s) => slotCode(s) === url.searchParams.get("slot"))
  const action = url.searchParams.get("action") === "cancel" ? "cancel" : "signup"
  const coordinator = coordinatorPubkey()
  const site = siteIdentity()
  if (!slot || !coordinator || !site) return NextResponse.json({ error: "Unknown shift" }, { status: 400 })

  const session = await auth()
  const me = (session?.user as { discordId?: string } | undefined)?.discordId
  if (!me || !(await isMember())) return NextResponse.json({ error: "Sign in as a member to take a shift" }, { status: 401 })
  const { target, error } = await onBehalfOf(url.searchParams.get("for"), me)
  if (error) return NextResponse.json({ error }, { status: 403 })

  return NextResponse.json({
    template: buildRsvp(action, COMMUNITY, coordinator, site.pubkey, day, slot, new Date(), target ?? undefined),
    coordinate: shiftCoordinate(coordinator, COMMUNITY, day, slot),
    for: target,
  })
}

/**
 * POST after the browser published the RSVP: check it exists on a relay,
 * make sure the shift occurrence and community definition exist, announce
 * it in #shifts, and return the day's sign-ups.
 */
export async function POST(request: Request, context: { params: Promise<{ day: string }> }) {
  const { day } = await context.params
  if (!DAY_RE.test(day)) return NextResponse.json({ error: "Invalid day" }, { status: 400 })

  const session = await auth()
  const user = session?.user as { discordId?: string } | undefined
  if (!user?.discordId || !(await isMember())) {
    return NextResponse.json({ error: "Sign in as a member to take a shift" }, { status: 401 })
  }

  let body: { slot?: unknown; action?: unknown; eventId?: unknown; for?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const slot = SHIFT_SLOTS.find((s) => slotCode(s) === body.slot)
  const action = body.action === "cancel" ? "cancel" : "signup"
  const eventId = typeof body.eventId === "string" && /^[0-9a-f]{64}$/.test(body.eventId) ? body.eventId : null
  if (!slot || !eventId) return NextResponse.json({ error: "Unknown shift or event" }, { status: 400 })
  const { target, error } = await onBehalfOf(typeof body.for === "string" ? body.for : null, user.discordId)
  if (error) return NextResponse.json({ error }, { status: 403 })

  if (!(await eventExists(eventId))) {
    return NextResponse.json({ error: "The relays do not have that RSVP" }, { status: 404 })
  }

  try {
    await ensureCommunityDefinition()
    await ensureShiftOccurrence(day, slot, MAX_SIGNUPS_PER_SLOT, `Caretaking shift ${slotLabel(slot)}`)
  } catch (error) {
    console.error("[day] could not publish the shift occurrence:", error)
  }

  if (isDiscordConfigured()) {
    sendMessage(SHIFTS_CHANNEL, shiftDiscordLine(action, target?.id ?? user.discordId, day, slot, user.discordId)).catch((error) => console.error("[day] could not post to #shifts:", error))
  }

  return NextResponse.json({ ok: true, signups: await loadShiftSignups(day) })
}
