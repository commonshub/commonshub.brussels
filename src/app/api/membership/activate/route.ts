import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { ACTIVATION_ERRORS, activateMembership } from "@/lib/member-activation"
import { memberIdForEmail } from "@/lib/membership"

export const dynamic = "force-dynamic"

/** Their Discord account's email, only if Discord says they verified it (asked now, with their own token). */
async function verifiedDiscordEmail(accessToken: string | undefined): Promise<string | null> {
  if (!accessToken) return null
  const res = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }).catch(() => null)
  if (!res?.ok) return null
  const me = (await res.json()) as { email?: string | null; verified?: boolean }
  return me.verified && me.email ? me.email : null
}

/**
 * POST: someone signed in without the member role says they already pay
 * (lib/member-activation.ts). If their verified Discord email pays a current
 * membership, they get the role. Otherwise `needEmail`: the page asks for
 * the address they pay with (/api/members/email).
 */
export async function POST() {
  const session = await auth()
  const discordId = session?.user?.discordId
  if (!discordId) return NextResponse.json({ ok: false, error: "Log in with Discord first" }, { status: 401 })
  if (await isMember()) return NextResponse.json({ ok: true, activated: false })
  const email = await verifiedDiscordEmail(session.user.accessToken)
  const result = await activateMembership({ discordId, accessToken: session.user.accessToken }, memberIdForEmail(email), "login")
  if (result.ok) return NextResponse.json({ ok: true, activated: true })
  if (result.reason === "none") return NextResponse.json({ ok: false, needEmail: true })
  const { error, status } = ACTIVATION_ERRORS[result.reason]
  return NextResponse.json({ ok: false, error }, { status })
}
