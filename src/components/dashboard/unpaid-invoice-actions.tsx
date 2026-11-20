"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarRange, CreditCard, Landmark, Loader2 } from "lucide-react"

async function post(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api/hub/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong, please try again.")
  return data
}

const BTN = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition disabled:opacity-50"

/**
 * Pay an unpaid invoice: by card (Stripe Checkout for what's left, amount from Odoo), or by transfer
 * (/pay, filled in). `switchYearly`: the invoice of a monthly coworking subscription: switch to a
 * year at once instead (the unpaid month is credited, the year invoiced, two months free).
 */
export function UnpaidInvoiceActions({ invoice, switchYearly, readOnly }: { invoice: { id: number; due: number; communication: string }; switchYearly: string | null; readOnly?: boolean }) {
  const [busy, setBusy] = useState<"card" | "year" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const router = useRouter()
  const transfer = `/pay?amount=${invoice.due.toFixed(2)}&communication=${encodeURIComponent(invoice.communication)}`

  async function card() {
    setError(null)
    setBusy("card")
    try {
      window.location.href = (await post("payinvoice", { invoiceId: String(invoice.id) })).checkoutUrl
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }
  async function yearly() {
    setError(null)
    setBusy("year")
    try {
      await post("switchyearly")
      setConfirming(false)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <fieldset disabled={readOnly || busy !== null} className="mt-3 min-w-0">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={card} className={`${BTN} bg-primary text-primary-foreground hover:opacity-90`}>
          {busy === "card" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {switchYearly ? "Pay this month by card" : "Pay by card"}
        </button>
        {readOnly ? (
          <span className={`${BTN} border-2 border-primary text-primary opacity-50`}>
            <Landmark className="h-4 w-4" /> By transfer
          </span>
        ) : (
          <Link href={transfer} className={`${BTN} border-2 border-primary text-primary hover:bg-primary/5`}>
            <Landmark className="h-4 w-4" /> By transfer
          </Link>
        )}
        {switchYearly && !confirming && (
          <button type="button" onClick={() => setConfirming(true)} className={`${BTN} border-2 border-primary text-primary hover:bg-primary/5`}>
            <CalendarRange className="h-4 w-4" /> Pay the year instead
          </button>
        )}
      </div>
      {switchYearly && confirming && (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
          <p className="text-foreground">
            Switch {switchYearly} to yearly: €1,000 + VAT (€1,210) for the year, two months free. This invoice is cancelled with a credit note and the year is invoiced from the same date, payable by card or transfer.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={yearly} className={`${BTN} bg-primary text-primary-foreground hover:opacity-90`}>
              {busy === "year" && <Loader2 className="h-4 w-4 animate-spin" />} Switch to yearly
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={`${BTN} text-muted-foreground hover:text-foreground`}>
              Keep monthly
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </fieldset>
  )
}
