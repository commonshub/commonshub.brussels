import type { Metadata } from "next"
import QRCode from "qrcode"
import Stripe from "stripe"

import { BANK_DETAILS, epcQrPayload, formatIban } from "@/lib/bank-details"
import { bankCommunication, MONTHLY_LINK, verifyRenew, YEARLY_AMOUNT } from "@/lib/membership-reminder"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Renew your membership | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * Where the membership reminder email leads: three ways to continue. The
 * link is signed by the site (lib/membership-reminder.ts) and says who the
 * member is, so "Resume or update my card" opens their own Stripe portal and
 * the bank transfer shows their own communication.
 */
export default async function RenewMembershipPage({ searchParams }: { searchParams: Promise<{ t?: string; portal?: string }> }) {
  const { t, portal } = await searchParams
  const claim = t ? verifyRenew(t) : null

  async function openPortal(formData: FormData) {
    "use server"
    const { redirect } = await import("next/navigation")
    const token = String(formData.get("t") ?? "")
    const c = verifyRenew(token)
    const key = process.env.STRIPE_SECRET_KEY
    if (!c?.c || !key) redirect(`/membership/renew?t=${encodeURIComponent(token)}&portal=unavailable`)
    let url: string | null = null
    try {
      const session = await new Stripe(key!).billingPortal.sessions.create({ customer: c!.c!, return_url: "https://commonshub.brussels/membership" })
      url = session.url
    } catch (error) {
      console.error("[renew] could not open the Stripe portal:", error)
    }
    redirect(url ?? `/membership/renew?t=${encodeURIComponent(token)}&portal=unavailable`)
  }

  if (!claim) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <h1 className="text-3xl font-bold text-foreground">Renew your membership</h1>
        <p className="mt-4 text-muted-foreground">
          This link has expired. You can become a member again on <a href="/membership" className="underline">our membership page</a>, or reply to the email you received.
        </p>
      </div>
    )
  }

  const amount = claim.o ? YEARLY_AMOUNT.organisation : YEARLY_AMOUNT.individual
  const communication = bankCommunication(claim)
  const qr = await QRCode.toString(epcQrPayload(amount, communication), { type: "svg", errorCorrectionLevel: "M", margin: 0 })
  const rows: Array<[string, string]> = [
    ["Beneficiary", BANK_DETAILS.beneficiary],
    ["IBAN", formatIban(BANK_DETAILS.iban)],
    ["BIC", BANK_DETAILS.bic],
    ["Amount", `€${amount}`],
    ["Communication", communication],
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="text-3xl font-bold text-foreground">Welcome back, {claim.n}</h1>
      <p className="mt-3 text-muted-foreground">Memberships are how we keep this common space open. Pick what suits you.</p>

      <section className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">1. Resume, or update your card</h2>
        <p className="mt-1 text-sm text-muted-foreground">Restart your subscription, change your card or switch plans.</p>
        {portal === "unavailable" && <p className="mt-3 text-sm text-destructive">We couldn’t open your card settings. Start a new membership below, or pay by bank transfer.</p>}
        {claim.c ? (
          <form action={openPortal} className="mt-4">
            <input type="hidden" name="t" value={t} />
            <button type="submit" className="h-11 rounded-lg bg-primary px-5 font-semibold text-primary-foreground">
              Renew my membership
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">You didn’t pay by card before: start a new membership below.</p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">2. Start a new monthly membership</h2>
        <p className="mt-1 text-sm text-muted-foreground">€10 a month, by card or Bancontact, cancel any time.</p>
        <a href={MONTHLY_LINK} className="mt-4 inline-flex h-11 items-center rounded-lg border border-border px-5 font-semibold text-foreground">
          Become a member again
        </a>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">3. Pay a year by bank transfer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          €{amount} for a year{claim.o ? " (organisation)" : ""}. Use exactly this communication, so we can match your transfer to your membership.
        </p>
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
          <dl className="min-w-0 flex-1 space-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-all font-mono font-semibold text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="w-40 shrink-0 rounded-lg bg-white p-2" aria-label="QR code for your banking app" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </section>
    </div>
  )
}
