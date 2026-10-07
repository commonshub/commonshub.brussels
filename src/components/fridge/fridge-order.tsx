"use client"

import { useEffect, useMemo, useState } from "react"

import { BankTransferDetails } from "@/components/bank-transfer-details"
import type { Drink } from "@/lib/fridge"

const eur = (n: number) => new Intl.NumberFormat("en-BE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n)
const round2 = (n: number) => Math.round(n * 100) / 100
/** Up to the next multiple of €5 (never below €5). */
const ceil5 = (n: number) => Math.max(5, Math.ceil(n / 5 - 1e-9) * 5)
/** Four buttons, €5 apart, starting at the first multiple of €5 that covers `from`. */
const fiveSteps = (from: number) => [0, 5, 10, 15].map((d) => ceil5(from) + d)
const shortName = (d: Drink) => d.name.replace(/\s+\d+(?:[.,]\d+)?\s*%$/, "")
const sizeLabel = (d: Drink) => `${d.size}${d.abv !== undefined ? ` · ${d.abv < 1.2 ? "alcohol-free" : `${String(d.abv).replace(".", ",")}%`}` : ""}`

export interface FridgeSettings {
  roundTo: number
  minimum: number
  timeTokensPerMonth: number
  transferMessage: string
  crateTransferMessage: string
}

type Step = "pick" | "donate" | "crate"
type Method = "card" | "transfer"

export interface FixedCost {
  slug: string
  label: string
  /** A month of it, in euros (cents). */
  amount: number
}

/** The space the fridge is in: rent and utilities, a month; a tap shows what they are. */
function FixedCosts({ costs }: { costs: FixedCost[] }) {
  const [open, setOpen] = useState(false)
  const total = round2(costs.reduce((s, c) => s + c.amount, 0))
  if (total <= 0) return null
  return (
    <li className="text-foreground">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full justify-between gap-3 text-left">
        <span className="min-w-0">
          Rent + utilities
          <span className="block text-xs text-muted-foreground">the space the fridge is in</span>
        </span>
        <span className="flex shrink-0 items-start gap-1.5">
          <span className="text-right tabular-nums">
            {eur(total)}
            <span className="block text-xs text-muted-foreground">a month</span>
          </span>
          <span aria-hidden className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>
            ›
          </span>
        </span>
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2">
          <ul className="flex flex-col gap-1 text-sm">
            {costs.map((c) => (
              <li key={c.slug} className="flex justify-between gap-3">
                <a href={`/expenses/${c.slug}`} className="min-w-0 text-foreground underline-offset-2 hover:underline">
                  {c.label}
                </a>
                <span className="shrink-0 tabular-nums text-muted-foreground">{eur(c.amount)}</span>
              </li>
            ))}
          </ul>
          <a href="/contribute" className="mt-2 block text-xs font-medium text-primary underline-offset-2 hover:underline">
            Help cover them →
          </a>
        </div>
      )}
    </li>
  )
}

