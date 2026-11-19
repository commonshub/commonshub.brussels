import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { LINK_COOKIE, signLinkIntent } from "@/lib/link-intent"

export const dynamic = "force-dynamic"

/**
 * POST (the email dashboard's "Link your Discord account"): remember who asked, then the page
 * signs in with Discord, which links the two (lib/link-intent.ts, auth.ts). Signed in with an
 * email code only, never a test user.
 */
export async function POST() {
  const session = await auth()
  const u = session?.user
  if (!u?.odooPartnerId || !u.email || u.discordId || u.testMode) return NextResponse.json({ ok: false, error: "Sign in with your email address first" }, { status: 403 })
  const value = signLinkIntent({ partnerId: u.odooPartnerId, email: u.email, name: u.name || u.username || "" })
  if (!value) return NextResponse.json({ ok: false, error: "Not available right now" }, { status: 503 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(LINK_COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 })
  return res
}
