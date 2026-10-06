import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { buildShiftEmail, sendShiftConfirmation, type ShiftConfirmation } from "@/lib/shift-email"
import { REWARD_PER_HOUR } from "@/lib/shifts-service"

export const dynamic = "force-dynamic"

/** Only from the server itself (or an operator on it): the request must carry AUTH_SECRET. */
function isOperator(request: Request): boolean {
  const secret = process.env.AUTH_SECRET
  const given = request.headers.get("x-operator-secret") ?? ""
  return !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret))
}

/**
 * Preview, or send as a test, the shift confirmation email for a sample
 * shift: POST { to, name?, start, end, eventTitle?, send? }.
 */
export async function POST(request: Request) {
  if (!isOperator(request)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as { to?: string; name?: string; start?: string; end?: string; eventTitle?: string; send?: boolean }
  const start = new Date(body.start ?? "")
  const end = new Date(body.end ?? "")
  if (!body.to || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return NextResponse.json({ error: "to, start and end are required" }, { status: 400 })
  const hours = (end.getTime() - start.getTime()) / 3_600_000
  const d: ShiftConfirmation = {
    memberName: body.name || body.to.split("@")[0],
    email: body.to,
    start,
    end,
    eventTitle: body.eventTitle,
    reward: { amount: hours * REWARD_PER_HOUR, symbol: "CHT" },
    cancelUrl: "https://commonshub.brussels/shifts/cancel?t=sample",
    via: "tablet",
  }
  if (!body.send) return NextResponse.json(buildShiftEmail(d))
  try {
    const { id } = await sendShiftConfirmation(d)
    return NextResponse.json({ sentTo: body.to, id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send" }, { status: 502 })
  }
}
