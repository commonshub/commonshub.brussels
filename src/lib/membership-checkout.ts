import Stripe from "stripe"

import { applicationIdFromReference, PAYMENT_LINK_ID } from "./membership-application"
import { listApplications } from "./membership-applications-store"

/** The application a membership checkout pays for: by its client_reference_id, else by the payer's email (accepted or paid applications). */
export async function applicationForSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const fromReference = applicationIdFromReference(session.client_reference_id)
  if (fromReference) return fromReference
  const email = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase()
  if (!email || session.payment_link !== PAYMENT_LINK_ID) return null
  return (await listApplications()).find((a) => (a.status === "approved" || a.status === "member") && a.email === email)?.id ?? null
}

/** A paid membership checkout, from the id Stripe puts in the redirect after paying; null if it isn't one. */
export async function paidMembershipSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey || !/^cs_(live|test)_[\w]{10,200}$/.test(sessionId)) return null
  try {
    const session = await new Stripe(apiKey).checkout.sessions.retrieve(sessionId)
    const paid = session.payment_status === "paid" || session.status === "complete"
    const membership = session.payment_link === PAYMENT_LINK_ID || !!applicationIdFromReference(session.client_reference_id)
    return paid && membership ? session : null
  } catch {
    return null
  }
}
