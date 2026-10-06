/**
 * The renewal page's Stripe side (/membership/renew): the member's recent
 * payments (so they see which one failed), a new monthly subscription by
 * card, and — once that is paid — cancelling the old one, so a card that
 * starts working again can't charge them twice and Stripe stops sending
 * failed-payment emails.
 *
 * Server only. The member is known from the signed renew link: only their
 * own Stripe customer is ever read.
 */

import Stripe from "stripe"

import settings from "@/settings/settings.json"

const PRODUCT = settings.membership.stripe.productId
/** €10 a month, the default when we don't know what they paid before. */
const DEFAULT_MONTHLY_PRICE = "price_1PjHIHFAhaWeDyowVGxd77G6"

function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  return key ? new Stripe(key) : null
}

export interface RecentPayment {
  /** ISO date. */
  date: string
  amount: number
  status: "paid" | "failed" | "pending"
}

/** The member's last membership invoices, newest first. */
export async function recentPayments(customerId: string, limit = 6): Promise<RecentPayment[]> {
  const s = stripe()
  if (!s) return []
  const invoices = await s.invoices.list({ customer: customerId, limit: 20 })
  return invoices.data
    .filter((i) => i.amount_due > 0 && i.status !== "draft" && i.status !== "void")
    .slice(0, limit)
    .map((i) => ({
      date: new Date((i.status_transitions?.paid_at ?? i.created) * 1000).toISOString(),
      amount: (i.status === "paid" ? i.amount_paid : i.amount_due) / 100,
      status: i.status === "paid" ? "paid" : (i.attempt_count ?? 0) > 0 || i.status === "uncollectible" ? "failed" : "pending",
    }))
}

/** The monthly price they had before (same amount again), else €10. */
export async function monthlyPriceFor(customerId: string | undefined): Promise<{ id: string; amount: number }> {
  const s = stripe()
  const fallback = { id: DEFAULT_MONTHLY_PRICE, amount: 10 }
  if (!s || !customerId) return fallback
  try {
    const subs = await s.subscriptions.list({ customer: customerId, status: "all", limit: 10 })
    for (const sub of subs.data) {
      const price = sub.items.data[0]?.price
      if (price && price.product === PRODUCT && price.recurring?.interval === "month" && price.active && price.unit_amount) return { id: price.id, amount: price.unit_amount / 100 }
    }
  } catch (error) {
    console.error("[renew] could not read previous subscriptions:", error)
  }
  return fallback
}

/** A Checkout for a new monthly membership, on the same Stripe customer when we know it. */
export async function monthlyCheckoutUrl(customerId: string | undefined, origin: string, token: string): Promise<string> {
  const s = stripe()
  if (!s) throw new Error("Card payments are not available right now")
  const price = await monthlyPriceFor(customerId)
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    ...(customerId ? { customer: customerId } : {}),
    metadata: { kind: "membership-renewal" },
    success_url: `${origin}/membership/renew/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/membership/renew?t=${encodeURIComponent(token)}`,
  })
  if (!session.url) throw new Error("Stripe did not return a checkout page")
  return session.url
}

/**
 * After a renewal Checkout: if it is paid, cancel the customer's other
 * membership subscriptions (the one that kept failing). Returns the new
 * subscription's monthly amount, or null when the session is not complete.
 */
export async function completeRenewal(sessionId: string): Promise<{ amount: number; cancelled: number } | null> {
  const s = stripe()
  if (!s || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) return null
  const session = await s.checkout.sessions.retrieve(sessionId)
  if (session.status !== "complete" || session.mode !== "subscription" || session.metadata?.kind !== "membership-renewal") return null
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id
  const newSub = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
  let cancelled = 0
  if (customer && newSub) {
    const subs = await s.subscriptions.list({ customer, status: "all", limit: 20 })
    for (const sub of subs.data) {
      const isMembership = sub.items.data.some((it) => it.price.product === PRODUCT)
      if (sub.id === newSub || !isMembership || !["active", "past_due", "unpaid", "incomplete", "paused", "trialing"].includes(sub.status)) continue
      await s.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false })
      cancelled++
    }
  }
  return { amount: (session.amount_total ?? 0) / 100, cancelled }
}
