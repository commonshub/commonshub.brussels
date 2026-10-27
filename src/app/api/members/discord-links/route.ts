import { createHash, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { listLoginLinks, type DiscordLink } from "@/lib/discord-links"
import { isApplicationsConfigured, listApplications } from "@/lib/membership-applications-store"
import { memberIdForEmail } from "@/lib/membership"

export const dynamic = "force-dynamic"

/**
 * GET /api/members/discord-links, for chb (Authorization: Bearer
 * RENEW_LINK_SECRET): which Discord account goes with which membership id
 * (emailHash, as in members.json), from logins and from membership
 * applications. No email addresses. A Discord id can appear more than once
 * (a login and an application, or two addresses).
 */
export async function GET(request: Request) {
  const secret = process.env.RENEW_LINK_SECRET
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const digest = (s: string) => createHash("sha256").update(s).digest()
  if (!secret || !given || !timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const [logins, applications] = await Promise.all([
    listLoginLinks().catch(() => [] as DiscordLink[]),
    isApplicationsConfigured() ? listApplications().catch(() => []) : Promise.resolve([]),
  ])
  const fromApplications: DiscordLink[] = applications.flatMap((a) => {
    const emailHash = a.discordId ? memberIdForEmail(a.email) : null
    return a.discordId && emailHash ? [{ discordId: a.discordId, emailHash, source: "application" as const, at: a.paidAt ?? a.approvedAt ?? a.submittedAt, applicationId: a.id }] : []
  })
  const seen = new Set<string>()
  const links = [...logins, ...fromApplications].filter((l) => {
    const k = `${l.discordId}:${l.emailHash}:${l.source}`
    return seen.has(k) ? false : (seen.add(k), true)
  })
  return NextResponse.json({ ok: true, count: links.length, links })
}
