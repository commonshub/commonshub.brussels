"use client"

import { useMemo, useState } from "react"

import { BankTransferDetails } from "@/components/bank-transfer-details"
import type { Drink } from "@/lib/fridge"

const eur = (n: number) => new Intl.NumberFormat("en-BE", { style: "currency", currency: "EUR", minimumFractionDigits: n % 1 ? 2 : 0 }).format(n)
const sizeLabel = (d: Drink) => `${d.size}${d.abv !== undefined ? ` · ${d.abv < 1.2 ? "alcohol-free" : `${String(d.abv).replace(".", ",")}%`}` : ""}`

type Step = "pick" | "pay"

/** How to pay: by card (Stripe) or by bank transfer with the order as the message. */
function Pay({ amount, setAmount, payload, message }: { amount: number; setAmount: (n: number) => void; payload: object; message: string }) {
  const [method, setMethod] = useState<"card" | "transfer">("card")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const card = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/fridge/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, amount }) })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start the payment")
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Your contribution</span>
        <span className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">€</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step={0.5}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="h-11 w-28 rounded-lg border border-border bg-background pl-7 pr-3 text-right text-lg font-semibold tabular-nums"
            aria-label="Amount in euros"
          />
        </span>
      </label>
      <div role="radiogroup" aria-label="Payment method" className="flex rounded-lg border border-border bg-muted/50 p-1">
        {(["card", "transfer"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${method === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {m === "card" ? "Card or Bancontact" : "Bank transfer"}
          </button>
        ))}
      </div>
      {method === "card" ? (
        <>
          <button type="button" onClick={card} disabled={busy || amount < 1} className="h-12 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Opening the payment…" : `Pay ${eur(amount)}`}
          </button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      ) : (
        <BankTransferDetails message={message} amountEur={amount} />
      )}
    </div>
  )
}

/**
 * Pick drinks from the fridge, then pay for them, or offer a crate. Built
 * for a phone opened from a QR code on the fridge: big buttons, the total
 * always in view, one screen at a time.
 */
export function FridgeOrder({ drinks }: { drinks: Drink[] }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [step, setStep] = useState<Step>("pick")
  const [amount, setAmount] = useState(0)
  const [crate, setCrate] = useState<Drink | null>(null)

  const items = useMemo(() => drinks.filter((d) => (qty[d.id] ?? 0) > 0).map((d) => ({ drink: d, quantity: qty[d.id] })), [drinks, qty])
  const count = items.reduce((s, i) => s + i.quantity, 0)
  const suggested = Math.round(items.reduce((s, i) => s + i.quantity * i.drink.suggested, 0) * 100) / 100
  const message = (crate ? `Fridge crate ${crate.name}` : `Fridge ${items.map((i) => `${i.quantity} ${i.drink.name}`).join(" ")}`).slice(0, 140)

  const change = (id: string, delta: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(50, (q[id] ?? 0) + delta)) }))

  if (step === "pay") {
    return (
      <div className="flex flex-col gap-6">
        <button type="button" onClick={() => setStep("pick")} className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline">
          ← Back to the fridge
        </button>
        {crate ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Offer a crate to the community</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {crate.perCrate} × {crate.name}
            </div>
            <div className="text-sm text-muted-foreground">A crate costs us {eur(crate.crateCost)}. Thank you for sharing.</div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Your order</div>
            <ul className="mt-2 flex flex-col gap-1">
              {items.map(({ drink, quantity }) => (
                <li key={drink.id} className="flex justify-between gap-3 text-foreground">
                  <span>
                    {quantity} × {drink.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{eur(quantity * drink.suggested)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
              <span>Suggested</span>
              <span className="tabular-nums">{eur(suggested)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">That is what the drinks cost us. Anything above it helps keep the space open.</p>
          </div>
        )}
        <Pay amount={amount} setAmount={setAmount} payload={crate ? { crate: crate.id } : { items: items.map((i) => ({ id: i.drink.id, quantity: i.quantity })) }} message={message} />
      </div>
    )
  }

  return (
    <div className="pb-28">
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {drinks.map((d) => {
          const n = qty[d.id] ?? 0
          return (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-tight text-foreground">{d.name.replace(/\s+\d+(?:[.,]\d+)?\s*%$/, "")}</div>
                <div className="text-xs text-muted-foreground">
                  {sizeLabel(d)} · {eur(d.suggested)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label={`One less ${d.name}`} onClick={() => change(d.id, -1)} disabled={n === 0} className="h-11 w-11 rounded-full border border-border text-xl text-foreground disabled:opacity-30">
                  −
                </button>
                <span className="w-7 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                  {n}
                </span>
                <button type="button" aria-label={`One more ${d.name}`} onClick={() => change(d.id, 1)} className="h-11 w-11 rounded-full bg-primary text-xl text-primary-foreground">
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <details className="mt-6 rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer font-medium text-foreground">Offer a crate to the community</summary>
        <p className="mt-2 text-sm text-muted-foreground">Pay for a whole crate and let everyone help themselves.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {drinks.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => {
                  setCrate(d)
                  setAmount(Math.ceil(d.crateCost))
                  setStep("pay")
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm hover:border-primary"
              >
                <span className="min-w-0">
                  {d.perCrate} × {d.name}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{eur(d.crateCost)}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold text-foreground">
                {count} {count === 1 ? "drink" : "drinks"} · {eur(suggested)}
              </div>
              <div className="text-xs text-muted-foreground">suggested</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCrate(null)
                setAmount(suggested)
                setStep("pay")
                window.scrollTo({ top: 0 })
              }}
              className="h-12 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
