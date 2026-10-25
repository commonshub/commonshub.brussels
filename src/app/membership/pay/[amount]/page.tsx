import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import QRCode from "qrcode"

import { BankTransferDetails } from "@/components/bank-transfer-details"
import { epcQrPayload } from "@/lib/bank-details"
import { YEARLY_PRICES } from "@/lib/membership-application"

export const metadata: Metadata = {
  title: "Pay your membership by bank transfer | Commons Hub Brussels",
  robots: { index: false },
}

/** The transfer's message: the application's opaque id when we have it, so we can match the transfer to it. */
const membershipCommunication = (ref: string | null) => (ref ? `Membership ${ref}` : "Membership Commons Hub")

/**
 * /membership/pay/100|150|200: a year's membership by bank transfer, from
 * the acceptance email. Every detail with a copy button, and a QR code that
 * fills in the transfer in a banking app. `?ref=` is the application's id
 * (never a name or an email address).
 */
export default async function PayMembershipPage({ params, searchParams }: { params: Promise<{ amount: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { amount: raw } = await params
  const price = YEARLY_PRICES.find((p) => String(p.amount) === raw)
  if (!price) notFound()
  const { ref: rawRef } = await searchParams
  const ref = typeof rawRef === "string" && /^[\w-]{6,40}$/.test(rawRef) ? rawRef : null
  const message = membershipCommunication(ref)
  const qr = await QRCode.toString(epcQrPayload(price.amount, message), { type: "svg", errorCorrectionLevel: "M", margin: 0 })

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-12">
      <h1 className="text-3xl font-extrabold text-foreground">Your membership for a year</h1>
      <p className="mt-2 text-muted-foreground">
        <span className="font-semibold text-foreground">€{price.amount}</span> ({price.label.toLowerCase()}), by bank transfer. Scan the code with your banking app, or copy each detail.
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-6">
        <div className="w-48 rounded-xl bg-white p-3" role="img" aria-label="QR code for your banking app, with every detail filled in" dangerouslySetInnerHTML={{ __html: qr }} />
        <BankTransferDetails amountEur={price.amount} message={message} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {ref ? "Please keep the message exactly as it is: it's how we match your transfer to your membership." : "In the message, please add your name, so we know who the transfer is from."}{" "}Transfers take one or two working days; we&apos;ll email you once it has arrived.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-2" aria-label="Other amounts">
        {YEARLY_PRICES.map((p) => (
          <Link
            key={p.amount}
            href={`/membership/pay/${p.amount}${ref ? `?ref=${ref}` : ""}`}
            aria-current={p.amount === price.amount ? "page" : undefined}
            className={`rounded-xl border-2 px-2 py-2 text-center text-sm transition ${p.amount === price.amount ? "border-primary bg-primary/10 font-bold text-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}
          >
            <span className="block text-base font-semibold text-foreground">€{p.amount}</span>
            <span className="block text-xs">{p.label}</span>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Pay what fits your income and situation.</p>
    </div>
  )
}
