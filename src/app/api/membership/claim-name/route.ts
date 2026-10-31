import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { recordLoginLink } from "@/lib/discord-links"
import { sendMessage, isDiscordConfigured } from "@/lib/discord"
import { candidateFor } from "@/lib/member-plan"
import settings from "@/settings/settings.json"

export const dynamic = "force-dynamic"

/**
 * POST: the signed-in member says the membership whose name matches theirs
 * (lib/member-plan.ts nameCandidate) is theirs. The match is worked out
 * again here, from the session, never from what the browser sends. Stewards
 * see it in #membership, since a Discord name can be changed.
 */
export async function POST() {
  const session = await auth()
  const discordId = session?.user?.discordId
  if (!discordId || !(await isMember())) return NextResponse.json({ ok: false, error: "Members only" }, { status: 403 })
  const match = await candidateFor(discordId)
  if (!match) return NextResponse.json({ ok: false, error: "We couldn't find that membership anymore. Write to hello@commonshub.brussels." }, { status: 404 })
  await recordLoginLink(discordId, match.accounts.emailHash, new Date(), "name")
  if (isDiscordConfigured()) {
    sendMessage(settings.discord.channels.membership, `🔗 <@${discordId}> said the membership of ${match.firstName} (matched by name) is theirs.`).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