/** Money and time: the euros the drinks cost us, the space they are in, and the community's time in tokens. */
function Costs({ lines, total, tokensPerMonth, fixedCosts }: { lines: Array<{ label: string; amount: number }>; total: number; tokensPerMonth: number; fixedCosts: FixedCost[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground">What it costs us</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((l) => (
          <li key={l.label} className="flex justify-between gap-3 text-foreground">
            <span className="min-w-0">{l.label}</span>
            <span className="shrink-0 tabular-nums">{eur(l.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 text-foreground">
          <span className="min-w-0">
            Looking after the fridge
            <span className="block text-xs text-muted-foreground">ordering, restocking, returning empties, done by members</span>
          </span>
          <span className="shrink-0 text-right tabular-nums">
            {tokensPerMonth} {tokensPerMonth === 1 ? "token" : "tokens"}
            <span className="block text-xs text-muted-foreground">a month</span>
          </span>
        </li>
        <FixedCosts costs={fixedCosts} />
      </ul>
      <div className="mt-3 flex justify-between gap-3 border-t border-border pt-3 text-foreground">
        <span className="font-semibold">Total</span>
        <span className="text-right tabular-nums">
          <span className="font-semibold">{eur(total)}</span>
          <span className="block text-xs text-muted-foreground">+ our time</span>
        </span>
      </div>
    </section>
  )
}

/** How do you want to contribute: euros, by card or bank transfer. */
function Contribute(props: {
  amount: number
  setAmount: (n: number) => void
  minimum: number
  /** The amounts offered as buttons (multiples of €5); the last button is a custom amount. */
  options: number[]
  payload: object
  message: string
  listed?: boolean
}) {
  const { amount, setAmount, minimum, options, payload, message, listed } = props
  const [custom, setCustom] = useState(() => !options.includes(amount))
  const [method, setMethod] = useState<Method>("card")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tooLow = !(amount >= minimum)

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
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">How do you want to contribute?</h2>
        <p className="mt-1 text-sm text-muted-foreground">The drinks are not for sale: they are there for everyone. A donation keeps the fridge stocked.</p>
      </div>
      <div role="radiogroup" aria-label="Donation in euros" className="grid grid-cols-5 gap-2">
        {options.map((v) => {
          const active = !custom && amount === v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setCustom(false)
                setAmount(v)
              }}
              className={`h-12 rounded-lg text-base font-semibold tabular-nums ${active ? "border-2 border-foreground bg-primary/5 text-foreground" : "border border-border bg-background text-foreground"}`}
            >
              €{v}
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => setCustom(true)}
          className={`h-12 rounded-lg text-sm font-semibold ${custom ? "border-2 border-foreground bg-primary/5 text-foreground" : "border border-border bg-background text-foreground"}`}
        >
          Other
        </button>
      </div>
      {custom && (
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Your amount</span>
          <span className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">€</span>
            <input
              type="number"
              inputMode="decimal"
              min={minimum}
              step={1}
              value={amount || ""}
              autoFocus
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="h-11 w-28 rounded-lg border border-border bg-background pl-7 pr-3 text-right text-lg font-semibold tabular-nums"
              aria-label="Custom donation in euros"
            />
          </span>
        </label>
      )}
      <div role="radiogroup" aria-label="Payment method" className="flex rounded-lg bg-muted p-1">
        {(["card", "transfer"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${method === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "card" ? "Card or Bancontact" : "Bank transfer"}
          </button>
        ))}
      </div>
      {method === "card" ? (
        <>
          <button type="button" onClick={card} disabled={busy || tooLow} className="h-12 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Opening the payment…" : `Donate ${eur(amount || 0)}`}
          </button>
          {tooLow && <p className="text-sm text-muted-foreground">At least {eur(minimum)}.</p>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <BankTransferDetails message={message} amountEur={amount || undefined} />
          {listed && <p className="text-xs text-muted-foreground">Only donations by card are listed here automatically for now.</p>}
        </>
      )}
    </section>
  )
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline">
      ← Back to the fridge
    </button>
  )
}

/** People who offered a crate and asked to be listed; loaded after the page. */
function CrateContributors() {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    fetch("/api/fridge/contributors")
      .then((r) => (r.ok ? r.json() : { contributors: [] }))
      .then((d: { contributors?: Array<{ name: string }> }) => setNames((d.contributors ?? []).map((c) => c.name)))
      .catch(() => {})
  }, [])
  if (names.length === 0) return null
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      Crates offered by <span className="text-foreground">{names.join(", ")}</span>. Thank you!
    </p>
  )
}

/**
 * Take drinks from the fridge, see what they cost us in money and time,
 * and donate; or offer a whole crate to the community. Built for a phone
 * opened from a QR code on the fridge: big buttons, the total in view.
 */
