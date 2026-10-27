import { createHash, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { loadRecap, parsePeriod } from "@/lib/monthly-recap"
import { buildRecapEmail } from "@/lib/monthly-recap-email"
import { settingsUrl, signSettingsLink } from "@/lib/notification-links"
import { SITE } from "@/lib/monthly-recap"

export const dynamic = "force-dynamic"

/**
 * GET /api/recap?discordId=…&period=2026-10|2026-Q4|2026, for chb when it
 * sends the recaps (Authorization: Bearer RENEW_LINK_SECRET): the member's
 * email, rendered, with their signed notification settings link. chb adds
 * the address; the site never sees it.
 */
export async function GET(request: Request) {
  const secret = process.env.RENEW_LINK_SECRET
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const digest = (s: string) => createHash("sha256").update(s).digest()
  if (!secret || !given || !timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const q = new URL(request.url).searchParams
  const discordId = q.get("discordId") ?? ""
  const [year, part] = (q.get("period") ?? "").split("-")
  const period = parsePeriod(year, part)
  if (!/^\d{5,25}$/.test(discordId) || !period) return NextResponse.json({ ok: false, error: "discordId and period (YYYY-MM, YYYY-Q1…Q4 or YYYY) are required" }, { status: 400 })

  const recap = await loadRecap({ id: discordId }, period)
  if (!recap) return NextResponse.json({ ok: false, error: "No such member on Discord" }, { status: 404 })
  const { subject, html, text } = buildRecapEmail(recap, { origin: SITE, settingsLink: settingsUrl(SITE, signSettingsLink(discordId)) })
  return NextResponse.json({
    ok: true,
    member: { discordId: recap.member.id, username: recap.member.username, name: recap.member.name },
    summary: { days: recap.days, received: recap.receivedTotal, spent: recap.spentTotal, praise: recap.praise.length },
    subject,
    html,
    text,
  })
}
