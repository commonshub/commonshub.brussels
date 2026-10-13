import { NextResponse } from "next/server"
import Stripe from "stripe"

import { PAYMENT_LINK_ID } from "@/lib/membership-application"
import { applicationFromPayment, onboardPaid } from "@/lib/membership-applications-store"
import { applicationForSession } from "@/lib/membership-checkout"

export const dynamic = "force-dynamic"

/**
 * Stripe → the site, for checkout.session.completed: someone paid their
 * membership, so they get the onboarding email (with the link to log in with
 * Discord and get the member role). An accepted applicant is found by the
 * payment link's `client_reference_id=application_<id>`, or by their email;
 * someone who paid the membership link without applying becomes an
 * application there and then. Other checkouts (the fridge, contributions)
 * are ignored. Signed by Stripe (STRIPE_MEMBERSHIP_WEBHOOK_SECRET).
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!secret || !apiKey) return NextResponse.json({ error: "Not configured" }, { status: 503 })
  let event: Stripe.Event
  try {
    event = new Stripe(apiKey).webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }
  if (event.type !== "checkout.session.completed") return NextResponse.json({ ignored: event.type })
  const session = event.data.object as Stripe.Checkout.Session
  if (session.payment_status !== "paid" && session.status !== "complete") return NextResponse.json({ ignored: "unpaid" })

  try {
    let id = await applicationForSession(session)
    const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase()
    if (!id && session.payment_link === PAYMENT_LINK_ID && email) {
      id = (await applicationFromPayment({ name: session.customer_details?.name, email, sessionId: session.id })).id
    }
    if (!id) return NextResponse.json({ ignored: "not a membership" })
    return NextResponse.json({ onboarded: await onboardPaid(id) })
  } catch (error) {
    console.error("[membership] onboarding failed:", error)
    // Stripe retries on a 5xx: the email goes out once it works.
    return NextResponse.json({ error: "Could not send the onboarding email" }, { status: 500 })
  }
}
