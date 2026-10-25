"use client"

import { useState } from "react"
import { CreditCard, Loader2 } from "lucide-react"

import { MONTHLY_PRICES } from "@/lib/membership-application"
import type { MemberPlan } from "@/lib/member-plan"

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

/**
 * The member's plan. Individuals paying monthly by card choose €10, €15 or
 * €20 from their own income and situation, and can change it anytime (from
 * their next payment); a yearly plan changes when it renews.
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
        <p className="mt-2 text-sm text-muted-foreground">
          We can&apos;t find your plan yet (new payments show up within a day). Questions?{" "}
          <a href="mailto:hello@commonshub.brussels" className="text-primary underline">
            hello@commonshub.brussels
          </a>
        </p>
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
