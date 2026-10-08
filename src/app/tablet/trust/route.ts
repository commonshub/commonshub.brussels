import { NextResponse } from "next/server"

import { publicOrigin } from "@/lib/public-origin"
import { TRUST_COOKIE } from "@/lib/tablet-trust"

export const dynamic = "force-dynamic"

/**
 * The hub's tablet is trusted by pairing it from a steward's phone
 * (/tablet → "A steward can pair it", lib/tablet-pairing), never by signing
 * in on it. This address only forgets the trust on this device (?off=1) and
 * otherwise goes back to /tablet.
 */
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/tablet", publicOrigin(request)))
  if (new URL(request.url).searchParams.get("off")) res.cookies.delete(TRUST_COOKIE)
  return res
}
