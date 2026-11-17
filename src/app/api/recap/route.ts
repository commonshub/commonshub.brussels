import { createHash, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { communityOnlyRecap, communityPhotos, loadRecap, parsePeriod, SITE } from "@/lib/monthly-recap"
import { buildRecapEmail } from "@/lib/monthly-recap-email"
import { linkDiscordUrl, settingsUrl, signDiscordLinkToken, signSettingsLink } from "@/lib/notification-links"
import { featuredEvents, loadCommunity } from "@/lib/recap-community"

export const dynamic = "force-dynamic"

/**
 * GET /api/recap?period=2026-10|2026-Q4|2026, for chb when it sends the
 * recaps (Authorization: Bearer RENEW_LINK_SECRET), with either
 *   - discordId=…: the member's own recap, or
 *   - emailHash=…&name=<first name>: a member chb doesn't know on Discord:
 *     what the community did, and a button to link their Discord account.
 * The email is rendered with the member's signed notification settings link
 * (keyed by the Discord id, or "e:<emailHash>"). chb adds the address; the
 * site never sees it. Optional: contribution=<euros> (what the member paid
 * in over the period), orgName=… and orgContribution=<euros> (their
 * organisation's), shown under the share of costs covered.
 */
export async function GET(request: Request) {
  const secret = process.env.RENEW_LINK_SECRET
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const digest = (s: string) => createHash("sha256").update(s).digest()
  if (!secret || !given || !timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const q = new URL(request.url).searchParams
  const discordId = q.get("discordId") ?? ""
  const emailHash = (q.get("emailHash") ?? "").toLowerCase()
  const [year, part] = (q.get("period") ?? "").split("-")
  const period = parsePeriod(year, part)
  const byDiscord = /^\d{5,25}$/.test(discordId)
  const byEmail = !byDiscord && /^[0-9a-f]{64}$/.test(emailHash)
  if (!period || (!byDiscord && !byEmail)) return NextResponse.json({ ok: false, error: "period (YYYY-MM, YYYY-Qn or YYYY) and discordId, or emailHash and name, are required" }, { status: 400 })

  const now = new Date()
  const recap = byDiscord ? await loadRecap({ id: discordId }, period, now) : communityOnlyRecap((q.get("name") ?? "").slice(0, 60), period, now)
  if (!recap) return NextResponse.json({ ok: false, error: "No such member on Discord" }, { status: 404 })
  recap.featured = featuredEvents(now)
  recap.community = await loadCommunity(period, now)
  // What they paid in over the period, as chb counts it (contribution=, orgName=, orgContribution=, in euros).
  const amount = (k: string) => {
    const v = q.get(k)
    const n = v === null || v === "" ? NaN : Number(v)
    return Number.isFinite(n) && n >= 0 && n < 1e7 ? Math.round(n * 100) / 100 : null
  }
  const personal = amount("contribution")
  const orgName = (q.get("orgName") ?? "").trim().slice(0, 80)
  const orgAmount = amount("orgContribution")
  if (personal !== null) recap.contribution = { personal, ...(orgName && orgAmount !== null ? { org: { name: orgName, amount: orgAmount } } : {}) }
  // Everyone gets the community mosaic: a member without Discord too (their own photos come first when we know them).
  if (!byDiscord) recap.photos = await communityPhotos(period).catch(() => [])

  const settingsLink = settingsUrl(SITE, signSettingsLink(byDiscord ? discordId : `e:${emailHash}`))
  const { subject, html, text } = buildRecapEmail(recap, { origin: SITE, settingsLink, ...(byEmail ? { linkDiscord: linkDiscordUrl(SITE, signDiscordLinkToken(emailHash)) } : {}) })
  return NextResponse.json({
    ok: true,
    member: byDiscord ? { discordId: recap.member.id, username: recap.member.username, name: recap.member.name } : { emailHash, name: recap.member.name },
    summary: { days: recap.days, received: recap.receivedTotal, spent: recap.spentTotal, praise: recap.praise.length },
    subject,
    html,
    text,
  })
}
