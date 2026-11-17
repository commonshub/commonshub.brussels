import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Paid | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * Where Stripe Checkout comes back after paying a booking's invoice by card
 * (lib/invoice-payment.ts). The booking was made before the payment; this
 * only says thank you. The payment reaches the invoice in our books with
 * chb's Stripe sync, by the invoice number.
 */
export default async function BookingPaidPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const { invoice } = await searchParams
  const number = invoice && /^[\w/ -]{1,40}$/.test(invoice) ? invoice : null
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-24">
      <CheckCircle2 className="h-10 w-10 text-green-700 dark:text-green-400" aria-hidden />
      <h1 className="mt-4 text-3xl font-extrabold text-foreground">Paid, thank you</h1>
      <p className="mt-3 text-muted-foreground">
        {number ? (
          <>
            Invoice <span className="font-semibold text-foreground">{number}</span> is paid.{" "}
          </>
        ) : (
          "Your invoice is paid. "
        )}
        Stripe emails you a receipt, and the invoice was sent to the address you gave for it. Your booking is confirmed.
      </p>
      <Link href="/" className="mt-6 inline-block text-primary underline underline-offset-2">
        Back to the Commons Hub
      </Link>
    </div>
  )
}
