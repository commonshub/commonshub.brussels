import { NextResponse } from "next/server"
import Stripe from "stripe"

import { applicationIdFromReference } from "@/lib/membership-application"
import { listApplications, onboardPaid } from "@/lib/membership-applications-store"

export const dynamic = "force-dynamic"

/**
 * Stripe → the site, for checkout.session.completed: an accepted applicant
 * paid their membership (the payment link in the acceptance email carries
 * `client_reference_id=application_<id>`), so they get the onboarding email.
 * Someone paying through the bare link is matched by their email among the
 * accepted applications. Signed by Stripe (STRIPE_MEMBERSHIP_WEBHOOK_SECRET).
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

  let id = applicationIdFromReference(session.client_reference_id)
  if (!id) {
    const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase()
    if (!email) return NextResponse.json({ ignored: "no application" })
    id = (await listApplications()).find((a) => a.status === "approved" && a.email === email)?.id ?? null
    if (!id) return NextResponse.json({ ignored: "no application" })
  }
  try {
    return NextResponse.json({ onboarded: await onboardPaid(id) })
  } catch (error) {
    console.error("[membership] onboarding failed:", error)
    // Stripe retries on a 5xx: the email goes out once it works.
    return NextResponse.json({ error: "Could not send the onboarding email" }, { status: 500 })
  }
}
