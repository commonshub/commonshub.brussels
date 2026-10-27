import { createHash, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { DEFAULT_SETTINGS, listSettings } from "@/lib/notification-settings"

export const dynamic = "force-dynamic"

/**
 * GET /api/notifications/subscribers, for chb when it sends the recaps
 * (Authorization: Bearer RENEW_LINK_SECRET): every member who changed their
 * settings, by Discord id. Anyone not listed gets the default.
 */
export async function GET(request: Request) {
  const secret = process.env.RENEW_LINK_SECRET
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const digest = (s: string) => createHash("sha256").update(s).digest()
  if (!secret || !given || !timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const members = Object.fromEntries([...(await listSettings())].map(([id, s]) => [id, { monthly: s.monthly, quarterly: s.quarterly, yearly: s.yearly }]))
  return NextResponse.json({ ok: true, default: { monthly: DEFAULT_SETTINGS.monthly, quarterly: DEFAULT_SETTINGS.quarterly, yearly: DEFAULT_SETTINGS.yearly }, members })
}
