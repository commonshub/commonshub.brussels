import { NextResponse } from "next/server"
import Stripe from "stripe"

import { attributionName, isEmail } from "@/lib/fridge-thanks"
import { subscribeToNewsletter } from "@/lib/paragraph"

export const dynamic = "force-dynamic"

/** How long after paying the donor can still choose how to be thanked. */
const WINDOW_SEC = 7 * 86_400

/**
 * After a fridge donation: how the donor wants to be thanked in public, and
 * the newsletter. The checkout session (its id is in the thank-you link
 * Stripe redirected to) must be a paid fridge donation of the past week; the
 * choice is kept on its payment (metadata `thanks`, and `name` when a name is
 * shown). The email for the newsletter goes to Paragraph only.
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: "Not available right now" }, { status: 503 })

  let body: { sessionId?: unknown; show?: unknown; other?: unknown; newsletter?: unknown; email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  if (typeof body.sessionId !== "string" || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(body.sessionId)) {
    return NextResponse.json({ error: "Unknown donation" }, { status: 400 })
  }
  const wantsNewsletter = body.newsletter === true
  if (wantsNewsletter && !isEmail(body.email)) return NextResponse.json({ error: "That email address does not look right" }, { status: 400 })

  const stripe = new Stripe(secretKey)
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(body.sessionId)
  } catch {
    return NextResponse.json({ error: "Unknown donation" }, { status: 404 })
  }
  if (session.metadata?.kind !== "fridge" || session.payment_status !== "paid" || Date.now() / 1000 - session.created > WINDOW_SEC) {
    return NextResponse.json({ error: "Unknown donation" }, { status: 404 })
  }

  const name = attributionName(body.show, session.customer_details?.name, body.other)
  if (name === undefined) return NextResponse.json({ error: "Pick how you want to be thanked (a name of 2 to 40 characters)" }, { status: 400 })

  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
  if (!intentId) return NextResponse.json({ error: "Unknown donation" }, { status: 404 })
  try {
    // An empty value removes the key: choosing not to be named takes a name given earlier away.
    await stripe.paymentIntents.update(intentId, { metadata: { thanks: String(body.show), name: name ?? "" } })
  } catch (error) {
    console.error("[fridge] could not record the thanks choice:", error)
    return NextResponse.json({ error: "Could not save your choice, please try again" }, { status: 502 })
  }

  const newsletter = wantsNewsletter ? ((await subscribeToNewsletter((body.email as string).trim().toLowerCase())) ? "subscribed" : "failed") : "no"
  return NextResponse.json({ ok: true, name, newsletter })
}
