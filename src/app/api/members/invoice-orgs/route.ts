import { createHash, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import settings from "@/settings/settings.json"

export const dynamic = "force-dynamic"

/**
 * GET /api/members/invoice-orgs, for chb (Authorization: Bearer RENEW_LINK_SECRET, like
 * /api/members/discord-links): which organisations (Odoo partner ids) each member invoices
 * through the website, {discordId: [ids]}, relayed from the bot. Used for the recap's
 * "<organisation>'s contribution".
 */
export async function GET(request: Request) {
  const secret = process.env.RENEW_LINK_SECRET
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const digest = (s: string) => createHash("sha256").update(s).digest()
  if (!secret || !given || !timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const base = process.env.TOKEN_BOT_URL
  const token = process.env.TOKEN_BOT_API_TOKEN
  if (!base || !token) return NextResponse.json({ ok: false, error: "The bot isn't configured" }, { status: 503 })
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/website/invoice-orgs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: settings.discord.guildId }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    const answer = (await res.json().catch(() => null)) as { ok?: boolean; orgs?: Record<string, number[]> } | null
    if (!answer?.ok) return NextResponse.json({ ok: false, error: "The bot didn't answer properly" }, { status: 502 })
    return NextResponse.json({ ok: true, orgs: answer.orgs ?? {} })
  } catch {
    return NextResponse.json({ ok: false, error: "We couldn't reach the bot" }, { status: 502 })
  }
}
