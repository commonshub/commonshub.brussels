import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { buildWelcomeEmail, sendWelcome } from "@/lib/membership-welcome"
import { buildAcceptedEmail, buildReceivedEmail, paymentUrlFor, type Application } from "@/lib/membership-application"
import { sendAccepted, sendReceived } from "@/lib/membership-applications-store"
import { bankCommunication, buildReminderEmail, GRACE_DAYS, sendReminder, signRenew, type ReminderReason } from "@/lib/membership-reminder"

export const dynamic = "force-dynamic"

function isOperator(request: Request): boolean {
  const secret = process.env.AUTH_SECRET
  const given = request.headers.get("x-operator-secret") ?? ""
  return !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret))
}

/**
 * Preview, or send as a test, the membership reminder:
 * POST { to, name, reason?, organisation?, stripeCustomerId?, odooPartnerId?, send? },
 * or the welcome email with reason "welcome".
 * Only from the server itself (AUTH_SECRET header).
 */
export async function POST(request: Request) {
  if (!isOperator(request)) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as { to?: string; name?: string; reason?: ReminderReason | "welcome" | "application-received" | "application-accepted"; organisation?: boolean; stripeCustomerId?: string; odooPartnerId?: number; send?: boolean }
  if (!body.to || !body.name) return NextResponse.json({ error: "to and name are required" }, { status: 400 })
  if (body.reason === "application-received" || body.reason === "application-accepted") {
    // A sample application (not stored anywhere): what the applicant would get.
    const a: Application = {
      id: "test-preview",
      submittedAt: new Date().toISOString(),
      type: "individual",
      name: body.name,
      email: body.to,
      needs: ["I need a space to work", "I want to meet other commoners"],
      contribute: "I can help with the website and host a workshop on open source.",
      heardFrom: "A friend told me about the Friday potluck.",
      whoYouKnow: "Xavier and Leen",
      monthly: 15,
      status: body.reason === "application-received" ? "pending" : "approved",
    }
    const vouchers = [{ name: "Leen" }, { name: "Miriam" }, { name: "Xavier" }]
    if (!body.send) return NextResponse.json(body.reason === "application-received" ? buildReceivedEmail(a) : buildAcceptedEmail(a, vouchers, paymentUrlFor(a)))
    try {
      const id = body.reason === "application-received" ? await sendReceived(a) : await sendAccepted(a, vouchers)
      return NextResponse.json({ sentTo: body.to, id })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send" }, { status: 502 })
    }
  }
  if (body.reason === "welcome") {
    const w = { name: body.name, email: body.to, organisation: body.organisation }
    if (!body.send) return NextResponse.json(buildWelcomeEmail(w))
    try {
      return NextResponse.json({ sentTo: body.to, ...(await sendWelcome(w)) })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send" }, { status: 502 })
    }
  }
  const reason: ReminderReason = body.reason ?? "paused"
  const claim = { n: body.name, ...(body.stripeCustomerId ? { c: body.stripeCustomerId } : {}), ...(body.odooPartnerId ? { p: body.odooPartnerId } : {}), ...(body.organisation ? { o: true } : {}), x: Math.floor(Date.now() / 1000) + 30 * 86_400 }
  const d = {
    name: body.name,
    email: body.to,
    reason,
    organisation: body.organisation,
    graceEndsAt: reason === "ended" ? undefined : new Date(Date.now() + GRACE_DAYS * 86_400_000),
    renewUrl: `https://commonshub.brussels/membership/renew?t=${encodeURIComponent(signRenew(claim))}`,
    communication: bankCommunication(claim),
  }
  if (!body.send) return NextResponse.json({ ...buildReminderEmail(d), renewUrl: d.renewUrl })
  try {
    const { id } = await sendReminder(d)
    return NextResponse.json({ sentTo: body.to, id, renewUrl: d.renewUrl })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send" }, { status: 502 })
  }
}
