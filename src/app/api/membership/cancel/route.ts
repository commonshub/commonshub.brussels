import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { cancelMembership } from "@/lib/member-plan"
import { sendMessage, isDiscordConfigured } from "@/lib/discord"
import settings from "@/settings/settings.json"

export const dynamic = "force-dynamic"

/**
 * POST { cancel: true }: the signed-in member cancels their monthly card
 * membership at the end of the period they paid for; { cancel: false } takes
 * that back. Who they are comes from the session only.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || !(await isMember())) return NextResponse.json({ error: "Members only" }, { status: 403 })
  const { cancel } = ((await request.json().catch(() => ({}))) ?? {}) as { cancel?: unknown }
  if (typeof cancel !== "boolean") return NextResponse.json({ error: "Say whether to cancel" }, { status: 400 })
  try {
    const result = await cancelMembership(session.user, cancel)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.changed && isDiscordConfigured()) {
      const text = cancel ? `👋 <@${session.user.discordId}> cancelled their membership on the website${result.endsOn ? `; it ends on ${result.endsOn}` : ""}.` : `↩️ <@${session.user.discordId}> took back the cancellation of their membership on the website.`
      sendMessage(settings.discord.channels.membership, text).catch(() => {})
    }
    return NextResponse.json({ ok: true, endsOn: result.endsOn })
  } catch (error) {
    console.error("[membership] cancellation failed:", error)
    return NextResponse.json({ error: "Could not change your membership, please try again" }, { status: 502 })
  }
}
