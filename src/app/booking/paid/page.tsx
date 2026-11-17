import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import Stripe from "stripe"
import { CheckCircle2 } from "lucide-react"

import { auth } from "@/auth"
import { botIdentity, callTokenBot } from "@/lib/token-bot"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Paid | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * Where Stripe Checkout comes back after paying a booking's invoice by card
 * (lib/invoice-payment.ts). The Checkout session is checked with Stripe (the
 * sandbox for a test user); when it is paid, the bot notes the payment, so the
 * dashboard shows the booking as paid before chb's Stripe sync reaches Odoo,
 * and we go to the dashboard. Without a session we can check, a thank-you.
 */
export default async function BookingPaidPage({ searchParams }: { searchParams: Promise<{ invoice?: string; session_id?: string }> }) {
  const { invoice, session_id } = await searchParams
  const number = invoice && /^[\w/ -]{1,40}$/.test(invoice) ? invoice : null
  const session = await auth()
  const who = botIdentity(session?.user)
  const key = who && typeof who !== "string" ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY
  if (who && key && session_id && /^cs_[\w]{10,200}$/.test(session_id)) {
    const checkout = await new Stripe(key).checkout.sessions.retrieve(session_id).catch(() => null)
    const invoiceId = Number(checkout?.metadata?.odooInvoiceId)
    if (checkout?.payment_status === "paid" && invoiceId > 0) {
      await callTokenBot("paid", who, { invoiceId, sessionId: session_id })
      redirect(`/?paid=${encodeURIComponent(checkout.metadata?.invoice ?? number ?? "")}`)
    }
  }
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
