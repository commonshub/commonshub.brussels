import Stripe from "stripe"

/**
 * How a donor wants to be thanked in public, if at all. Every donation
 * checkout on the site asks (THANKS_FIELD); the answer stays in Stripe, and
 * the only thing that ever leaves it is the name as the donor chose to show
 * it: nothing, their first name, or their full name. Bank transfers cannot
 * ask, so they are never named.
 */
export type ThanksChoice = "anonymous" | "first" | "full"

export const THANKS_FIELD: Stripe.Checkout.SessionCreateParams.CustomField = {
  key: "thanks",
  label: { type: "custom", custom: "Thank you publicly as" },
  type: "dropdown",
  optional: true,
  dropdown: {
    default_value: "anonymous",
    options: [
      { label: "Don't show my name", value: "anonymous" },
      { label: "My first name", value: "first" },
      { label: "My full name", value: "full" },
    ],
  },
}

/** The name to show for a choice, from the name the donor paid with. */
export function thanksName(choice: string | null | undefined, fullName: string | null | undefined): string | null {
  const name = (fullName ?? "").trim().replace(/\s+/g, " ")
  if (!name) return null
  if (choice === "full") return name
  if (choice === "first") return name.split(" ")[0]
  return null
}

export interface StripeThanks {
  /** Seconds. */
  created: number
  /** Cents. */
  amount: number
  /** As the donor chose to be shown; null for no name. */
  name: string | null
}

const TTL_MS = 10 * 60 * 1000
let cache: { at: number; since: number; list: StripeThanks[] } | null = null

/** Completed donation checkouts since a time, with the name each donor chose to show (if any). */
export async function loadStripeThanks(sinceSec: number): Promise<StripeThanks[] | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null
  if (cache && cache.since <= sinceSec && Date.now() - cache.at < TTL_MS) return cache.list
  try {
    const sessions = await new Stripe(secretKey).checkout.sessions.list({ created: { gte: sinceSec }, status: "complete", limit: 100, expand: ["data.payment_intent"] })
    const list = sessions.data
      .filter((s) => s.payment_status === "paid")
      .map((s) => {
        const choice = s.custom_fields?.find((f) => f.key === "thanks")?.dropdown?.value
        // A fridge donor chooses after paying (fridge-thanks): kept on the payment, it is what they want shown.
        const after = typeof s.payment_intent === "object" ? s.payment_intent?.metadata : undefined
        const name = after?.thanks ? after.name?.trim() || null : s.metadata?.name?.trim() || thanksName(choice, s.customer_details?.name)
        return { created: s.created, amount: s.amount_total ?? 0, name }
      })
    cache = { at: Date.now(), since: sinceSec, list }
    return list
  } catch (error) {
    console.error("[donor-thanks] could not list checkout sessions:", error)
    return cache?.list ?? null
  }
}
