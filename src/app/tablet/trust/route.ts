import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isSteward } from "@/lib/admin-check"
import { TRUST_COOKIE, TRUST_MAX_AGE, trustToken } from "@/lib/tablet-trust"

export const dynamic = "force-dynamic"

/**
 * Trust this device as the hub's tablet (see lib/tablet-trust): a signed-in
 * steward opens /tablet/trust on it once. Anyone else is sent to sign in
 * first. /tablet/trust?off=1 forgets the trust on this device.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const back = new URL("/tablet", url.origin)
  if (url.searchParams.get("off")) {
    const res = NextResponse.redirect(back)
    res.cookies.delete(TRUST_COOKIE)
    return res
  }
  const session = await auth()
  if (!session?.user) return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent("/tablet/trust")}`, url.origin))
  if (!(await isSteward())) return NextResponse.json({ error: "Only a steward can trust a device as the hub's tablet" }, { status: 403 })
  const id = session.user.discordId || "steward"
  const res = NextResponse.redirect(back)
  res.cookies.set(TRUST_COOKIE, trustToken(id), { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: TRUST_MAX_AGE })
  console.log(`[tablet] device trusted by ${id}`)
  return res
}
