import { NextResponse } from "next/server"
import QRCode from "qrcode"

import { auth } from "@/auth"
import { isSteward } from "@/lib/admin-check"
import { publicOrigin } from "@/lib/public-origin"
import { approvePairing, collectPairing, createPairing, findPairing } from "@/lib/tablet-pairing"
import { TRUST_COOKIE, TRUST_MAX_AGE, trustToken } from "@/lib/tablet-trust"

export const dynamic = "force-dynamic"

/** The tablet asks to be paired: a QR code (to scan with a steward's phone) and a 6-digit code. */
export async function POST(request: Request) {
  const pairing = createPairing()
  if (!pairing) return NextResponse.json({ error: "Too many pairings pending, try again in a few minutes" }, { status: 429 })
  const url = `${publicOrigin(request)}/tablet/pair?id=${pairing.id}`
  const qrSvg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1 })
  return NextResponse.json({ id: pairing.id, code: pairing.code, expiresAt: pairing.expiresAt, qrSvg })
}

/** The tablet polls with its pairing id: once a steward approved it, it gets the trust cookie. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ status: "expired" }, { status: 400 })
  const result = collectPairing(id)
  const res = NextResponse.json({ status: result.status }, { headers: { "Cache-Control": "no-store" } })
  if (result.status === "approved") {
    res.cookies.set(TRUST_COOKIE, trustToken(result.stewardId), {
      httpOnly: true,
      secure: publicOrigin(request).startsWith("https:"),
      sameSite: "lax",
      path: "/",
      maxAge: TRUST_MAX_AGE,
    })
    console.log(`[tablet] device paired, approved by ${result.stewardId}`)
  }
  return res
}

/** A signed-in steward approves a pairing on their phone, by the id in the QR code or the 6-digit code. */
export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  if (!(await isSteward())) return NextResponse.json({ error: "Only a steward can pair the hub's tablet" }, { status: 403 })
  let body: { id?: unknown; code?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const pairing = findPairing({ id: typeof body.id === "string" ? body.id : null, code: typeof body.code === "string" ? body.code : null })
  if (!pairing) return NextResponse.json({ error: "No tablet is waiting with that code (codes last ten minutes)" }, { status: 404 })
  approvePairing(pairing, session.user.discordId || "steward")
  return NextResponse.json({ ok: true, code: pairing.code })
}
