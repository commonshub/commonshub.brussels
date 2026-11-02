import { NextResponse } from "next/server"
import Stripe from "stripe"

import { recordLoginLink } from "@/lib/discord-links"
import { memberIdForEmail } from "@/lib/membership"
import { discordIdFromReference, isMembershipLink, typeOfLink } from "@/lib/membership-application"
import { applicationFromPayment, onboardPaid } from "@/lib/membership-applications-store"
import { applicationForSession } from "@/lib/membership-checkout"

export const dynamic = "force-dynamic"

/**
 * Stripe → the site, for checkout.session.completed: someone paid their
 * membership, so they get the onboarding email (with the link to log in with
 * Discord and get the member role). An accepted applicant is found by the
 * payment link's `client_reference_id=application_<id>` (any of the
 * membership's links: lib/membership-application.ts PAYMENT_LINKS), or by their email;
 * someone who paid the membership link without applying becomes an
 * application there and then. Other checkouts (the fridge, contributions)
 * are ignored. A checkout from a member's dashboard (client_reference_id
 * discord_<id>) is linked to their Discord account instead, so the dashboard
 * shows it at once. Signed by Stripe (STRIPE_MEMBERSHIP_WEBHOOK_SECRET).
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

  // Paid from a member's dashboard: they're on Discord already, so no application or onboarding email; link the payment to them.
  const discordId = discordIdFromReference(session.client_reference_id)
  if (discordId && isMembershipLink(session.payment_link)) {
    const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase()
    const subscription = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
    const paid = subscription ? { subscription, amount: (session.amount_total ?? 0) / 100, interval: "month" as const, at: new Date(event.created * 1000).toISOString() } : undefined
    const emailHash = memberIdForEmail(email)
    if (emailHash && !(await recordLoginLink(discordId, emailHash, new Date(), "checkout", paid))) {
      // Stripe retries on a 5xx.
      return NextResponse.json({ error: "Could not link the payment" }, { status: 500 })
    }
    return NextResponse.json({ linked: true })
  }

  try {
    let id = await applicationForSession(session)
    const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase()
    if (!id && isMembershipLink(session.payment_link) && email) {
      id = (await applicationFromPayment({ name: session.customer_details?.name, email, sessionId: session.id, type: typeOfLink(session.payment_link) })).id
    }
    if (!id) return NextResponse.json({ ignored: "not a membership" })
    return NextResponse.json({ onboarded: await onboardPaid(id) })
  } catch (error) {
    console.error("[membership] onboarding failed:", error)
    // Stripe retries on a 5xx: the email goes out once it works.
    return NextResponse.json({ error: "Could not send the onboarding email" }, { status: 500 })
  }
}
