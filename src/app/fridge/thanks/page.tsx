import type { Metadata } from "next"
import Link from "next/link"
import Stripe from "stripe"

import settings from "@/settings/settings.json"
import { ThanksForm } from "@/components/fridge/thanks-form"
import { attributionOptions } from "@/lib/fridge-thanks"
import { isParagraphConfigured } from "@/lib/paragraph"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Thank you | The fridge | Commons Hub Brussels",
  robots: { index: false },
}

const eur = (cents: number) => new Intl.NumberFormat("en-BE", { style: "currency", currency: "EUR" }).format(cents / 100)

/** Where Stripe sends a fridge donor after paying: thanks, how to be thanked in public, and the newsletter. */
export default async function FridgeThanksPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams
  let session: Stripe.Checkout.Session | null = null
  if (sessionId && /^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId) && process.env.STRIPE_SECRET_KEY) {
    try {
      session = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(sessionId)
    } catch {
      session = null
    }
  }
  const paid = session?.metadata?.kind === "fridge" && session.payment_status === "paid"
  const crate = session?.metadata?.crate === "yes"

  return (
    <div className="mx-auto max-w-lg px-4 pb-10 pt-6">
      {paid && session ? (
        <>
          <div className="text-4xl">🍻</div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Thank you for your donation!</h1>
          <p className="mt-1 text-muted-foreground">
            {eur(session.amount_total ?? 0)} {crate ? `for a crate of ${session.metadata?.drink ?? "drinks"}: everyone can help themselves.` : "to keep the fridge stocked. Enjoy your drink."}
          </p>
          <ThanksForm
            sessionId={session.id}
            options={attributionOptions(session.customer_details?.name)}
            newsletter={isParagraphConfigured() ? "form" : "link"}
            subscribeUrl={settings.newsletter.subscribeUrl}
          />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-foreground">Thank you!</h1>
          <p className="mt-1 text-muted-foreground">We could not find this donation. If you paid, it went through: thank you.</p>
        </>
      )}
      <Link href="/fridge" className="mt-8 inline-block text-sm text-muted-foreground underline-offset-2 hover:underline">
        ← Back to the fridge
      </Link>
    </div>
  )
}
