import type { Metadata } from "next"
import { headers } from "next/headers"
import QRCode from "qrcode"

import { BANK_DETAILS, epcQrPayload, formatIban } from "@/lib/bank-details"
import { bankCommunication, verifyRenew, YEARLY_AMOUNT } from "@/lib/membership-reminder"
import { monthlyCheckoutUrl, monthlyPriceFor, recentPayments, type RecentPayment } from "@/lib/membership-renewal"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Renew your membership | Commons Hub Brussels",
  robots: { index: false },
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Brussels" })
const STATUS: Record<RecentPayment["status"], { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-green-700 dark:text-green-400" },
  failed: { label: "Failed", className: "font-semibold text-destructive" },
  pending: { label: "Pending", className: "text-muted-foreground" },
}

/**
 * Where the membership reminder email leads. Kept simple on purpose: the
 * member's recent payments (so they see the one that failed), then two
 * choices — pay monthly by card (a new Stripe subscription; the failing one
 * is cancelled once it's paid) or pay a year by bank transfer. The link is
 * signed (lib/membership-reminder.ts): only this member's own payments are
 * shown.
 */
export default async function RenewMembershipPage({ searchParams }: { searchParams: Promise<{ t?: string; error?: string }> }) {
  const { t, error } = await searchParams
  const claim = t ? verifyRenew(t) : null

  async function payMonthly(formData: FormData) {
    "use server"
    const { redirect } = await import("next/navigation")
    const token = String(formData.get("t") ?? "")
    const c = verifyRenew(token)
    if (!c) redirect("/membership/renew")
    const host = (await headers()).get("host") ?? "commonshub.brussels"
    const origin = host.startsWith("localhost") ? `http://${host}` : `https://${host}`
    let url: string | null = null
    try {
      url = await monthlyCheckoutUrl(c!.c, origin, token)
    } catch (e) {
      console.error("[renew] could not start the checkout:", e)
    }
    redirect(url ?? `/membership/renew?t=${encodeURIComponent(token)}&error=card`)
  }

  if (!claim) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <h1 className="text-3xl font-bold text-foreground">Renew your membership</h1>
        <p className="mt-4 text-muted-foreground">
          This link has expired. You can become a member again on{" "}
          <a href="/membership" className="underline">
            our membership page
          </a>
          , or reply to the email you received.
        </p>
      </div>
    )
  }

  const [payments, monthly] = await Promise.all([claim.c ? recentPayments(claim.c).catch(() => []) : Promise.resolve([]), monthlyPriceFor(claim.c)])
  const failed = payments.find((p) => p.status === "failed")
  const yearly = claim.o ? YEARLY_AMOUNT.organisation : YEARLY_AMOUNT.individual
  const communication = bankCommunication(claim)
  const qr = await QRCode.toString(epcQrPayload(yearly, communication), { type: "svg", errorCorrectionLevel: "M", margin: 0 })

  return (
    <div className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="text-3xl font-bold text-foreground">Hi {claim.n}</h1>
      <p className="mt-3 text-muted-foreground">
        {failed ? `Your membership payment of ${date(failed.date)} didn’t go through.` : "Your membership needs renewing."} Memberships are how we keep this common space open: thank you for
        staying with us.
      </p>

      {payments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your recent payments</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {payments.map((p) => (
              <li key={p.date + p.amount} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-foreground">{date(p.date)}</span>
                <span className="flex items-center gap-4">
                  <span className="tabular-nums text-foreground">€{p.amount.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(p.amount) ? 0 : 2 })}</span>
                  <span className={`w-16 text-right ${STATUS[p.status].className}`}>{STATUS[p.status].label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mt-10 text-xl font-bold text-foreground">How would you like to pay?</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {!claim.o && (
          <section className="flex flex-col rounded-xl border-2 border-primary bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">Monthly, by card</h3>
            <p className="mt-1 text-3xl font-bold text-foreground">
              €{monthly.amount}
              <span className="text-base font-normal text-muted-foreground"> / month</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Enter your card once more; cancel any time.{claim.c ? " Your old subscription stops when the new one starts." : ""}</p>
            {error === "card" && <p className="mt-2 text-sm text-destructive">Card payment isn’t available right now. Please pay by bank transfer, or try again later.</p>}
            <form action={payMonthly} className="mt-auto pt-5">
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="h-11 w-full rounded-lg bg-primary px-5 font-semibold text-primary-foreground">
                Pay €{monthly.amount} a month
              </button>
            </form>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">Yearly, by bank transfer</h3>
          <p className="mt-1 text-3xl font-bold text-foreground">
            €{yearly}
            <span className="text-base font-normal text-muted-foreground"> / year{claim.o ? " (organisation)" : ""}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Use exactly this communication, so we can match your transfer to your membership.</p>
          <dl className="mt-4 space-y-2 text-sm">
            {(
              [
                ["Beneficiary", BANK_DETAILS.beneficiary],
                ["IBAN", formatIban(BANK_DETAILS.iban)],
                ["Amount", `€${yearly}`],
                ["Communication", communication],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="break-all font-mono font-semibold text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 w-36 rounded-lg bg-white p-2" aria-label="QR code for your banking app" dangerouslySetInnerHTML={{ __html: qr }} />
        </section>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Questions, or would you rather stop? Just reply to the email you received.</p>
    </div>
  )
}
