import { NextResponse } from "next/server"
import Stripe from "stripe"

import { findExpense, loadContributeExpenses } from "@/lib/contribute-expenses"
import { MAX_CONTRIBUTION_EUR, MIN_CONTRIBUTION_EUR } from "@/lib/contribute"

// Looks the expense up in DATA_DIR: never prerender.
export const dynamic = "force-dynamic"

/**
 * Start a Stripe Checkout for one expense at the amount the visitor chose,
 * once or — for a recurring cost, when asked — every month, as a
 * subscription. The expense is looked up server-side so the label and
 * reference on the payment come from our books, not from the request.
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: "Online payment is not configured" }, { status: 503 })
  }

  let body: { slug?: unknown; amount?: unknown; monthly?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const slug = typeof body.slug === "string" ? body.slug : ""
  const amount = Math.round(Number(body.amount))
  if (!slug || !Number.isFinite(amount) || amount < MIN_CONTRIBUTION_EUR || amount > MAX_CONTRIBUTION_EUR) {
    return NextResponse.json(
      { error: `Amount must be between €${MIN_CONTRIBUTION_EUR} and €${MAX_CONTRIBUTION_EUR}` },
      { status: 400 },
    )
  }

  const expense = findExpense(slug, loadContributeExpenses())
  if (!expense) {
    return NextResponse.json({ error: "Unknown expense" }, { status: 404 })
  }

  // A one-time bill is paid once; only a recurring cost can be taken on monthly.
  const monthly = body.monthly === true && expense.kind === "recurring"
  const origin = new URL(request.url).origin
  const stripe = new Stripe(secretKey)
  const metadata = { expense: expense.slug, reference: expense.reference, kind: expense.kind, monthly: monthly ? "yes" : "no" }

  try {
    if (monthly) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: amount * 100,
              recurring: { interval: "month" },
              product_data: { name: `Monthly contribution: ${expense.label}` },
            },
          },
        ],
        metadata,
        subscription_data: { description: expense.message, metadata },
        success_url: `${origin}/contribute/${expense.slug}?thanks=monthly`,
        cancel_url: `${origin}/contribute/${expense.slug}`,
      })
      return NextResponse.json({ url: session.url })
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amount * 100,
            product_data: {
              name: `Contribution: ${expense.label}`,
              description: expense.message,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        description: expense.message,
        metadata: { expense: expense.slug, reference: expense.reference },
      },
      success_url: `${origin}/contribute/${expense.slug}?thanks=1`,
      cancel_url: `${origin}/contribute/${expense.slug}`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[contribute] could not create a checkout session:", error)
    return NextResponse.json({ error: "Could not start the payment" }, { status: 502 })
  }
}
