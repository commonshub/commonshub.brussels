import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { changeMonthlyAmount } from "@/lib/member-plan"
import { sendMessage, isDiscordConfigured } from "@/lib/discord"
import settings from "@/settings/settings.json"

export const dynamic = "force-dynamic"

/**
 * POST { amount: 10 | 15 | 20 }: change what the signed-in member pays each
 * month, from their next payment. Who they are comes from the session only.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || !(await isMember())) return NextResponse.json({ error: "Members only" }, { status: 403 })
  const { amount } = ((await request.json().catch(() => ({}))) ?? {}) as { amount?: unknown }
  try {
    const result = await changeMonthlyAmount(session.user, Number(amount))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    if (result.from !== result.amount && isDiscordConfigured()) {
      // Stewards see that a plan changed, never by how much: what someone pays is theirs.
      sendMessage(settings.discord.channels.membership, `🔁 <@${session.user.discordId}> changed their monthly membership amount on the website.`).catch(() => {})
    }
    return NextResponse.json({ ok: true, amount: result.amount })
  } catch (error) {
    console.error("[membership] plan change failed:", error)
    return NextResponse.json({ error: "Could not change your plan, please try again" }, { status: 502 })
  }
}