export function FridgeOrder({ drinks, settings, fixedCosts = [] }: { drinks: Drink[]; settings: FridgeSettings; fixedCosts?: FixedCost[] }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [step, setStep] = useState<Step>("pick")
  const [amount, setAmount] = useState(0)
  const [crateId, setCrateId] = useState<string>(drinks[0]?.id ?? "")
  const [name, setName] = useState("")

  const items = useMemo(() => drinks.filter((d) => (qty[d.id] ?? 0) > 0).map((d) => ({ drink: d, quantity: qty[d.id] })), [drinks, qty])
  const count = items.reduce((s, i) => s + i.quantity, 0)
  const cost = round2(items.reduce((s, i) => s + i.quantity * i.drink.costPerBottle, 0))
  const crate = drinks.find((d) => d.id === crateId) ?? drinks[0]

  const go = (next: Step) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }
  const change = (id: string, delta: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(50, (q[id] ?? 0) + delta)) }))

  if (step === "donate") {
    return (
      <div className="flex flex-col gap-6">
        <Back onClick={() => go("pick")} />
        <Costs
          lines={items.map(({ drink, quantity }) => ({ label: `${quantity} × ${shortName(drink)}`, amount: round2(quantity * drink.costPerBottle) }))}
          total={cost}
          tokensPerMonth={settings.timeTokensPerMonth}
          fixedCosts={fixedCosts}
        />
        <Contribute
          amount={amount}
          setAmount={setAmount}
          minimum={1}
          options={[5, 10, 15, 20]}
          payload={{ items: items.map((i) => ({ id: i.drink.id, quantity: i.quantity })) }}
          message={settings.transferMessage}
        />
      </div>
    )
  }

  if (step === "crate" && crate) {
    const listedName = name.trim()
    return (
      <div className="flex flex-col gap-6">
        <Back onClick={() => go("pick")} />
        <section>
          <h2 className="text-lg font-semibold text-foreground">Offer a crate to the community</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a crate from our last order; everyone can then help themselves.</p>
          <div role="radiogroup" aria-label="Crate" className="mt-3 flex flex-col gap-2">
            {drinks.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={d.id === crate.id}
                onClick={() => {
                  setCrateId(d.id)
                  setAmount(ceil5(d.crateCost))
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${d.id === crate.id ? "border-2 border-foreground bg-primary/5" : "border border-border"}`}
              >
                <span className="min-w-0">
                  <span className="text-foreground">
                    {d.perCrate} × {shortName(d)}
                  </span>
                  <span className="block text-xs text-muted-foreground">{sizeLabel(d)}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{eur(d.crateCost)}</span>
              </button>
            ))}
          </div>
        </section>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-foreground">
            Your name <span className="text-muted-foreground">(optional)</span>
          </span>
          <input
            type="text"
            value={name}
            maxLength={40}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            placeholder="To be listed as a contributor"
            className="h-11 rounded-lg border border-border bg-background px-3 text-base"
          />
        </label>
        <Costs lines={[{ label: `A crate of ${crate.perCrate} × ${shortName(crate)}`, amount: crate.crateCost }]} total={crate.crateCost} tokensPerMonth={settings.timeTokensPerMonth} fixedCosts={fixedCosts} />
        <Contribute
          amount={amount}
          setAmount={setAmount}
          minimum={crate.crateCost}
          options={fiveSteps(crate.crateCost)}
          payload={{ crate: crate.id, name: listedName }}
          message={settings.crateTransferMessage}
          listed={!!listedName}
        />
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
                <div className="font-medium leading-tight text-foreground">{shortName(d)}</div>
                <div className="text-xs text-muted-foreground">
                  {sizeLabel(d)} · costs us {eur(d.costPerBottle)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" aria-label={`One less ${d.name}`} onClick={() => change(d.id, -1)} disabled={n === 0} className="h-11 w-11 rounded-full border border-border text-xl text-foreground disabled:opacity-30">
                  −
                </button>
                <span className="w-7 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                  {n}
                </span>
                <button type="button" aria-label={`One more ${d.name}`} onClick={() => change(d.id, 1)} className="h-11 w-11 rounded-full border border-foreground/40 bg-background text-xl text-foreground">
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Offer a crate to the community</h2>
        <p className="mt-1 text-sm text-muted-foreground">Donate a whole crate and let everyone help themselves.</p>
        <button
          type="button"
          onClick={() => {
            if (crate) setAmount(ceil5(crate.crateCost))
            go("crate")
          }}
          className="mt-3 h-11 w-full rounded-lg border border-border bg-background text-sm font-semibold text-foreground"
        >
          Choose a crate
        </button>
        <CrateContributors />
      </section>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold text-foreground">
                {count} {count === 1 ? "drink" : "drinks"}
              </div>
              <div className="text-xs text-muted-foreground">cost us {eur(cost)}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAmount(ceil5(cost))
                go("donate")
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
