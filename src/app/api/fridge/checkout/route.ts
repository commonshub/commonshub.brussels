import { NextResponse } from "next/server"
import Stripe from "stripe"

import { loadLatestDelivery, orderSummary } from "@/lib/fridge"

// Reads the dataset volume: never prerender.
export const dynamic = "force-dynamic"

const MIN_EUR = 1
const MAX_EUR = 500

/**
 * Pay for drinks from the fridge, or offer a crate, by card. The order is
 * rebuilt from the current delivery so the description comes from our books,
 * not from the request; the amount is the visitor's (pay what you want).
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: "Online payment is not configured" }, { status: 503 })

  let body: { items?: Array<{ id?: unknown; quantity?: unknown }>; crate?: unknown; amount?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  const amount = Math.round(Number(body.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount < MIN_EUR || amount > MAX_EUR) {
    return NextResponse.json({ error: `Amount must be between €${MIN_EUR} and €${MAX_EUR}` }, { status: 400 })
  }

  const delivery = loadLatestDelivery()
  if (!delivery) return NextResponse.json({ error: "The fridge list is not available" }, { status: 404 })
  const byId = new Map(delivery.drinks.map((d) => [d.id, d]))

  let description: string
  if (typeof body.crate === "string") {
    const drink = byId.get(body.crate)
    if (!drink) return NextResponse.json({ error: "Unknown drink" }, { status: 400 })
    description = `Fridge: a crate of ${drink.name} for the community`
  } else {
    const items = (body.items ?? [])
      .map((i) => ({ drink: byId.get(String(i.id)), quantity: Math.floor(Number(i.quantity)) }))
      .filter((i): i is { drink: NonNullable<typeof i.drink>; quantity: number } => !!i.drink && i.quantity > 0 && i.quantity <= 50)
    if (items.length === 0) return NextResponse.json({ error: "Nothing selected" }, { status: 400 })
    description = `Fridge: ${orderSummary(items)}`
  }
  description = description.length > 200 ? `${description.slice(0, 199)}…` : description

  const origin = new URL(request.url).origin
  try {
    const session = await new Stripe(secretKey).checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: Math.round(amount * 100), product_data: { name: "Commons Hub fridge", description } } }],
      metadata: { kind: "fridge", delivery: delivery.number },
      payment_intent_data: { description, metadata: { kind: "fridge", delivery: delivery.number } },
      success_url: `${origin}/fridge?thanks=1`,
      cancel_url: `${origin}/fridge`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[fridge] could not create a checkout session:", error)
    return NextResponse.json({ error: "Could not start the payment" }, { status: 502 })
  }
}
