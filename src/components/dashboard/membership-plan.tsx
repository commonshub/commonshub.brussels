"use client"

import { useState } from "react"
import { CreditCard, Loader2 } from "lucide-react"

import { DEFAULT_MONTHLY, MONTHLY_PRICES, PAYMENT_LINKS, YEARLY_PRICES } from "@/lib/membership-application"
import type { MemberPlan } from "@/lib/member-plan"
import { AddEmailCard } from "./add-email"

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

/**
 * The member's plan. Individuals paying monthly by card choose €10, €15 or
 * €20 from their own income and situation, and can change it anytime (from
 * their next payment); a yearly plan changes when it renews. Without a plan
 * they can start one: monthly by card (the membership's Stripe payment
 * link) or a year by bank transfer (/membership/pay/<amount>).
 */
export function MembershipPlanCard({ plan }: { plan: MemberPlan | null }) {
  const [amount, setAmount] = useState(plan?.amount ?? null)
  const [busy, setBusy] = useState<number | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function change(to: number) {
    setBusy(to)
    setMessage(null)
    try {
      const res = await fetch("/api/membership/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: to }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Could not change your plan")
      setAmount(body.amount)
      setMessage({ ok: true, text: `Done: €${body.amount} a month from your next payment.` })
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <CreditCard className="h-5 w-5 text-primary" /> Membership
      </h3>
      {!plan ? (
        <StartMembership />
      ) : (
        <>
          <p className="mt-2 text-foreground">
            <span className="text-2xl font-bold">€{amount}</span> a {plan.interval}
            {plan.status !== "active" && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">{plan.status}</span>}
          </p>
          {plan.renewsOn && (
            <p className="text-sm text-muted-foreground">
              {plan.interval === "year" ? "Renews" : "Next payment"} on {longDate(plan.renewsOn)}
            </p>
          )}
          {plan.canChange ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">Pay what fits your income and situation. You can change it anytime.</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Monthly amount">
                {MONTHLY_PRICES.map((p) => (
                  <button
                    key={p.amount}
                    type="button"
                    role="radio"
                    aria-checked={amount === p.amount}
                    disabled={busy !== null || amount === p.amount}
                    onClick={() => change(p.amount)}
                    className={`rounded-xl border-2 px-2 py-2 text-center text-sm transition ${amount === p.amount ? "border-primary bg-primary/10 font-bold text-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}
                  >
                    <span className="block text-base font-semibold text-foreground">{busy === p.amount ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `€${p.amount}`}</span>
                    <span className="block text-xs">{p.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {plan.interval === "year" ? "You paid for the year: you can change your plan when it renews." : "To change your plan, write to hello@commonshub.brussels."}
            </p>
          )}
          {message && <p className={`mt-2 text-sm ${message.ok ? "text-foreground" : "text-destructive"}`}>{message.text}</p>}
        </>
      )}
    </div>
  )
}

/** No plan found: start one, monthly by card or yearly by bank transfer. */
function StartMembership() {
  const [interval, setPeriod] = useState<"month" | "year">("month")
  const [monthly, setMonthly] = useState<number>(DEFAULT_MONTHLY)
  const [linking, setLinking] = useState(false)
  const prices = interval === "month" ? MONTHLY_PRICES : YEARLY_PRICES
  const chosen = interval === "month" ? monthly : monthly * 10
  const href = interval === "month" ? PAYMENT_LINKS[`individual${monthly}` as "individual10" | "individual15" | "individual20"].url : `/membership/pay/${chosen}`

  return (
    <>
      <p className="mt-2 text-foreground">You are not a member of the Commons Hub yet.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        You may have access as part of your organisation, but we encourage you to also become a member as an individual, to build your own relationship with the commons in
        Brussels. The commons needs your organisation. But it also needs you.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Just paid? It shows up here within a day. Already a member with another email?{" "}
        <button type="button" onClick={() => setLinking(!linking)} className="text-primary underline">
          Confirm it
        </button>
        . Questions?{" "}
        <a href="mailto:hello@commonshub.brussels" className="text-primary underline">
          hello@commonshub.brussels
        </a>
      </p>
      {linking && <AddEmailCard variant="membership" />}
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="How often you pay">
        {(
          [
            ["month", "Monthly, by card"],
            ["year", "Yearly, by transfer"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={interval === k}
            onClick={() => setPeriod(k)}
            className={`rounded-lg px-2 py-1.5 text-sm transition ${interval === k ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Pay what fits your income and situation.{interval === "year" ? " A year is ten months: two months free." : " You can change it anytime."}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={interval === "month" ? "Monthly amount" : "Yearly amount"}>
        {prices.map((p, i) => {
          const m = MONTHLY_PRICES[i].amount
          return (
            <button
              key={p.amount}
              type="button"
              role="radio"
              aria-checked={monthly === m}
              onClick={() => setMonthly(m)}
              className={`rounded-xl border-2 px-2 py-2 text-center text-sm transition ${monthly === m ? "border-primary bg-primary/10 font-bold text-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}
            >
              <span className="block text-base font-semibold text-foreground">€{p.amount}</span>
              <span className="block text-xs">{p.label}</span>
            </button>
          )
        })}
      </div>
      <a href={href} className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground transition hover:bg-primary/90">
        {interval === "month" ? `Pay €${chosen} a month by card` : `Pay €${chosen} for a year by transfer`}
      </a>
    </>
  )
}
