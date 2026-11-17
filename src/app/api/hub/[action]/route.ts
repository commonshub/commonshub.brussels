import { NextResponse } from "next/server"
import Stripe from "stripe"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { type BotInvoice, checkoutParams } from "@/lib/invoice-payment"
import { publicOrigin } from "@/lib/public-origin"
import { ALLOWED_FIELDS, type BotEndpoint, type BotIdentity, callTokenBot, pickFields } from "@/lib/token-bot"

export const dynamic = "force-dynamic"

/**
 * POST /api/hub/{options,availability,cowork,guestpass,book,orgs,org,vat,paybook,paycowork}:
 * the dashboard's booking dialogs, passed on to the bot for the signed-in
 * member (who they are comes from the session, never from the request).
 *
 * paybook / paycowork with `pay: "card"`: once the bot has made the invoice,
 * a Stripe Checkout for its total is created here and its URL added to the
 * answer. If that fails the booking stands and the invoice can be paid by
 * transfer.
 *
 * A test user (session.user.testMode, signed in with an email code) books
 * through the bot as a test user (euros only, invoices in the test copy of
 * Odoo, nothing booked for real) and pays with Stripe's sandbox
 * (STRIPE_TEST_SECRET_KEY).
 */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (!(action in ALLOWED_FIELDS)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  const session = await auth()
  const test = session?.user?.testMode === true && !!session.user.email && !!session.user.odooPartnerId
  if (!test && (!session?.user?.discordId || !(await isMember()))) return NextResponse.json({ ok: false, error: "Members only" }, { status: 403 })
  const who: BotIdentity = test
    ? { testUser: { email: session!.user.email!, partnerId: session!.user.odooPartnerId!, name: session!.user.username || session!.user.name || "Test user" } }
    : session!.user.discordId
  const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
  const answer = await callTokenBot(action as BotEndpoint, who, pickFields(action, body))

  const invoice = (answer.body as { invoice?: BotInvoice }).invoice
  if ((action === "paybook" || action === "paycowork") && answer.body.ok && body.pay === "card" && invoice) {
    const secretKey = test ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY
    if (!secretKey) return NextResponse.json({ ...answer.body, checkoutError: "Card payment isn't available right now: pay by bank transfer." }, { status: answer.status })
    const b = answer.body as { room?: { name: string }; item?: { label: string } }
    const what = b.room?.name ?? b.item?.label ?? "Commons Hub booking"
    try {
      const checkout = await new Stripe(secretKey).checkout.sessions.create(checkoutParams(invoice, what, publicOrigin(request)))
      return NextResponse.json({ ...answer.body, checkoutUrl: checkout.url }, { status: answer.status })
    } catch (error) {
      console.error("[hub] Stripe Checkout for", invoice.number, "failed:", error)
      return NextResponse.json({ ...answer.body, checkoutError: "We couldn't open the card payment: pay by bank transfer instead." }, { status: answer.status })
    }
  }
  return NextResponse.json(answer.body, { status: answer.status })
}
