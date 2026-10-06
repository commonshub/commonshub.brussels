import type { Metadata } from "next"
import Link from "next/link"

import { completeRenewal } from "@/lib/membership-renewal"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Membership renewed | Commons Hub Brussels",
  robots: { index: false },
}

/** Back from Stripe after a renewal: confirm, and cancel the subscription that kept failing. */
export default async function RenewalDonePage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams
  const result = session_id ? await completeRenewal(session_id).catch((e) => (console.error("[renew] could not complete:", e), null)) : null
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      {result ? (
        <>
          <h1 className="text-3xl font-bold text-foreground">Thank you!</h1>
          <p className="mt-4 text-muted-foreground">
            Your membership is renewed{result.amount ? ` at €${result.amount} a month` : ""}.{result.cancelled > 0 ? " Your old subscription is cancelled, so you won’t be charged twice." : ""} See you at the hub!
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-foreground">Almost there</h1>
          <p className="mt-4 text-muted-foreground">We couldn’t confirm the payment yet. If you completed it, you’ll get a receipt from Stripe by email.</p>
        </>
      )}
      <p className="mt-6">
        <Link href="/" className="underline">
          Back to the Commons Hub
        </Link>
      </p>
    </div>
  )
}
