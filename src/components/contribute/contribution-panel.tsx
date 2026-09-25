"use client"

import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import { CreditCard, Landmark, Loader2, Repeat } from "lucide-react"

import { BankTransferDetails } from "@/components/bank-transfer-details"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
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

type Method = "card" | "transfer"

/**
 * Chip in for one expense, in three short steps: how much, whether every
 * month (recurring costs only, opt-in), and how to pay. The payment method
 * is one line to choose from; only the chosen one's details show, so a
 * card payment is a single button rather than a tall empty box.
 */
export function ContributionPanel({
  slug,
  expenseEur,
  message,
  stripe,
  recurring = false,
  short,
}: {
  slug: string
  label: string
  expenseEur: number
  message: string
  stripe: StripeMode
  /** A recurring cost: offer to contribute every month. */
  recurring?: boolean
  /** The cost's short name for running text, "the phone booth". */
  short?: string
}) {
  const what = short ? `the ${short}` : "this expense"
  const max = maxContribution(expenseEur)
  const step = contributionStep(expenseEur)
  const [amount, setAmount] = useState(() => defaultContribution(expenseEur))
  const [typed, setTyped] = useState(String(amount))
  const [monthly, setMonthly] = useState(false)
  const [method, setMethod] = useState<Method>("card")
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)

  // Monthly by card needs a Checkout Session; the fixed payment link is one-off.
  const cardMonthlyUnavailable = monthly && stripe.kind === "link"
  const payload = useMemo(() => epcQrPayload(amount, message), [amount, message])

  useEffect(() => {
    if (monthly || method !== "transfer") return
    let cancelled = false
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 480 })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => setQr(null))
    return () => {
      cancelled = true
    }
  }, [payload, monthly, method])

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
        body: JSON.stringify({ slug, amount, monthly }),
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

  const methods: Array<{ id: Method; label: string; icon: typeof CreditCard }> = [
    { id: "card", label: monthly ? "Card" : "Card or Bancontact", icon: CreditCard },
    { id: "transfer", label: monthly ? "Standing order" : "Bank transfer", icon: Landmark },
  ]

  return (
    <section className="bg-card rounded-lg border border-border p-6 sm:p-8 flex flex-col gap-8">
      {/* 1. How much */}
      <div>
        <h2 className="text-xl font-bold text-foreground">How much would you like to chip in?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {recurring ? "A month" : "The whole amount"} is {formatEur(expenseEur)}. Half is a great start, but any amount from{" "}
          {formatEur(MIN_CONTRIBUTION_EUR)} helps. Slide, or type a number.
        </p>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-4xl font-bold tabular-nums text-foreground">
              {formatEur(amount)}
              {monthly && <span className="text-lg font-semibold text-muted-foreground"> / month</span>}
            </div>
            <div className="text-sm text-muted-foreground">
              {share >= 100 ? `the whole ${recurring ? "month" : "expense"}` : `${share}% of ${recurring ? "a month" : "the expense"}`}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Amount</span>
            <span className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">€</span>
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
      </div>

      {/* 2. Every month? (recurring costs only, off unless chosen) */}
      {recurring && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <Switch checked={monthly} onCheckedChange={setMonthly} aria-label="Contribute every month" className="mt-0.5" />
          <span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Repeat className="h-4 w-4 text-primary" />
              Make it monthly
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              Become one of the people covering {what}: {formatEur(amount)} every month, until you stop it.
            </span>
          </span>
        </label>
      )}

      {/* 3. How to pay: one line to choose, then only that method's details */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pay with</h3>
        <div role="radiogroup" aria-label="Payment method" className="mt-2 flex w-full rounded-lg border border-border bg-muted/50 p-1 sm:inline-flex sm:w-auto">
          {methods.map(({ id, label: methodLabel, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={method === id}
              onClick={() => setMethod(id)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
                method === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{methodLabel}</span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          {method === "card" ? (
            cardMonthlyUnavailable ? (
              <p className="text-sm text-muted-foreground">
                A monthly card payment is not available right now. Set up a standing order instead: pick it above.
              </p>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  {stripe.kind === "checkout"
                    ? monthly
                      ? `You will be charged ${formatEur(amount)} today and on the same day every month, until you cancel. Your contribution is tagged with this expense.`
                      : `Pay ${formatEur(amount)} online. Your contribution is tagged with this expense.`
                    : "Pay online via Stripe. You choose the amount on the next page."}
                </p>
                <Button size="lg" onClick={payWithStripe} disabled={paying}>
                  {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : monthly ? <Repeat className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                  {stripe.kind === "checkout" ? `Contribute ${formatEur(amount)}${monthly ? " a month" : ""}` : "Contribute online"}
                </Button>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
            )
          ) : monthly ? (
            <div className="flex flex-col gap-4">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Set up a standing order in your banking app</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Open your bank&apos;s app and look for &ldquo;standing order&rdquo; (ordre permanent, doorlopende opdracht).</li>
                  <li>Copy the details below, with the frequency set to monthly.</li>
                  <li>Keep the message exactly as it is: it is how we know the money is for {what}.</li>
                </ol>
              </div>
              <BankTransferDetails message={message} amountEur={amount} frequency="Monthly" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              {qr && (
                <div className="hidden shrink-0 text-center md:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt={`SEPA transfer QR code for ${formatEur(amount)}`} width={200} height={200} className="rounded-md" />
                  <p className="mt-2 max-w-[200px] text-xs text-muted-foreground">Scan with your banking app: the amount and message are filled in.</p>
                </div>
              )}
              <div className="w-full">
                <p className="mb-3 text-sm text-muted-foreground md:hidden">
                  Copy the details into your banking app. Keep the message: it is how we match your transfer to this expense.
                </p>
                <BankTransferDetails message={message} amountEur={amount} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
