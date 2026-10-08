import { NextResponse } from "next/server"

import { publicOrigin } from "@/lib/public-origin"
import { renewedToken, trustCookieOf, TRUST_COOKIE, TRUST_MAX_AGE } from "@/lib/tablet-trust"

export const dynamic = "force-dynamic"

/** The paired tablet renews its trust when it loads (at most once a day): a tablet in use stays paired for good. */
export async function POST(request: Request) {
  const fresh = renewedToken(trustCookieOf(request))
  const res = NextResponse.json({ renewed: !!fresh }, { headers: { "Cache-Control": "no-store" } })
  if (fresh) {
    res.cookies.set(TRUST_COOKIE, fresh, { httpOnly: true, secure: publicOrigin(request).startsWith("https:"), sameSite: "lax", path: "/", maxAge: TRUST_MAX_AGE })
  }
  return res
}
