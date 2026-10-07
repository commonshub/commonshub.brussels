import { NextResponse } from "next/server"
import Stripe from "stripe"

import settings from "@/settings/settings.json"
import { THANKS_FIELD } from "@/lib/donor-thanks"

import { FRIDGE, loadLatestDelivery, orderSummary, publicName } from "@/lib/fridge"

// Reads the dataset volume: never prerender.
export const dynamic = "force-dynamic"

const MIN_EUR = 1
const MAX_EUR = 500

/**
 * A donation to the fridge by card: for drinks taken, or a whole crate for
 * the community. The drinks are free; what is paid is a donation, so the
 * amount is the donor's. The order is rebuilt from the current delivery and
 * kept in the metadata only; the description stays short, like a transfer.
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: "Online payment is not configured" }, { status: 503 })

  let body: { items?: Array<{ id?: unknown; quantity?: unknown }>; crate?: unknown; amount?: unknown; name?: unknown }
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
  let metadata: Record<string, string>
  if (typeof body.crate === "string") {
    const drink = byId.get(body.crate)
    if (!drink) return NextResponse.json({ error: "Unknown drink" }, { status: 400 })
    if (amount < drink.crateCost) return NextResponse.json({ error: `A crate of ${drink.name} costs €${drink.crateCost.toFixed(2)}` }, { status: 400 })
    const name = publicName(body.name)
    description = FRIDGE.crateTransferMessage
    metadata = { kind: "fridge", crate: "yes", drink: `${drink.perCrate} × ${drink.name}`, delivery: delivery.number, ...(name ? { name } : {}) }
  } else {
    const items = (body.items ?? [])
      .map((i) => ({ drink: byId.get(String(i.id)), quantity: Math.floor(Number(i.quantity)) }))
      .filter((i): i is { drink: NonNullable<typeof i.drink>; quantity: number } => !!i.drink && i.quantity > 0 && i.quantity <= 50)
    if (items.length === 0) return NextResponse.json({ error: "Nothing selected" }, { status: 400 })
    description = FRIDGE.transferMessage
    metadata = { kind: "fridge", order: orderSummary(items).slice(0, 450), delivery: delivery.number }
  }

  const origin = new URL(request.url).origin
  try {
    const session = await new Stripe(secretKey).checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      // No email to type for a drink: Checkout asks for one unless it is given, so it is the hub's own
      // (receipts, if any, come to us). Only a membership needs the member's email.
      customer_email: settings.email.to,
      custom_fields: [THANKS_FIELD],
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: Math.round(amount * 100), product_data: { name: "Donation to the Commons Hub fridge", description } } }],
      metadata,
      payment_intent_data: { description, metadata },
      success_url: `${origin}/fridge?thanks=${metadata.crate ? "crate" : "1"}`,
      cancel_url: `${origin}/fridge`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("[fridge] could not create a checkout session:", error)
    // A key Stripe refuses (e.g. missing permissions) will keep failing: say so, and point to the transfer.
    if (error instanceof Stripe.errors.StripePermissionError || error instanceof Stripe.errors.StripeAuthenticationError) {
      return NextResponse.json({ error: "Card payments are unavailable right now. Please use the bank transfer details instead." }, { status: 503 })
    }
    return NextResponse.json({ error: "Could not start the payment" }, { status: 502 })
  }
}
