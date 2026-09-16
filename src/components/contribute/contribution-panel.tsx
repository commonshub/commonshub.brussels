"use client"

import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import { CreditCard, Landmark, Loader2 } from "lucide-react"

import { BankTransferDetails } from "@/components/bank-transfer-details"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { epcQrPayload } from "@/lib/bank-details"
import {
  MIN_CONTRIBUTION_EUR,
  clampContribution,
  contributionStep,
  defaultContribution,
  formatEur,
  maxContribution,
} from "@/lib/contribute"

export type StripeMode =
  /** A Checkout Session is created server-side with the chosen amount. */
  | { kind: "checkout" }
  /** No secret key on the server: fall back to the fixed payment link. */
  | { kind: "link"; url: string }

export function ContributionPanel({
  slug,
  label,
  expenseEur,
  message,
  stripe,
}: {
  slug: string
  label: string
  expenseEur: number
  message: string
  stripe: StripeMode
}) {
  const max = maxContribution(expenseEur)
  const step = contributionStep(expenseEur)
  const [amount, setAmount] = useState(() => defaultContribution(expenseEur))
  const [typed, setTyped] = useState(String(amount))
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)

  const payload = useMemo(() => epcQrPayload(amount, message), [amount, message])

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 480 })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => setQr(null))
    return () => {
      cancelled = true
    }
  }, [payload])

  const commit = (value: number) => {
    const next = clampContribution(value, expenseEur)
    setAmount(next)
    setTyped(String(next))
  }

  const share = Math.round((amount / Math.max(expenseEur, 1)) * 100)

  const payWithStripe = async () => {
    setError(null)
    if (stripe.kind === "link") {
      const url = new URL(stripe.url)
      url.searchParams.set("client_reference_id", slug.slice(0, 200))
      window.open(url.toString(), "_blank", "noopener,noreferrer")
      return
    }
    setPaying(true)
    try {
      const response = await fetch("/api/contribute/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, amount }),
      })
      const data = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Could not start the payment")
      }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment")
      setPaying(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="bg-card rounded-lg border border-border p-6 sm:p-8">
        <h2 className="text-xl font-bold text-foreground">How much would you like to cover?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The whole expense is {formatEur(expenseEur)}. Half is a great start; any amount from{" "}
          {formatEur(MIN_CONTRIBUTION_EUR)} helps.
        </p>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-4xl font-bold tabular-nums text-foreground">{formatEur(amount)}</div>
            <div className="text-sm text-muted-foreground">
              {share >= 100 ? "the whole expense" : `${share}% of ${label}`}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Amount</span>
            <span className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                €
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_CONTRIBUTION_EUR}
                max={max}
                step={1}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onBlur={() => commit(Number(typed))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(Number(typed))
                }}
                className="w-28 pl-7 text-right tabular-nums"
                aria-label="Amount in euros"
              />
            </span>
          </label>
        </div>

        <Slider
          className="mt-6"
          min={MIN_CONTRIBUTION_EUR}
          max={max}
          step={step}
          value={[amount]}
          onValueChange={([value]) => {
            setAmount(value)
            setTyped(String(value))
          }}
          aria-label="Contribution amount"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatEur(MIN_CONTRIBUTION_EUR)}</span>
          <span>{formatEur(max)}</span>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="bg-card rounded-lg border border-border p-6 sm:p-8 flex flex-col items-center text-center">
          <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Card or Bancontact
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {stripe.kind === "checkout"
              ? `Pay ${formatEur(amount)} online. Your contribution is tagged with this expense.`
              : "Pay online via Stripe. You choose the amount on the next page."}
          </p>
          <Button size="lg" className="mt-auto" onClick={payWithStripe} disabled={paying}>
            {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
            {stripe.kind === "checkout" ? `Contribute ${formatEur(amount)}` : "Contribute online"}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </section>

        <section className="bg-card rounded-lg border border-border p-6 sm:p-8 flex flex-col items-center text-center">
          <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Bank transfer
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            <span className="hidden md:inline">
              Scan with your banking app. The amount and the message are already filled in.
            </span>
            <span className="md:hidden">
              Copy the details into your banking app. Keep the message: it is how we match your
              transfer to this expense.
            </span>
          </p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={`SEPA transfer QR code for ${formatEur(amount)}`}
              width={240}
              height={240}
              className="rounded-md mb-6 hidden md:block"
            />
          )}
          <BankTransferDetails message={message} amountEur={amount} />
        </section>
      </div>
    </div>
  )
}
